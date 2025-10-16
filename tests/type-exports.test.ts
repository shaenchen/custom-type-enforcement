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
 * Helper to run check and capture output
 */
function runCheckAndCaptureOutput(): { exitCode: number; output: string } {
  const originalCwd = process.cwd();
  const originalExit = process.exit;
  const originalLog = console.log;
  const originalError = console.error;

  let exitCode = 0;
  let output = '';

  try {
    // Change to test directory
    process.chdir(TEST_DIR);

    // Mock process.exit
    (process.exit as unknown) = ((code: number) => {
      exitCode = code ?? 0;
      throw new Error('EXIT');
    }) as typeof process.exit;

    // Capture console output
    console.log = (...args: unknown[]) => {
      output += args.join(' ') + '\n';
    };
    console.error = (...args: unknown[]) => {
      output += args.join(' ') + '\n';
    };

    // Run the check
    runTypeExportsCheck({ format: 'compact' });
  } catch (error) {
    // Expected - process.exit throws
    if ((error as Error).message !== 'EXIT') {
      throw error;
    }
  } finally {
    // Restore
    process.chdir(originalCwd);
    process.exit = originalExit;
    console.log = originalLog;
    console.error = originalError;
  }

  return { exitCode, output };
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Export from Non-Types File');
  });

  it('should detect interface export from non-types file', () => {
    createTestProject({
      'config.ts': `
        export interface Config {
          apiKey: string;
        }
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Export from Non-Types File');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Export from Non-Types File');
  });

  it('should detect export { type Foo } from non-types file', () => {
    createTestProject({
      'user.ts': `
        type User = { name: string; };
        export { type User };
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Export from Non-Types File');
  });

  it('should detect export type { Foo } from non-types file', () => {
    createTestProject({
      'user.ts': `
        interface User { name: string; }
        export type { User };
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Export from Non-Types File');
  });

  it('should detect non-functional const export (primitive)', () => {
    createTestProject({
      'constants.ts': `
        export const API_KEY = 'my-api-key';
        export const MAX_RETRIES = 3;
        export const IS_PRODUCTION = true;
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Non-Functional Constant Export');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Non-Functional Constant Export');
  });

  it('should detect non-functional const export (array)', () => {
    createTestProject({
      'data.ts': `
        export const items = ['one', 'two', 'three'];
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Non-Functional Constant Export');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Re-Export Anti-Pattern');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Functional Export from Types Directory');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Functional Export from Types Directory');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Functional Export from Types Directory');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('3 issues');
  });

  it('should provide helpful fix suggestions', () => {
    createTestProject({
      'user.ts': `
        export type User = { name: string; };
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('Move type/interface/enum exports to types.ts');
    expect(output).toContain('type composition');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Type Export from Non-Types File');
  });

  it('should handle const with function expression', () => {
    createTestProject({
      'utils.ts': `
        export const myFunc = function(a: number): number {
          return a * 2;
        };
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
  });

  it('should handle const with class expression', () => {
    createTestProject({
      'utils.ts': `
        export const MyClass = class {
          constructor(public name: string) {}
        };
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
  });

  it('should allow non-functional const in types.ts', () => {
    createTestProject({
      'types.ts': `
        export type User = { name: string; };
        export const DEFAULT_USER: User = { name: 'Anonymous' };
      `,
    });

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(0);
    expect(output).toContain('✅ PASSED');
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

    const { exitCode, output } = runCheckAndCaptureOutput();

    expect(exitCode).toBe(1);
    expect(output).toContain('❌ FAILED');
    expect(output).toContain('Functional Export from Types Directory');
  });
});
