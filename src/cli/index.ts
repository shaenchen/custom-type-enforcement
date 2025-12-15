#!/usr/bin/env node

/**
 * CLI entry point for custom-type-enforcement
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CheckName, CheckResult, CheckRunner, ParsedArgs } from '../types.js';
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

  --exclude=<pattern>     Glob pattern to exclude from checking
                          Can be specified multiple times
                          Patterns are additive to default excludes
                          (node_modules, dist, build, .git, coverage, .next, out)

  --help                  Show this help message

Examples:
  npx custom-type-enforcement
  npx custom-type-enforcement --checks=barrel-files,type-exports
  npx custom-type-enforcement --exclude="**/*.test.ts" --exclude="**/*.spec.ts"
  npx custom-type-enforcement --exclude="**/__tests__/**" --exclude="**/fixtures/**"

Documentation: https://github.com/shaenchen/custom-type-enforcement
`);
}

/**
 * Parse command-line arguments
 */
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let checks: CheckName[] = ALL_CHECKS;
  let help = false;
  const excludePatterns: string[] = [];

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg.startsWith('--checks=')) {
      const checksArg = arg.replace('--checks=', '');
      const requestedChecks = checksArg.split(',').map(c => c.trim()) as CheckName[];

      // Validate checks
      const invalidChecks = requestedChecks.filter(c => !ALL_CHECKS.includes(c));
      if (invalidChecks.length > 0) {
        console.error(`❌ ERROR: Invalid check(s): ${invalidChecks.join(', ')}\n`);
        console.error(`Available checks: ${ALL_CHECKS.join(', ')}\n`);
        process.exit(1);
      }

      checks = requestedChecks;
    } else if (arg.startsWith('--exclude=')) {
      const pattern = arg.replace('--exclude=', '');
      if (pattern) {
        excludePatterns.push(pattern);
      }
    } else {
      console.error(`❌ ERROR: Unknown argument: ${arg}\n`);
      console.error('Use --help to see available options\n');
      process.exit(1);
    }
  }

  return { checks, help, excludePatterns };
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
 * Run checks and aggregate results with minimal LLM-optimized output
 */
function runChecks(checks: CheckName[], excludePatterns: string[]): void {
  const results: CheckResult[] = [];

  // Run each check with noExit option and exclude patterns
  for (const checkName of checks) {
    const runCheck = CHECK_RUNNERS[checkName];
    const result = runCheck({ noExit: true, excludePatterns });

    if (result) {
      results.push(result);
    }
  }

  // Print minimal LLM-optimized output
  printMinimalOutput(results);

  // Exit with appropriate code
  const hasFailures = results.some(r => !r.passed);
  process.exit(hasFailures ? 1 : 0);
}

/**
 * Print minimal LLM-optimized output format
 */
function printMinimalOutput(results: CheckResult[]): void {
  const failedChecks = results.filter(r => !r.passed);
  const totalViolations = results.reduce((sum, r) => sum + r.violationCount, 0);

  // Success case: single line
  if (failedChecks.length === 0) {
    console.log('✓ All checks passed');
    return;
  }

  // Failure case: summary + violations + fixes
  const checkWord = failedChecks.length === 1 ? 'check' : 'checks';
  const violationWord = totalViolations === 1 ? 'violation' : 'violations';
  console.log(`✗ ${failedChecks.length} ${checkWord} failed (${totalViolations} ${violationWord})`);
  console.log('');

  // Print each failed check's violations and fix
  failedChecks.forEach((result) => {
    // Print violations
    console.log(`${result.checkName} (${result.violationCount}):`);
    result.violations.forEach((violation) => {
      const location = violation.line
        ? `${violation.file}:${violation.line}`
        : violation.file;
      console.log(`  ${location}: ${violation.message}`);
    });
    console.log('');

    // Print fix instructions
    console.log('Fix: ' + result.howToFix[0]);
    result.howToFix.slice(1).forEach((fix) => {
      console.log('     ' + fix);
    });
    // Add suppress instruction as last line
    console.log('     ' + result.suppressInstruction);
    console.log('');
  });
}

/**
 * Main CLI function
 */
function main(): void {
  const { checks, help, excludePatterns } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  // Check for tsconfig.json
  checkTsConfigExists();

  // Run checks
  runChecks(checks, excludePatterns);
}

// Run CLI
main();
