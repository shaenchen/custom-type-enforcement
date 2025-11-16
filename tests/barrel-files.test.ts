/**
 * Tests for barrel files check
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runBarrelFilesCheck } from '../src/checks/barrel-files.js';

// Create a temporary test directory
const TEST_DIR = path.join(process.cwd(), '.test-temp-barrel');

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
    return runBarrelFilesCheck({ noExit: true });
  } finally {
    process.chdir(originalCwd);
  }
}

describe('Barrel Files Check', () => {
  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should pass when files have actual implementation', () => {
    createTestProject({
      'utils.ts': `
        export function add(a: number, b: number): number {
          return a + b;
        }

        export function multiply(a: number, b: number): number {
          return a * b;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
    expect(result?.violations).toBeDefined();
    expect(result?.howToFix).toBeDefined();
    expect(result?.suppressInstruction).toBeDefined();
  });

  it('should detect pure barrel file with export from', () => {
    createTestProject({
      'index.ts': `
        export { add, multiply } from './math';
        export { User } from './user';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
        export function multiply(a: number, b: number) { return a * b; }
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.violations).toBeDefined();
  });

  it('should detect pure barrel file with export * from', () => {
    createTestProject({
      'index.ts': `
        export * from './math';
        export * from './user';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.violations).toBeDefined();
  });

  it('should detect pure barrel file with export type from', () => {
    createTestProject({
      'types.ts': `
        export type { User } from './user';
        export type { Config } from './config';
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
      'config.ts': `
        export interface Config { apiKey: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.violations).toBeDefined();
  });

  it('should allow barrel file with @barrel-file-allowed comment', () => {
    createTestProject({
      'index.ts': `
        // @barrel-file-allowed
        export { add, multiply } from './math';
        export { User } from './user';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow file with mixed exports and implementation', () => {
    createTestProject({
      'index.ts': `
        export { add } from './math';

        export function localFunction() {
          return 'local';
        }
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow file with only implementation (no re-exports)', () => {
    createTestProject({
      'utils.ts': `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should ignore comments and whitespace in barrel files', () => {
    createTestProject({
      'index.ts': `
        // This is a barrel file
        /* Multi-line
           comment */

        export { add } from './math';

        // Another comment
        export { User } from './user';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.violations).toBeDefined();
  });

  it('should allow import statements in barrel files', () => {
    createTestProject({
      'index.ts': `
        import { helperFunction } from './helper';
        export { add } from './math';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
      'helper.ts': `
        export function helperFunction() { return true; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.violations).toBeDefined();
  });

  it('should detect multiple barrel files', () => {
    createTestProject({
      'index.ts': `
        export { add } from './math';
      `,
      'types.ts': `
        export type { User } from './user';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(2);
  });

  it('should provide helpful fix suggestions', () => {
    createTestProject({
      'index.ts': `
        export { add } from './math';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.howToFix).toBeDefined();
    expect(result?.suppressInstruction).toBeDefined();
  });

  it('should handle export * as syntax', () => {
    createTestProject({
      'index.ts': `
        export * as math from './math';
        export * as user from './user';
      `,
      'math.ts': `
        export function add(a: number, b: number) { return a + b; }
      `,
      'user.ts': `
        export interface User { name: string; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.violations).toBeDefined();
  });
});
