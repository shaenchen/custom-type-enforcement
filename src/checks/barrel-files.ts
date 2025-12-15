/**
 * Check for pure barrel files (files that only re-export from other files)
 */

import * as fs from 'fs';
import { Formatter } from '../lib/formatter.js';
import { getTypeScriptFiles } from '../lib/get-typescript-files.js';
import type { Violation } from '../lib/types.js';
import type { CheckResult, CheckOptions } from '../types.js';

/**
 * Patterns for export statements (barrel file indicators)
 */
const EXPORT_PATTERNS = [
  /^\s*export\s+\{\s*[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/,  // export { ... } from '...'
  /^\s*export\s+\*\s+from\s+['"][^'"]+['"]\s*;?\s*$/,            // export * from '...'
  /^\s*export\s+type\s+\{\s*[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/,  // export type { ... } from '...'
  /^\s*export\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"]\s*;?\s*$/,  // export * as foo from '...'
];

/**
 * Check if a line is a comment or whitespace
 */
function isCommentOrWhitespace(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === '' ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.endsWith('*/') ||
    // Handle lines that are only part of a multi-line comment
    /^[\s*]*$/.test(trimmed)
  );
}

/**
 * Check if a line is an export statement
 */
function isExportStatement(line: string): boolean {
  return EXPORT_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Check if a file has the barrel-file-allowed comment
 */
function hasBarrelFileAllowedComment(content: string): boolean {
  return (
    content.includes('// @barrel-file-allowed') ||
    content.includes('/* @barrel-file-allowed */')
  );
}

/**
 * Check if a file is a pure barrel file
 */
function isPureBarrelFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for allow comment
  if (hasBarrelFileAllowedComment(content)) {
    return false;
  }

  const lines = content.split('\n');
  let hasExports = false;
  let hasNonBarrelCode = false;

  for (const line of lines) {
    // Skip comments and whitespace
    if (isCommentOrWhitespace(line)) {
      continue;
    }

    // Check if it's an export statement
    if (isExportStatement(line)) {
      hasExports = true;
      continue;
    }

    // Check for import statements (these are OK in barrel files)
    const trimmed = line.trim();
    if (trimmed.startsWith('import ')) {
      continue;
    }

    // If we found any other code, it's not a pure barrel file
    hasNonBarrelCode = true;
    break;
  }

  // It's a barrel file if it has exports but no other code
  return hasExports && !hasNonBarrelCode;
}

/**
 * Scan files for barrel file violations
 */
function scanForBarrelFiles(files: string[]): Violation[] {
  const violations: Violation[] = [];

  files.forEach((file) => {
    if (isPureBarrelFile(file)) {
      violations.push({
        file,
        type: 'Pure Barrel File',
        severity: 'HIGH',
        message: 'File only contains re-exports without actual implementation',
        reason: 'Barrel files can cause circular dependencies, hinder tree-shaking, and make code navigation harder',
      });
    }
  });

  return violations;
}

/**
 * Run the barrel files check
 * @param options - Check options including format and noExit flag
 * @returns CheckResult if noExit is true, otherwise exits the process
 */
export function runBarrelFilesCheck(options: CheckOptions = {}): CheckResult | void {
  const formatter = new Formatter('Barrel Files');
  formatter.start();

  // Get all TypeScript files
  const files = getTypeScriptFiles({
    projectRoot: options.projectRoot,
    excludePatterns: options.excludePatterns,
  });

  if (files === null) {
    // This should be handled by the CLI, but just in case
    console.error('❌ ERROR: No tsconfig.json found in current directory\n');
    process.exit(1);
  }

  // Scan for barrel files
  const violations = scanForBarrelFiles(files);
  violations.forEach((violation) => formatter.addViolation(violation));

  // Finish and either exit or return result
  const exitCode = formatter.finish({
    blocking: true,
    noExit: options.noExit,
    howToFix: [
      'Move actual implementation code into the barrel file',
      'Import directly from the source file instead of the barrel',
      'If truly needed, add: // @barrel-file-allowed',
      'Consider consolidating related functionality into fewer, more meaningful modules',
    ],
    whyItMatters: [
      'Makes dependencies explicit and easier to track',
      'Prevents circular dependency issues',
      'Improves tree-shaking and bundle optimization',
      'Clearer code navigation and IDE performance',
      'Reduces unnecessary indirection in the codebase',
    ],
  });

  if (options.noExit) {
    return {
      checkName: 'barrel-files',
      passed: exitCode === 0,
      violationCount: formatter.getViolationCount(),
      exitCode,
      violations: formatter.getViolations().map(v => ({
        file: v.file,
        line: v.line,
        message: v.message ?? v.type ?? 'Violation detected',
      })),
      howToFix: [
        'Add actual implementation code to files with re-exports',
        'Import directly from source files instead of through barrel files',
        'Consider consolidating related functionality into fewer, more meaningful modules',
      ],
      suppressInstruction: 'To suppress: Add // @barrel-file-allowed comment anywhere in file',
    };
  }
}
