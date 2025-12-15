import * as fs from 'fs';
import * as path from 'path';
import { getTypeScriptFiles } from '../lib/get-typescript-files.js';
import { Formatter } from '../lib/formatter.js';
import type { CheckOptions, CheckResult } from '../types.js';

interface TypeDefinition {
  name: string;
  filePath: string;
  line: number;
  fields: FieldDefinition[];
}

interface FieldDefinition {
  name: string;
  type: string;
  optional: boolean;
}

interface DuplicateMatch {
  type1: TypeDefinition;
  type2: TypeDefinition;
  matchType: 'exact' | 'optional-variance' | 'subset' | 'superset' | 'required-opportunity';
  suggestion: string;
}

/**
 * Extracts all type and interface definitions from a TypeScript file
 */
function extractTypeDefinitions(filePath: string): TypeDefinition[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const definitions: TypeDefinition[] = [];

  // Check for @type-duplicate-allowed at file level
  if (content.includes('// @type-duplicate-allowed')) {
    return definitions;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines with @type-duplicate-allowed comment
    if (line.includes('// @type-duplicate-allowed')) {
      continue;
    }

    // Match: export type Foo = { ... }
    // Match: export interface Foo { ... }
    // Match: type Foo = { ... }
    // Match: interface Foo { ... }
    const typeMatch = line.match(/(?:export\s+)?(?:type|interface)\s+(\w+)\s*[={]/);

    if (typeMatch) {
      const typeName = typeMatch[1];

      // Check if this is actually an object type (has braces on the same or next line)
      // Skip union types, primitive types, etc.
      const isObjectType = line.includes('{') ||
        (i + 1 < lines.length && lines[i + 1]?.trim().startsWith('{'));

      if (!isObjectType) {
        continue; // Skip non-object types (unions, primitives, etc.)
      }

      const fields = extractFields(lines, i);

      // Only include types with 2+ fields to avoid generic/trivial types
      if (fields.length >= 2) {
        definitions.push({
          name: typeName,
          filePath,
          line: i + 1,
          fields,
        });
      }
    }
  }

  return definitions;
}

/**
 * Extracts field definitions from a type/interface block
 */
function extractFields(lines: string[], startLine: number): FieldDefinition[] {
  const fields: FieldDefinition[] = [];
  let braceCount = 0;
  let foundOpenBrace = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];

    // Count braces to find the end of the type
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundOpenBrace = true;
      } else if (char === '}') {
        braceCount--;
      }
    }

    // Extract field if we're inside the type definition
    if (foundOpenBrace && braceCount > 0) {
      // Match: fieldName?: type
      // Match: fieldName: type
      const fieldMatch = line.match(/^\s*(\w+)(\?)?:\s*(.+?)(?:[;,]|$)/);

      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const optional = fieldMatch[2] === '?';
        let fieldType = fieldMatch[3].trim();

        // Remove trailing semicolon or comma
        fieldType = fieldType.replace(/[;,]$/, '').trim();

        fields.push({
          name: fieldName,
          type: fieldType,
          optional,
        });
      }
    }

    // Stop when we've closed all braces
    if (foundOpenBrace && braceCount === 0) {
      break;
    }
  }

  return fields;
}

/**
 * Compares two types and determines if they're duplicates
 */
function compareTypes(type1: TypeDefinition, type2: TypeDefinition): DuplicateMatch | null {
  // Ignore types in the same file (already co-located)
  if (type1.filePath === type2.filePath) {
    return null;
  }

  const fields1 = type1.fields;
  const fields2 = type2.fields;

  // Create field maps for easier comparison
  const fieldMap1 = new Map(fields1.map(f => [f.name, f]));
  const fieldMap2 = new Map(fields2.map(f => [f.name, f]));

  // Check for exact structural match
  if (areFieldsExactMatch(fields1, fields2)) {
    return {
      type1,
      type2,
      matchType: 'exact',
      suggestion: `Types '${type1.name}' and '${type2.name}' are structurally identical. Consider consolidating into a single type.`,
    };
  }

  // Check for optional field variance
  const optionalVariance = checkOptionalVariance(fields1, fields2);
  if (optionalVariance) {
    return {
      type1,
      type2,
      matchType: 'optional-variance',
      suggestion: optionalVariance,
    };
  }

  // Check for subset relationships (Pick/Omit opportunity)
  const subsetCheck = checkSubsetRelationship(type1, type2, fieldMap1, fieldMap2);
  if (subsetCheck) {
    return subsetCheck;
  }

  // Check for Required<T> opportunity
  const requiredOpportunity = checkRequiredOpportunity(type1, type2, fields1, fields2);
  if (requiredOpportunity) {
    return requiredOpportunity;
  }

  return null;
}

/**
 * Checks if two field arrays are an exact structural match
 */
