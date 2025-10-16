#!/usr/bin/env node

/**
 * CLI entry point for custom-type-enforcement
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CheckName, CheckResult, CheckRunner, ParsedArgs, OutputFormat } from '../types.js';
import { runBarrelFilesCheck } from '../checks/barrel-files.js';
import { runTypeExportsCheck } from '../checks/type-exports.js';
import { runTypeImportsCheck } from '../checks/type-imports.js';
import { runTypeDuplicatesCheck } from '../checks/type-duplicates.js';
import { runInlineTypesCheck } from '../checks/inline-types.js';

/**
 * All available checks
 */
const ALL_CHECKS: CheckName[] = [
  'barrel-files',
  'type-exports',
  'type-imports',
  'type-duplicates',
  'inline-types',
];

/**
 * Map check names to their runner functions
 */
const CHECK_RUNNERS: Record<CheckName, CheckRunner> = {
  'barrel-files': runBarrelFilesCheck,
  'type-exports': runTypeExportsCheck,
  'type-imports': runTypeImportsCheck,
  'type-duplicates': runTypeDuplicatesCheck,
  'inline-types': runInlineTypesCheck,
};

/**
 * Display help message
 */
function showHelp(): void {
  console.log(`custom-type-enforcement v1.0.0

Enforce TypeScript type architecture and code quality rules.

Usage:
  npx custom-type-enforcement [options]

Options:
  --checks=<checks>       Comma-separated list of checks to run
                          Available: barrel-files, type-exports, type-imports,
                                    type-duplicates, inline-types
                          Default: all checks

  --format=<format>       Output format
                          Options: structured (default), compact

  --help                  Show this help message

Examples:
  npx custom-type-enforcement
  npx custom-type-enforcement --checks=barrel-files,type-exports
  npx custom-type-enforcement --format=compact

Documentation: https://github.com/shaenchen/custom-type-enforcement
`);
}

/**
 * Parse command-line arguments
 */
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let checks: CheckName[] = ALL_CHECKS;
  let format: OutputFormat = 'structured';
  let help = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg.startsWith('--checks=')) {
      const checksArg = arg.substring('--checks='.length);
      const requestedChecks = checksArg.split(',').map(c => c.trim()) as CheckName[];

      // Validate check names
      const invalidChecks = requestedChecks.filter(c => !ALL_CHECKS.includes(c));
      if (invalidChecks.length > 0) {
        console.error(`❌ ERROR: Invalid check names: ${invalidChecks.join(', ')}\n`);
        console.error(`Available checks: ${ALL_CHECKS.join(', ')}\n`);
        process.exit(1);
      }

      checks = requestedChecks;
    } else if (arg.startsWith('--format=')) {
      const formatArg = arg.substring('--format='.length);
      if (formatArg !== 'structured' && formatArg !== 'compact') {
        console.error(`❌ ERROR: Invalid format: ${formatArg}\n`);
        console.error('Available formats: structured, compact\n');
        process.exit(1);
      }
      format = formatArg;
    } else {
      console.error(`❌ ERROR: Unknown argument: ${arg}\n`);
      console.error('Use --help to see available options\n');
      process.exit(1);
    }
  }

  return { checks, format, help };
}

/**
 * Check if tsconfig.json exists in the current directory
 */
function checkTsConfigExists(): void {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');

  if (!fs.existsSync(tsconfigPath)) {
    console.error('❌ ERROR: No tsconfig.json found in current directory\n');
    console.error('This tool must be run from a TypeScript project root.');
    console.error('Please navigate to your project directory and try again.\n');
    process.exit(1);
  }
}

/**
 * Run checks and aggregate results
 */
function runChecks(checks: CheckName[], format: OutputFormat): void {
  const results: CheckResult[] = [];

  // Run each check with noExit option
  for (const checkName of checks) {
    const runCheck = CHECK_RUNNERS[checkName];
    const result = runCheck({ format, noExit: true });

    if (result) {
      results.push(result);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(65));
  console.log('📊 SUMMARY');
  console.log('='.repeat(65));
  console.log('');

  let totalViolations = 0;
  let failedChecks = 0;
  let passedChecks = 0;

  results.forEach((result) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const violations = result.violationCount > 0
      ? ` (${result.violationCount} issue${result.violationCount === 1 ? '' : 's'})`
      : '';

    console.log(`  ${result.checkName.padEnd(20)} ${status}${violations}`);

    totalViolations += result.violationCount;
    if (result.passed) {
      passedChecks++;
    } else {
      failedChecks++;
    }
  });

  console.log('');
  console.log(`Total: ${passedChecks} passed, ${failedChecks} failed, ${totalViolations} violation${totalViolations === 1 ? '' : 's'}`);
  console.log('='.repeat(65));
  console.log('');

  // Exit with appropriate code
  const hasFailures = results.some(r => !r.passed);
  process.exit(hasFailures ? 1 : 0);
}

/**
 * Main CLI function
 */
function main(): void {
  const { checks, format, help } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  // Check for tsconfig.json
  checkTsConfigExists();

  // Run checks
  runChecks(checks, format);
}

// Run CLI
main();
