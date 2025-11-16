/**
 * Check that types/interfaces/enums are only exported from types.ts files
 */

import * as fs from 'fs';
import * as path from 'path';
import { Formatter } from '../lib/formatter.js';
import { getTypeScriptFiles } from '../lib/get-typescript-files.js';
import type { Violation } from '../lib/types.js';
import type { CheckResult, CheckOptions } from '../types.js';

/**
 * Patterns for type exports
 */
const TYPE_EXPORT_PATTERNS = [
  /^\s*export\s+type\s+\w+/,           // export type Foo
  /^\s*export\s+interface\s+\w+/,      // export interface Foo
  /^\s*export\s+enum\s+\w+/,           // export enum Foo
];

/**
 * Pattern for re-exported types (discouraged everywhere)
 */
const TYPE_RE_EXPORT_PATTERN = /^\s*export\s+type\s+\*\s+from/;

/**
 * Pattern for export with type modifier in braces
 */
const EXPORT_TYPE_BRACES_PATTERN = /^\s*export\s+\{\s*type\s+/;  // export { type Foo }
const EXPORT_BRACES_TYPE_PATTERN = /^\s*export\s+type\s+\{/;     // export type { Foo }

/**
 * Pattern for const exports (need to check if functional)
 */
const CONST_EXPORT_PATTERN = /^\s*export\s+const\s+(\w+)\s*[:=]/;

/**
 * Check if a file path is a valid types file
 */
function isTypesFile(filePath: string): boolean {
  const normalized = path.normalize(filePath);

  // Check if file ends with types.ts
  if (normalized.endsWith('types.ts')) {
    return true;
  }

  // Check if file is inside a types/ directory
  if (normalized.includes(`${path.sep}types${path.sep}`)) {
    return true;
  }

  return false;
}

/**
 * Check if a const export is functional (arrow function, function expression, or class)
 */
function isConstExportFunctional(line: string, nextLines: string[]): boolean {
  // Check for arrow function: export const foo = () => ...
  if (/export\s+const\s+\w+\s*=\s*(\([^)]*\)|[^=]+)\s*=>/.test(line)) {
    return true;
  }

  // Check for function expression: export const foo = function
  if (/export\s+const\s+\w+\s*=\s*function/.test(line)) {
    return true;
  }

  // Check for class expression: export const foo = class
  if (/export\s+const\s+\w+\s*=\s*class/.test(line)) {
    return true;
  }

  // Check for async arrow function: export const foo = async () => ...
  if (/export\s+const\s+\w+\s*=\s*async\s+(\([^)]*\)|[^=]+)\s*=>/.test(line)) {
    return true;
  }

  // Check multi-line arrow functions by looking at next lines
  // export const foo = (
  //   args
  // ) => ...
  if (/export\s+const\s+\w+\s*=\s*\(/.test(line)) {
    // Look ahead to see if we find '=>'
    for (let i = 0; i < Math.min(10, nextLines.length); i++) {
      if (nextLines[i].includes('=>')) {
        return true;
      }
      // Stop if we hit a semicolon or another export
      if (nextLines[i].includes(';') || nextLines[i].includes('export')) {
        break;
      }
    }
  }

  return false;
}

/**
 * Check if a line has type export in braces
 */
function hasTypeExportInBraces(line: string): boolean {
  return EXPORT_TYPE_BRACES_PATTERN.test(line) || EXPORT_BRACES_TYPE_PATTERN.test(line);
}

/**
 * Check if a line is a type re-export (anti-pattern)
 */
function isTypeReExport(line: string): boolean {
  return TYPE_RE_EXPORT_PATTERN.test(line);
}

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
    /^[\s*]*$/.test(trimmed)
  );
}

/**
 * Check if a line or previous line has the ignore flag
 */
function hasIgnoreFlag(line: string, prevLine: string): boolean {
  return (
    line.includes('// @type-export-allowed') ||
    prevLine.includes('// @type-export-allowed')
  );
}

/**
 * Scan a file for type export violations
 */