function areFieldsExactMatch(fields1: FieldDefinition[], fields2: FieldDefinition[]): boolean {
  if (fields1.length !== fields2.length) {
    return false;
  }

  // Create sorted field signatures for comparison
  const sig1 = fields1
    .map(f => `${f.name}${f.optional ? '?' : ''}:${f.type}`)
    .sort()
    .join('|');

  const sig2 = fields2
    .map(f => `${f.name}${f.optional ? '?' : ''}:${f.type}`)
    .sort()
    .join('|');

  return sig1 === sig2;
}

/**
 * Checks for optional field variance (same required fields, one has optionals)
 */
function checkOptionalVariance(
  fields1: FieldDefinition[],
  fields2: FieldDefinition[]
): string | null {
  const required1 = fields1.filter(f => !f.optional);
  const required2 = fields2.filter(f => !f.optional);

  // If both have 0 required fields, this is not a meaningful comparison
  // (likely comparing types with all optional fields or empty types)
  if (required1.length === 0 && required2.length === 0) {
    return null;
  }

  // Check if required fields match exactly
  if (!areFieldsExactMatch(required1, required2)) {
    return null;
  }

  // Check if one has optionals that the other doesn't
  const optional1 = fields1.filter(f => f.optional);
  const optional2 = fields2.filter(f => f.optional);

  if (optional1.length === 0 && optional2.length === 0) {
    return null;
  }

  if (optional1.length !== optional2.length) {
    return `Types have the same required fields but different optional fields. Consider using a base type with Partial<T> or optional field composition.`;
  }

  return null;
}

/**
 * Checks if one type is a subset of another (Pick/Omit opportunity)
 */
function checkSubsetRelationship(
  type1: TypeDefinition,
  type2: TypeDefinition,
  fieldMap1: Map<string, FieldDefinition>,
  fieldMap2: Map<string, FieldDefinition>
): DuplicateMatch | null {
  const fields1 = Array.from(fieldMap1.values());
  const fields2 = Array.from(fieldMap2.values());

  // Check if type1 is a subset of type2
  const type1IsSubset = fields1.every(f1 => {
    const f2 = fieldMap2.get(f1.name);
    return f2 && f2.type === f1.type && f2.optional === f1.optional;
  });

  if (type1IsSubset && fields1.length < fields2.length) {
    const omittedFields = fields2
      .filter(f2 => !fieldMap1.has(f2.name))
      .map(f => f.name)
      .join(', ');

    return {
      type1,
      type2,
      matchType: 'subset',
      suggestion: `Type '${type1.name}' is a subset of '${type2.name}'. Consider using: type ${type1.name} = Omit<${type2.name}, '${omittedFields}'>`,
    };
  }

  // Check if type2 is a subset of type1
  const type2IsSubset = fields2.every(f2 => {
    const f1 = fieldMap1.get(f2.name);
    return f1 && f1.type === f2.type && f1.optional === f2.optional;
  });

  if (type2IsSubset && fields2.length < fields1.length) {
    const omittedFields = fields1
      .filter(f1 => !fieldMap2.has(f1.name))
      .map(f => f.name)
      .join(', ');

    return {
      type1: type2,
      type2: type1,
      matchType: 'superset',
      suggestion: `Type '${type2.name}' is a subset of '${type1.name}'. Consider using: type ${type2.name} = Omit<${type1.name}, '${omittedFields}'>`,
    };
  }

  return null;
}

/**
 * Checks for Required<T> opportunity (same fields, one has all required)
 */
function checkRequiredOpportunity(
  type1: TypeDefinition,
  type2: TypeDefinition,
  fields1: FieldDefinition[],
  fields2: FieldDefinition[]
): DuplicateMatch | null {
  if (fields1.length !== fields2.length) {
    return null;
  }

  // Check if field names and types match, but optionality differs
  const fieldMap2 = new Map(fields2.map(f => [f.name, f]));

  const namesAndTypesMatch = fields1.every(f1 => {
    const f2 = fieldMap2.get(f1.name);
    return f2 && f2.type === f1.type;
  });

  if (!namesAndTypesMatch) {
    return null;
  }

  // Check if one has all required and the other has some optional
  const allRequired1 = fields1.every(f => !f.optional);
  const allRequired2 = fields2.every(f => !f.optional);
  const hasOptional1 = fields1.some(f => f.optional);
  const hasOptional2 = fields2.some(f => f.optional);

  if (allRequired1 && hasOptional2) {
    return {
      type1,
      type2,
      matchType: 'required-opportunity',
      suggestion: `Type '${type1.name}' has all required fields while '${type2.name}' has optional fields. Consider using: type ${type1.name} = Required<${type2.name}>`,
    };
  }

  if (allRequired2 && hasOptional1) {
    return {
      type1: type2,
      type2: type1,
      matchType: 'required-opportunity',
      suggestion: `Type '${type2.name}' has all required fields while '${type1.name}' has optional fields. Consider using: type ${type2.name} = Required<${type1.name}>`,
    };
  }

  return null;
}

