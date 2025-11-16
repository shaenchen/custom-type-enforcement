import * as fs from 'fs';
import * as path from 'path';
import { getTypeScriptFiles } from '../lib/get-typescript-files.js';
import { Formatter } from '../lib/formatter.js';
import type { CheckOptions, CheckResult } from '../types.js';

/**
 * Check 4: Type Import Architecture
 *
 * Enforces that type imports only come from types.ts or types/{domain}.ts files.
 *
 * Rules:
 * ✅ Allowed:
 *   - Import types from types.ts files
 *   - Import types from types/{domain}.ts files
 *   - Import types from external packages (npm)
 *
 * ❌ Forbidden:
 *   - Import types from non-types files
 *   - Import types from implementation files
 *
 * @param options - Check options including format and noExit flag
 * @returns CheckResult if noExit is true, otherwise exits the process
 */
export function runTypeImportsCheck(options?: CheckOptions): CheckResult | void {
  const formatter = new Formatter('Type Import Architecture');

  formatter.start();

  const files = getTypeScriptFiles({ projectRoot: options?.projectRoot });

  if (!files) {
    formatter.addViolation({
      file: 'tsconfig.json',
      message: 'No tsconfig.json found in project root',
      severity: 'CRITICAL',
    });
    const exitCode = formatter.finish({
      blocking: true,
      exitCode: 1,
      noExit: options?.noExit,
      howToFix: [
        'Create a tsconfig.json in your project root',
        'Ensure the file is valid JSON',
      ],
    });

    if (options?.noExit) {
      return {
        checkName: 'type-imports',
        passed: false,
        violationCount: 1,
        exitCode,
        violations: formatter.getViolations().map(v => ({
          file: v.file,
          line: v.line,
          message: v.message ?? 'Violation detected',
        })),
        howToFix: [
          'Create a tsconfig.json in your project root',
          'Ensure the file is valid JSON',
        ],
        suppressInstruction: 'To suppress: Add // @type-import-allowed comment on same line or line above',
      };
    }
    return;
  }

  let violationCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNumber = i + 1;

      // Get previous line for ignore flag checking
      const prevLine = i > 0 ? (lines[i - 1] ?? '') : '';

      // Skip if ignore flag is present
      if (hasIgnoreFlag(line, prevLine)) {
        continue;
      }

      // Detect type imports:
      // 1. import type { X } syntax
      // 2. import { type Foo, type Bar } syntax
      // 3. import { type Foo, regularImport } mixed syntax

      const typeImportMatch = line.match(/import\s+type\s*\{[^}]+\}\s*from\s*['"]([^'"]+)['"]/);
      const inlineTypeImportMatch = line.match(/import\s*\{[^}]*\btype\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/);

      const importPath = typeImportMatch?.[1] ?? inlineTypeImportMatch?.[1];

      if (importPath) {
        // Check if this is a valid type import source
        if (!isValidTypeImportSource(importPath)) {
          violationCount++;
          formatter.addViolation({
            file: path.relative(process.cwd(), file),
            line: lineNumber,
            content: line.trim(),
            message: `Type imported from non-types file: ${importPath}`,
            severity: 'HIGH',
            reason: 'Types should only be imported from types.ts or types/{domain}.ts files',
          });
        }
      }
    }
  }

  const exitCode = formatter.finish({
    blocking: violationCount > 0,
    exitCode: violationCount > 0 ? 1 : 0,
    noExit: options?.noExit,
    howToFix: violationCount > 0 ? [
      'Move type definitions to types.ts files',
      'Use types/{domain}.ts for domain-specific types',
      'Import types only from types.ts or types/{domain}.ts files',
      'For shared types, export from a centralized types.ts',
      'Use // @type-import-allowed to suppress false positives (on same line or line above)',
    ] : [],
    whyItMatters: violationCount > 0 ? [
      'Enforces consistent type organization',
      'Makes type definitions easier to find',
      'Prevents tight coupling between implementation files',
      'Improves code maintainability and refactoring',
    ] : [],
  });

  if (options?.noExit) {
    return {
      checkName: 'type-imports',
      passed: exitCode === 0,
      violationCount: formatter.getViolationCount(),
      exitCode,
      violations: formatter.getViolations().map(v => ({
        file: v.file,
        line: v.line,
        message: v.message ?? 'Violation detected',
      })),
      howToFix: [
        'Move type definitions to types.ts files',
        'Use types/{domain}.ts for domain-specific types',
        'Import types only from types.ts or types/{domain}.ts files',
        'For shared types, export from a centralized types.ts',
      ],
      suppressInstruction: 'To suppress: Add // @type-import-allowed comment on same line or line above',
    };
  }
}

/**
 * Check if a line or previous line has the ignore flag
 */
function hasIgnoreFlag(line: string, prevLine: string): boolean {
  return (
    line.includes('// @type-import-allowed') ||
    prevLine.includes('// @type-import-allowed')
  );
}

/**
 * Check if an import path is a valid source for type imports.
 *
 * Valid sources:
 * - External packages (don't start with . or /)
 * - Files ending with /types or /types.js
 * - Files containing /types/ in the path
 *
 * @param importPath - The import path to validate
 * @returns true if valid, false otherwise
 */
function isValidTypeImportSource(importPath: string): boolean {
  // External package imports are always allowed (e.g., 'react', '@types/node')
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return true;
  }

  // Normalize path (remove .js, .ts extensions if present)
  const normalizedPath = importPath.replace(/\.(js|ts)$/, '');

  // Check if path ends with /types (e.g., './types', '../shared/types')
  if (normalizedPath.endsWith('/types')) {
    return true;
  }

  // Check if path contains /types/ (e.g., './types/user', '../types/api')
  if (normalizedPath.includes('/types/')) {
    return true;
  }

  // Check if path ends with types.js or types.ts (already normalized, so just check 'types')
  if (normalizedPath.endsWith('types')) {
    return true;
  }

  // All other relative imports are invalid
  return false;
}
