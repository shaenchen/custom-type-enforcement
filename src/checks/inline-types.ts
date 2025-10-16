import * as fs from 'fs';
import * as path from 'path';
import { getTypeScriptFiles } from '../lib/get-typescript-files.js';
import { Formatter } from '../lib/formatter.js';
import type { CheckOptions, CheckResult } from '../types.js';

interface InlineTypeViolation {
  file: string;
  line: number;
  content: string;
  context: string;
}

/**
 * Detects inline object types in a TypeScript file
 */
function detectInlineTypes(filePath: string): InlineTypeViolation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: InlineTypeViolation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip lines with @inline-type-ok comment (same line or previous line)
    const prevLine = i > 0 ? lines[i - 1] : '';
    if (line.includes('// @inline-type-ok') || prevLine.includes('// @inline-type-ok')) {
      continue;
    }

    // Skip generic constraints: <T extends { ... }>
    if (trimmedLine.includes('extends {')) {
      continue;
    }

    // Skip mapped types: { [P in keyof T]: ... }
    if (trimmedLine.match(/\{\s*\[.*\s+in\s+/)) {
      continue;
    }

    // Skip conditional types: T extends U ? X : Y
    if (trimmedLine.includes('?') && trimmedLine.includes(':') && trimmedLine.includes('extends')) {
      continue;
    }

    // Skip type/interface declarations (these are named types)
    if (trimmedLine.match(/^(export\s+)?(type|interface)\s+\w+/)) {
      continue;
    }

    // Detect type assertions (as with inline object)
    const asMatch = line.match(/\s+as\s+\{/);
    if (asMatch) {
      violations.push({
        file: filePath,
        line: i + 1,
        content: trimmedLine,
        context: 'Type assertion',
      });
      continue;
    }

    // Detect variable declarations with inline object types
    // Also covers let, var
    const varMatch = line.match(/(?:const|let|var)\s+\w+\s*:\s*\{/);
    if (varMatch) {
      violations.push({
        file: filePath,
        line: i + 1,
        content: trimmedLine,
        context: 'Variable declaration',
      });
      continue;
    }

    // Detect function parameters with inline object types
    // Also covers arrow functions
    const paramMatch = line.match(/\(\s*\w+\s*:\s*\{/);
    if (paramMatch) {
      violations.push({
        file: filePath,
        line: i + 1,
        content: trimmedLine,
        context: 'Function parameter',
      });
      continue;
    }

    // Detect return types: ): { ... }
    // Look for closing paren followed by colon and opening brace
    const returnMatch = line.match(/\)\s*:\s*\{/);
    if (returnMatch) {
      // Make sure it's not a method call like foo(): { bar: 123 }
      // Return types typically have => or { on the same or next line
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const hasArrowOrBrace = line.includes('=>') || line.includes('=> {') || nextLine.startsWith('{');

      if (hasArrowOrBrace || line.includes('function')) {
        violations.push({
          file: filePath,
          line: i + 1,
          content: trimmedLine,
          context: 'Return type',
        });
      }
      continue;
    }

    // Detect object property types: prop: { ... }
    // Detect violations in class properties, but not in interface/type definitions
    const propMatch = line.match(/^\s+\w+\s*:\s*\{/);
    if (propMatch) {
      // Check if we're in a class, interface, or type context
      // Look backwards to find context
      let inClass = false;
      let inInterfaceOrType = false;
      for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
        const prevLine = lines[j];
        if (prevLine.match(/^(export\s+)?class\s+\w+/)) {
          inClass = true;
          break;
        }
        if (prevLine.match(/^(export\s+)?(interface|type)\s+\w+/)) {
          inInterfaceOrType = true;
          break;
        }
      }

      // Only report violation if in a class (not in interface/type definitions)
      if (inClass && !inInterfaceOrType) {
        violations.push({
          file: filePath,
          line: i + 1,
          content: trimmedLine,
          context: 'Property type',
        });
      }
    }
  }

  return violations;
}

/**
 * Runs the inline types check
 * @param options - Check options including format and noExit flag
 * @returns CheckResult if noExit is true, otherwise exits the process
 */
export function runInlineTypesCheck(options: CheckOptions = {}): CheckResult | void {
  const formatter = new Formatter('Inline Types', { format: options.format });
  formatter.start();

  // Get all TypeScript files
  const files = getTypeScriptFiles({ projectRoot: options.projectRoot });
  if (!files || files.length === 0) {
    const exitCode = formatter.finish({
      blocking: true,
      exitCode: 0,
      noExit: options.noExit,
      whyItMatters: [
        'Named types provide better error messages',
        'Types become more searchable and refactorable',
        'Self-documenting code (type name explains intent)',
        'Easier to reuse types across the codebase',
      ],
    });

    if (options.noExit) {
      return {
        checkName: 'inline-types',
        passed: true,
        violationCount: 0,
        exitCode,
      };
    }
    return;
  }

  // Check each file for inline types
  const allViolations: InlineTypeViolation[] = [];
  for (const file of files) {
    const violations = detectInlineTypes(file);
    allViolations.push(...violations);
  }

  // Report findings
  let exitCode: number;
  if (allViolations.length > 0) {
    for (const violation of allViolations) {
      const relPath = path.relative(process.cwd(), violation.file);

      formatter.addViolation({
        file: relPath,
        line: violation.line,
        content: violation.content,
        message: `Inline object type in ${violation.context.toLowerCase()}`,
        severity: 'WARNING',
      });
    }

    exitCode = formatter.finish({
      blocking: true,
      exitCode: 1,
      noExit: options.noExit,
      whyItMatters: [
        'Named types provide better error messages in TypeScript',
        'Inline types are harder to search, refactor, and reuse',
        'Type names serve as documentation (explaining intent)',
        'Promotes type consistency across the codebase',
      ],
      howToFix: [
        'Extract inline types to named type aliases or interfaces',
        'Define types in appropriate types.ts files',
        'Use descriptive type names that explain the purpose',
        'Add // @inline-type-ok comment for legitimate inline types',
        'For generic constraints and mapped types, inline is acceptable',
      ],
    });
  } else {
    exitCode = formatter.finish({
      blocking: true,
      exitCode: 0,
      noExit: options.noExit,
      whyItMatters: [
        'Named types provide better error messages',
        'Types become more searchable and refactorable',
        'Self-documenting code (type name explains intent)',
        'Easier to reuse types across the codebase',
      ],
    });
  }

  if (options.noExit) {
    return {
      checkName: 'inline-types',
      passed: exitCode === 0,
      violationCount: formatter.getViolationCount(),
      exitCode,
    };
  }
}