/**
 * Runs the type duplicates check
 * @param options - Check options including format and noExit flag
 * @returns CheckResult if noExit is true, otherwise exits the process
 */
export function runTypeDuplicatesCheck(options: CheckOptions = {}): CheckResult | void {
  const formatter = new Formatter('Type Duplicates');
  formatter.start();

  // Get all TypeScript files
  const files = getTypeScriptFiles({
    projectRoot: options.projectRoot,
    excludePatterns: options.excludePatterns,
  });
  if (!files || files.length === 0) {
    const exitCode = formatter.finish({
      blocking: true,
      exitCode: 0,
      noExit: options.noExit,
      whyItMatters: [
        'Prevents duplicate type definitions across the codebase',
        'Encourages type composition and reuse',
        'Reduces maintenance burden',
        'Makes type relationships explicit',
      ],
    });

    if (options.noExit) {
      return {
        checkName: 'type-duplicates',
        passed: true,
        violationCount: 0,
        exitCode,
        violations: [],
        howToFix: [
          'Consolidate exact duplicates into a single type',
          'Use type composition utilities: Pick<T, K>, Omit<T, K>, Required<T>, Partial<T>',
          'For subset relationships, derive smaller types from larger ones',
          'Co-locate related types in the same types.ts file',
        ],
        suppressInstruction: 'To suppress: Add // @type-duplicate-allowed comment on same line or line above',
      };
    }
    return;
  }

  // Extract all type definitions
  const allTypes: TypeDefinition[] = [];
  for (const file of files) {
    const types = extractTypeDefinitions(file);
    allTypes.push(...types);
  }

  // Compare all types pairwise
  const matches: DuplicateMatch[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < allTypes.length; i++) {
    for (let j = i + 1; j < allTypes.length; j++) {
      const type1 = allTypes[i];
      const type2 = allTypes[j];

      // Create a unique key for this pair
      const pairKey = [type1.filePath, type1.name, type2.filePath, type2.name].sort().join('|');

      if (processedPairs.has(pairKey)) {
        continue;
      }

      processedPairs.add(pairKey);

      const match = compareTypes(type1, type2);
      if (match) {
        matches.push(match);
      }
    }
  }

  // Report findings
  let exitCode: number;
  if (matches.length > 0) {
    for (const match of matches) {
      const relPath1 = path.relative(process.cwd(), match.type1.filePath);
      const relPath2 = path.relative(process.cwd(), match.type2.filePath);

      formatter.addViolation({
        file: relPath1,
        line: match.type1.line,
        message: `Type '${match.type1.name}' (${relPath1}:${match.type1.line}) and '${match.type2.name}' (${relPath2}:${match.type2.line})`,
        type: match.matchType.toUpperCase(),
        severity: 'WARNING',
      });

      formatter.addSuggestion(match.suggestion);
    }

    exitCode = formatter.finish({
      blocking: true,
      exitCode: 1,
      noExit: options.noExit,
      whyItMatters: [
        'Duplicate types increase maintenance burden',
        'Type consolidation makes relationships explicit',
        'Composition (Pick/Omit/Required) improves type safety',
        'Reduces cognitive load when reading code',
      ],
      howToFix: [
        'Consolidate exact duplicates into a single type',
        'Use type composition utilities: Pick<T, K>, Omit<T, K>, Required<T>, Partial<T>',
        'For subset relationships, derive smaller types from larger ones',
        'Add // @type-duplicate-allowed to suppress false positives',
        'Co-locate related types in the same types.ts file',
      ],
    });
  } else {
    exitCode = formatter.finish({
      blocking: true,
      exitCode: 0,
      noExit: options.noExit,
      whyItMatters: [
        'Prevents duplicate type definitions across the codebase',
        'Encourages type composition and reuse',
        'Reduces maintenance burden',
        'Makes type relationships explicit',
      ],
    });
  }

  if (options.noExit) {
    return {
      checkName: 'type-duplicates',
      passed: exitCode === 0,
      violationCount: formatter.getViolationCount(),
      exitCode,
      violations: formatter.getViolations().map(v => ({
        file: v.file,
        line: v.line,
        message: v.message ?? 'Violation detected',
      })),
      howToFix: [
        'Consolidate exact duplicates into a single type',
        'Use type composition utilities: Pick<T, K>, Omit<T, K>, Required<T>, Partial<T>',
        'For subset relationships, derive smaller types from larger ones',
        'Co-locate related types in the same types.ts file',
      ],
      suppressInstruction: 'To suppress: Add // @type-duplicate-allowed comment on same line or line above',
    };
  }
}
