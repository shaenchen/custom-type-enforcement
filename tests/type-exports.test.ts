/**
 * Tests for type exports check
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runTypeExportsCheck } from '../src/checks/type-exports.js';

// Create a temporary test directory
const TEST_DIR = path.join(process.cwd(), '.test-temp-type-exports');

/**
 * Helper to create a test project with tsconfig and files
 */
function createTestProject(files: Record<string, string>): void {
  // Create test directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
    },
    include: ['**/*.ts'],
  };
  fs.writeFileSync(
    path.join(TEST_DIR, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  // Create test files
  Object.entries(files).forEach(([filename, content]) => {
    const filePath = path.join(TEST_DIR, filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  });
}

/**
 * Helper to run check with noExit flag
 */
function runCheck() {
  const originalCwd = process.cwd();
  try {
    process.chdir(TEST_DIR);
    return runTypeExportsCheck({ noExit: true });
  } finally {
    process.chdir(originalCwd);
  }
}

describe('Type Exports Check', () => {
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  // ===== VALID SCENARIOS (should pass) =====

  it('should pass when types are exported from types.ts', () => {
    createTestProject({
      'types.ts': `
        export type User = {
          name: string;
          age: number;
        };

        export interface Config {
          apiKey: string;
        }

        export enum Status {
          Active,
          Inactive
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when types are exported from types/{domain}.ts', () => {
    createTestProject({
      'types/user.ts': `
        export type User = {
          name: string;
          age: number;
        };
      `,
      'types/config.ts': `
        export interface Config {
          apiKey: string;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when functional exports are in implementation files', () => {
    createTestProject({
      'utils.ts': `
        export function add(a: number, b: number): number {
          return a + b;
        }

        export const multiply = (a: number, b: number): number => {
          return a * b;
        }

        export class Calculator {
          add(a: number, b: number) { return a + b; }
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when types are defined locally (not exported)', () => {
    createTestProject({
      'utils.ts': `
        type LocalUser = {
          name: string;
        };

        interface LocalConfig {
          apiKey: string;
        }

        export function processUser(user: LocalUser): void {
          console.log(user.name);
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass with nested types directories', () => {
    createTestProject({
      'src/types/user.ts': `
        export type User = { name: string; };
      `,
      'src/domain/types/config.ts': `
        export interface Config { apiKey: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a multi-line arrow function', () => {
    createTestProject({
      'utils.ts': `
        export const complexFunction = (
          arg1: string,
          arg2: number
        ) => {
          return arg1 + arg2;
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is an async arrow function', () => {
    createTestProject({
      'utils.ts': `
        export const fetchData = async () => {
          return fetch('/api/data');
        };

        export const processAsync = async (data: string) => {
          return data.toUpperCase();
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  // ===== INVALID SCENARIOS (should fail) =====

  it('should detect type export from non-types file', () => {
    createTestProject({
      'user.ts': `
        export type User = {
          name: string;
          age: number;
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect interface export from non-types file', () => {
    createTestProject({
      'config.ts': `
        export interface Config {
          apiKey: string;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect enum export from non-types file', () => {
    createTestProject({
      'status.ts': `
        export enum Status {
          Active,
          Inactive,
          Pending
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect export { type Foo } from non-types file', () => {
    createTestProject({
      'user.ts': `
        type User = { name: string; };
        export { type User };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect export type { Foo } from non-types file', () => {
    createTestProject({
      'user.ts': `
        interface User { name: string; }
        export type { User };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect non-functional const export (primitive)', () => {
    createTestProject({
      'constants.ts': `
        export const API_KEY = 'my-api-key';
        export const MAX_RETRIES = 3;
        export const IS_PRODUCTION = true;
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect non-functional const export (object)', () => {
    createTestProject({
      'config.ts': `
        export const config = {
          apiKey: 'test',
          timeout: 5000
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect non-functional const export (array)', () => {
    createTestProject({
      'data.ts': `
        export const items = ['one', 'two', 'three'];
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect export type * anti-pattern', () => {
    createTestProject({
      'index.ts': `
        export type * from './user';
      `,
      'user.ts': `
        export type User = { name: string; };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect functional code export from types/ directory (function)', () => {
    createTestProject({
      'types/helpers.ts': `
        export type User = { name: string; };

        export function validateUser(user: User): boolean {
          return user.name.length > 0;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect functional code export from types/ directory (class)', () => {
    createTestProject({
      'types/models.ts': `
        export type User = { name: string; };

        export class UserModel {
          constructor(public name: string) {}
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect functional const export from types/ directory', () => {
    createTestProject({
      'types/utils.ts': `
        export type User = { name: string; };

        export const processUser = (user: User): string => {
          return user.name.toUpperCase();
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect multiple violations across files', () => {
    createTestProject({
      'user.ts': `
        export type User = { name: string; };
      `,
      'config.ts': `
        export interface Config { apiKey: string; }
      `,
      'constants.ts': `
        export const MAX_RETRIES = 3;
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(3);
  });

  it('should provide helpful fix suggestions', () => {
    createTestProject({
      'user.ts': `
        export type User = { name: string; };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.howToFix).toBeDefined();
    expect(result?.suppressInstruction).toBeDefined();
  });

  it('should handle mixed valid and invalid exports', () => {
    createTestProject({
      'utils.ts': `
        // Valid: functional export
        export function add(a: number, b: number): number {
          return a + b;
        }

        // Invalid: type export from non-types file
        export type Result = {
          value: number;
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should handle const with function expression', () => {
    createTestProject({
      'utils.ts': `
        export const myFunc = function(a: number): number {
          return a * 2;
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should handle const with class expression', () => {
    createTestProject({
      'utils.ts': `
        export const MyClass = class {
          constructor(public name: string) {}
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow non-functional const in types.ts', () => {
    createTestProject({
      'types.ts': `
        export type User = { name: string; };
        export const DEFAULT_USER: User = { name: 'Anonymous' };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should detect abstract class export from types/ directory', () => {
    createTestProject({
      'types/base.ts': `
        export type User = { name: string; };

        export abstract class BaseModel {
          abstract validate(): boolean;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  // ===== IGNORE FLAG TESTS =====

  it('should skip violations with @type-export-allowed on same line', () => {
    createTestProject({
      'user.ts': `
        export type User = { name: string; }; // @type-export-allowed
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should skip violations with @type-export-allowed on previous line', () => {
    createTestProject({
      'config.ts': `
        // @type-export-allowed
        export interface Config {
          apiKey: string;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should skip multiple violations with ignore flags', () => {
    createTestProject({
      'mixed.ts': `
        // @type-export-allowed
        export type User = { name: string; };

        export interface Config { apiKey: string; } // @type-export-allowed

        export enum Status { Active, Inactive } // @type-export-allowed
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should still detect violations without ignore flag', () => {
    createTestProject({
      'mixed.ts': `
        // @type-export-allowed
        export type User = { name: string; };

        // This one should be detected (no ignore flag)
        export interface Config {
          apiKey: string;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should allow ignore flag for non-functional const exports', () => {
    createTestProject({
      'constants.ts': `
        export const API_KEY = 'my-api-key'; // @type-export-allowed
        // @type-export-allowed
        export const MAX_RETRIES = 3;
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow ignore flag for type re-export anti-pattern', () => {
    createTestProject({
      'index.ts': `
        // @type-export-allowed
        export type * from './user';
      `,
      'user.ts': `
        export type User = { name: string; }; // @type-export-allowed
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });
});