function scanFileForTypeExports(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const isValidTypesFile = isTypesFile(filePath);

  // Check if file is in types/ directory but has functional code
  const isInTypesDir = path.normalize(filePath).includes(`${path.sep}types${path.sep}`);

  lines.forEach((line, index) => {
    // Skip comments and whitespace
    if (isCommentOrWhitespace(line)) {
      return;
    }

    // Get previous line for ignore flag checking
    const prevLine = index > 0 ? lines[index - 1] : '';

    // Skip if ignore flag is present
    if (hasIgnoreFlag(line, prevLine)) {
      return;
    }

    // Check for type re-export anti-pattern (discouraged everywhere)
    if (isTypeReExport(line)) {
      violations.push({
        file: filePath,
        line: index + 1,
        type: 'Type Re-Export Anti-Pattern',
        severity: 'HIGH',
        content: line.trim(),
        message: 'export type * from ... pattern is discouraged',
        reason: 'Type re-exports make it harder to track type origins and can cause circular dependencies',
      });
      return;
    }

    // Check for type/interface/enum exports from non-types files
    const hasTypeExport = TYPE_EXPORT_PATTERNS.some((pattern) => pattern.test(line));
    if (hasTypeExport && !isValidTypesFile) {
      violations.push({
        file: filePath,
        line: index + 1,
        type: 'Type Export from Non-Types File',
        severity: 'HIGH',
        content: line.trim(),
        message: 'Types/interfaces/enums should only be exported from types.ts or types/*.ts files',
      });
      return;
    }

    // Check for export { type Foo } or export type { Foo } from non-types files
    if (hasTypeExportInBraces(line) && !isValidTypesFile) {
      violations.push({
        file: filePath,
        line: index + 1,
        type: 'Type Export from Non-Types File',
        severity: 'HIGH',
        content: line.trim(),
        message: 'Type exports should only be from types.ts or types/*.ts files',
      });
      return;
    }

    // Check for non-functional const exports from non-types files
    const constMatch = CONST_EXPORT_PATTERN.exec(line);
    if (constMatch && !isValidTypesFile) {
      const nextLines = lines.slice(index + 1);
      if (!isConstExportFunctional(line, nextLines)) {
        violations.push({
          file: filePath,
          line: index + 1,
          type: 'Non-Functional Constant Export',
          severity: 'MEDIUM',
          content: line.trim(),
          message: 'Non-functional constants (primitives, objects, arrays) should be exported from types.ts files',
        });
      }
    }

    // Check for functional code exports from types/ directory
    if (isInTypesDir && isValidTypesFile) {
      // Check for function exports
      if (/^\s*export\s+(async\s+)?function\s+\w+/.test(line)) {
        violations.push({
          file: filePath,
          line: index + 1,
          type: 'Functional Export from Types Directory',
          severity: 'HIGH',
          content: line.trim(),
          message: 'Files in types/ directory should only export types, not functional code',
        });
        return;
      }

      // Check for class exports
      if (/^\s*export\s+(abstract\s+)?class\s+\w+/.test(line)) {
        violations.push({
          file: filePath,
          line: index + 1,
          type: 'Functional Export from Types Directory',
          severity: 'HIGH',
          content: line.trim(),
          message: 'Files in types/ directory should only export types, not classes',
        });
        return;
      }

      // Check for functional const exports
      const constMatch = CONST_EXPORT_PATTERN.exec(line);
      if (constMatch) {
        const nextLines = lines.slice(index + 1);
        if (isConstExportFunctional(line, nextLines)) {
          violations.push({
            file: filePath,
            line: index + 1,
            type: 'Functional Export from Types Directory',
            severity: 'HIGH',
            content: line.trim(),
            message: 'Files in types/ directory should only export types, not functions',
          });
        }
      }
    }
  });

  return violations;
}

/**
 * Run the type exports check
 * @param options - Check options including format and noExit flag
 * @returns CheckResult if noExit is true, otherwise exits the process
 */
export function runTypeExportsCheck(options: CheckOptions = {}): CheckResult | void {
  const formatter = new Formatter('Type Export Architecture');
  formatter.start();

  // Get all TypeScript files
  const files = getTypeScriptFiles({ projectRoot: options.projectRoot });

  if (files === null) {
    // This should be handled by the CLI, but just in case
    console.error('❌ ERROR: No tsconfig.json found in current directory\n');
    process.exit(1);
  }

  // Scan each file
  files.forEach((file) => {
    const violations = scanFileForTypeExports(file);
    violations.forEach((violation) => formatter.addViolation(violation));
  });

  // Finish and either exit or return result
  const exitCode = formatter.finish({
    blocking: true,
    noExit: options.noExit,
    howToFix: [
      'Move type/interface/enum exports to types.ts or types/{domain}.ts files',
      'Keep functional exports (functions, classes) in implementation files',
      'Use type composition (Pick, Omit, &) to create variations of types',
      'Export only types/interfaces/enums from files in types/ directories',
      'Import directly from types.ts for type definitions',
      'Use // @type-export-allowed to suppress false positives (on same line or line above)',
    ],
    whyItMatters: [
      'Centralizes type definitions for easier discovery and maintenance',
      'Prevents circular dependencies between implementation files',
      'Makes the codebase architecture clearer and more maintainable',
      'Improves IDE performance with better type organization',
      'Separates type contracts from implementation details',
    ],
  });

  if (options.noExit) {
    return {
      checkName: 'type-exports',
      passed: exitCode === 0,
      violationCount: formatter.getViolationCount(),
      exitCode,
      violations: formatter.getViolations().map(v => ({
        file: v.file,
        line: v.line,
        message: v.message ?? v.type ?? 'Violation detected',
      })),
      howToFix: [
        'Move type/interface/enum exports to types.ts or types/{domain}.ts files',
        'Keep functional exports (functions, classes) in implementation files',
        'Use type composition (Pick, Omit, &) to create variations of types',
        'Export only types/interfaces/enums from files in types/ directories',
        'Import directly from types.ts for type definitions',
      ],
      suppressInstruction: 'To suppress: Add // @type-export-allowed comment on same line or line above',
    };
  }
}
