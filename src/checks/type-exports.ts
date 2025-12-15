/**
 * Check that types/interfaces/enums are only exported from types.ts files
 */

import * as fs from 'fs';
import * as path from 'path';
import { Formatter } from '../lib/formatter.js';
import { getTypeScriptFiles, globToRegex } from '../lib/get-typescript-files.js';
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
 * Patterns for runtime schema libraries that should be allowed as const exports
 * These are functional runtime validators, not type definitions
 */
const SCHEMA_LIBRARY_PATTERNS = [
  // TypeBox patterns: Type.Object(), Type.String(), Type.Array(), etc.
  /=\s*Type\.\w+\s*\(/,
  // Zod patterns: z.object(), z.string(), z.enum(), etc.
  /=\s*z\.\w+\s*\(/,
];

/**
 * Patterns for schema initializers on their own line (for multi-line detection)
 * These patterns don't require the = prefix since they appear on continuation lines
 */
const SCHEMA_INITIALIZER_PATTERNS = [
  // TypeBox: Type.Object(), Type.String(), etc.
  /^\s*Type\.\w+\s*\(/,
  // Zod: z.object(), z.string(), etc.
  /^\s*z\.\w+\s*\(/,
];

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
 * Check if an object literal contains only identifier values (function references).
 * Matches patterns like: { fn1, fn2 } or { fn1: fn1, fn2: fn2 }
 * Does NOT match if any value is a literal (string, number, boolean, null, array, object).
 */
function isObjectWithIdentifierOnlyValues(content: string): boolean {
  // Extract content between first { and last }
  const startIdx = content.indexOf('{');
  const endIdx = content.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return false;
  }

  const objectContent = content.slice(startIdx + 1, endIdx).trim();
  if (objectContent === '') {
    return false;
  }

  // Check for literal values that would disqualify this as identifier-only
  // String literals: 'value' or "value"
  if (/['"]/.test(objectContent)) {
    return false;
  }

  // Number literals as values: : 123 or : -123 or : 1.5
  if (/:\s*-?\d/.test(objectContent)) {
    return false;
  }

  // Boolean/null literals: : true, : false, : null
  if (/:\s*(true|false|null)\b/.test(objectContent)) {
    return false;
  }

  // Array literals as values: : [
  if (/:\s*\[/.test(objectContent)) {
    return false;
  }

  // Nested object literals as values: : {
  if (/:\s*\{/.test(objectContent)) {
    return false;
  }

  // Now check if we have valid identifier patterns
  // Shorthand properties: identifier, or identifier}
  // Explicit properties: key: identifier
  const hasShorthandProperty = /(?:^|[,{])\s*[a-zA-Z_$][\w$]*\s*(?:[,}]|$)/m.test(objectContent);
  const hasExplicitIdentifierValue = /:\s*[a-zA-Z_$][\w$]*\s*[,}]/m.test(objectContent);

  return hasShorthandProperty || hasExplicitIdentifierValue;
}

/**
 * Check if a const export is a runtime value (not a type-like constant).
 * Runtime values include:
 * - Function call initializers: someFunc(...), obj.method(...)
 * - new expressions: new SomeClass(...)
 * - Object/array literals containing non-literal values (identifiers, property access)
 *
 * Type-like constants that should still be flagged:
 * - Pure literal values: 'string', 123, true, null
 * - Object/array literals containing only literals: { a: 1, b: 'x' }, ['one', 'two']
 */
function isRuntimeConstExport(line: string, nextLines: string[]): boolean {
  // Check for new expression: export const x = new SomeClass(...)
  if (/export\s+const\s+\w+\s*[:=].*\bnew\s+[A-Z]/.test(line)) {
    return true;
  }

  // Check for function/method call initializer: export const x = someFunc(...)
  // Pattern: = identifier( or = identifier.method(
  // But NOT arrow functions (handled separately) or pure literals
  const funcCallMatch = /export\s+const\s+\w+\s*[:=]\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*\(/.exec(
    line
  );
  if (funcCallMatch) {
    const identifier = funcCallMatch[1];
    // Skip if it's a known literal constructor (these create type-like values)
    const literalConstructors = ['String', 'Number', 'Boolean', 'Array', 'Object'];
    if (!literalConstructors.includes(identifier)) {
      // Make sure it's not an arrow function (which would have => later)
      if (!line.includes('=>')) {
        // Check next lines for => to rule out multi-line arrow functions
        let hasArrow = false;
        for (let i = 0; i < Math.min(5, nextLines.length); i++) {
          if (nextLines[i].includes('=>')) {
            hasArrow = true;
            break;
          }
          if (nextLines[i].includes(';') || /^\s*export\s/.test(nextLines[i])) {
            break;
          }
        }
        if (!hasArrow) {
          return true;
        }
      }
    }
  }

  // Check for object/array literals with runtime values
  // Look for patterns like: = { key: IDENTIFIER } or = { key: obj.prop }
  // where IDENTIFIER is not a string/number/boolean literal

  // First, check if this is an object or array literal initializer
  const objectLiteralMatch = /export\s+const\s+\w+\s*[:=]\s*\{/.test(line);
  const arrayLiteralMatch = /export\s+const\s+\w+\s*[:=]\s*\[/.test(line);

  if (objectLiteralMatch || arrayLiteralMatch) {
    // Gather all lines until we close the object/array
    const allLines = [line, ...nextLines.slice(0, 20)];
    const content = allLines.join('\n');

    // Extract just the object/array content (simplified heuristic)
    // Look for patterns that indicate runtime values:

    // Pattern 1: Property access like process.env.FOO or config.value
    if (/[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*/.test(content)) {
      // But exclude Type.String(), z.object() etc. which are schema patterns
      if (
        !/Type\.\w+\s*\(/.test(content) &&
        !/z\.\w+\s*\(/.test(content)
      ) {
        // Check if the property access is a VALUE (not a key or type annotation)
        // Look for patterns like: key: identifier.property or : identifier.property,
        // Handle multiple property accesses like process.env.PORT
        if (/:\s*[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+[\s,}\]]/.test(content)) {
          return true;
        }
      }
    }

    // Pattern 2: Uppercase identifiers as values (likely constants/env vars)
    // Like: { url: REDIS_URL } or { key: API_KEY }
    // Match: colonOrEquals UPPER_CASE_IDENTIFIER commaOrBraceOrBracket
    if (/:\s*[A-Z][A-Z0-9_]+[\s,}\]]/.test(content)) {
      return true;
    }

    // Pattern 3: Function calls inside object/array (not schema library calls)
    // Like: { value: getValue() } or { items: fetchItems() }
    if (/:\s*[a-zA-Z_$][\w$]*\s*\(/.test(content)) {
      // Exclude Type.* and z.* schema patterns
      if (!/:\s*Type\.\w+\s*\(/.test(content) && !/:\s*z\.\w+\s*\(/.test(content)) {
        return true;
      }
    }

    // Pattern 4: Template literals (contain runtime expressions)
    if (/`[^`]*\$\{/.test(content)) {
      return true;
    }

    // Pattern 5: Spread operator (indicates dynamic content)
    if (/\.\.\./.test(content)) {
      return true;
    }

    // Pattern 6: Object with identifier-only values (function references)
    // Like: { fn1, fn2 } or { fn1: fn1, fn2: fn2 }
    // These are typically test exports or function collections
    if (objectLiteralMatch) {
      if (isObjectWithIdentifierOnlyValues(content)) {
        return true;
      }
    }
  }

  // Check for multi-line scenarios where the value is on the next line
  if (/export\s+const\s+\w+\s*[:=]\s*$/.test(line.trimEnd())) {
    // The value is on the next line(s)
    for (let i = 0; i < Math.min(3, nextLines.length); i++) {
      const nextLine = nextLines[i].trim();
      if (nextLine === '') continue;

      // Check if next line starts with new expression
      if (/^new\s+[A-Z]/.test(nextLine)) {
        return true;
      }

      // Check if next line is a function call
      if (/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*\s*\(/.test(nextLine)) {
        // Exclude Type.* and z.* schema patterns (handled separately)
        if (!/^Type\.\w+\s*\(/.test(nextLine) && !/^z\.\w+\s*\(/.test(nextLine)) {
          return true;
        }
      }
      break;
    }
  }

  return false;
}

/**
 * Check if a const export is a runtime schema (TypeBox, Zod, etc.)
 * These are functional runtime validators, not type definitions
 */
function isSchemaConstExport(line: string, nextLines: string[]): boolean {
  // Check if the line itself contains a schema pattern (= Type.Object(...) or = z.object(...))
  if (SCHEMA_LIBRARY_PATTERNS.some((pattern) => pattern.test(line))) {
    return true;
  }

  // Check multi-line schema definitions:
  // export const FooSchema: TSchema =
  //   Type.Object({
  //     ...
  //   });
  if (/export\s+const\s+\w+\s*[:=]/.test(line)) {
    // Look ahead to see if we find a schema initializer on its own line
    for (let i = 0; i < Math.min(5, nextLines.length); i++) {
      // Check for schema pattern with = prefix (same-line continuation)
      if (SCHEMA_LIBRARY_PATTERNS.some((pattern) => pattern.test(nextLines[i]))) {
        return true;
      }
      // Check for schema initializer on its own line (multi-line case)
      if (SCHEMA_INITIALIZER_PATTERNS.some((pattern) => pattern.test(nextLines[i]))) {
        return true;
      }
      // Stop if we hit a semicolon ending a statement or another export
      if (nextLines[i].includes(';') && !nextLines[i].includes('{')) {
        break;
      }
      if (/^\s*export\s/.test(nextLines[i])) {
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

  // Files in types/ directory can export anything - skip all checks for them
  const isInTypesDir = path.normalize(filePath).includes(`${path.sep}types${path.sep}`);
  if (isInTypesDir) {
    // Only check for type re-export anti-pattern (discouraged everywhere)
    lines.forEach((line, index) => {
      if (isCommentOrWhitespace(line)) {
        return;
      }
      const prevLine = index > 0 ? lines[index - 1] : '';
      if (hasIgnoreFlag(line, prevLine)) {
        return;
      }
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
      }
    });
    return violations;
  }

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
      // Skip if it's a functional export (arrow function, class, etc.)
      if (isConstExportFunctional(line, nextLines)) {
        return;
      }
      // Skip if it's a schema library export (TypeBox, Zod, etc.)
      if (isSchemaConstExport(line, nextLines)) {
        return;
      }
      // Skip if it's a runtime constant (function call, new expression, non-literal object)
      if (isRuntimeConstExport(line, nextLines)) {
        return;
      }
      violations.push({
        file: filePath,
        line: index + 1,
        type: 'Non-Functional Constant Export',
        severity: 'MEDIUM',
        content: line.trim(),
        message: 'Non-functional constants (primitives, objects, arrays) should be exported from types.ts files',
      });
    }
  });

  return violations;
}

/**
 * Check if a file path matches any of the allow-exports patterns
 * @param filePath - Absolute file path to check
 * @param patterns - Glob patterns to match against
 * @param projectRoot - Project root directory for relative path calculation
 * @returns true if the file matches any pattern
 */
function matchesAllowExportsPattern(
  filePath: string,
  patterns: string[],
  projectRoot: string
): boolean {
  if (patterns.length === 0) {
    return false;
  }

  const relativePath = path.relative(projectRoot, filePath);
  const allowExportsRegexes = patterns.map((p) => globToRegex(p));

  return allowExportsRegexes.some((regex) => regex.test(relativePath));
}

/**
 * Run the type exports check
 * @param options - Check options including format and noExit flag
 * @returns CheckResult if noExit is true, otherwise exits the process
 */
export function runTypeExportsCheck(options: CheckOptions = {}): CheckResult | void {
  const formatter = new Formatter('Type Export Architecture');
  formatter.start();

  const projectRoot = options.projectRoot ?? process.cwd();
  const allowExportsPatterns = options.allowExportsPatterns ?? [];

  // Get all TypeScript files
  const files = getTypeScriptFiles({
    projectRoot,
    excludePatterns: options.excludePatterns,
  });

  if (files === null) {
    // This should be handled by the CLI, but just in case
    console.error('❌ ERROR: No tsconfig.json found in current directory\n');
    process.exit(1);
  }

  // Scan each file (skip files matching --allow-exports patterns)
  files.forEach((file) => {
    // Skip files that match allow-exports patterns
    if (matchesAllowExportsPattern(file, allowExportsPatterns, projectRoot)) {
      return;
    }

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
      'Files in types/ directories can export anything (types, type guards, constants)',
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
        'Files in types/ directories can export anything (types, type guards, constants)',
        'Import directly from types.ts for type definitions',
      ],
      suppressInstruction: 'To suppress: Add // @type-export-allowed comment on same line or line above',
    };
  }
}
