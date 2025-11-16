import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runInlineTypesCheck } from '../src/checks/inline-types.js';

// Helper to create tsconfig.json in test fixture directories
function ensureTsConfig(dir: string): void {
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        strict: true,
      },
      include: ['**/*.ts'],
    };
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }
}

describe('Inline Types Check', () => {
  const fixturesDir = path.resolve(process.cwd(), 'test-fixtures');

  beforeAll(() => {
    // Ensure all test fixture directories have tsconfig.json
    const testDirs = [
      'inline-types-assertions',
      'inline-types-params',
      'inline-types-return',
      'inline-types-vars',
      'inline-types-generics',
      'inline-types-mapped',
      'inline-types-ignore',
      'inline-types-clean',
      'inline-types-named',
      'inline-types-multiple',
      'inline-types-conditional',
      'inline-types-class',
      'inline-types-arrow',
    ];

    testDirs.forEach(dir => {
      const fullPath = path.join(fixturesDir, dir);
      if (fs.existsSync(fullPath)) {
        ensureTsConfig(fullPath);
      }
    });
  });

  it('should have runInlineTypesCheck function', () => {
    expect(typeof runInlineTypesCheck).toBe('function');
  });

  it('should detect inline types in type assertions', () => {
    const testDir = path.join(fixturesDir, 'inline-types-assertions');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
    expect(result?.exitCode).toBe(1);
    expect(result?.violations).toBeDefined();
    expect(result?.howToFix).toBeDefined();
    expect(result?.suppressInstruction).toBeDefined();
  });

  it('should detect inline types in function parameters', () => {
    const testDir = path.join(fixturesDir, 'inline-types-params');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect inline types in return types', () => {
    const testDir = path.join(fixturesDir, 'inline-types-return');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect inline types in variable declarations', () => {
    const testDir = path.join(fixturesDir, 'inline-types-vars');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should allow generic constraints', () => {
    const testDir = path.join(fixturesDir, 'inline-types-generics');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Generic constraints should be allowed
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow mapped types', () => {
    const testDir = path.join(fixturesDir, 'inline-types-mapped');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Mapped types should be allowed
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should respect @inline-type-allowed comments', () => {
    const testDir = path.join(fixturesDir, 'inline-types-ignore');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Lines with @inline-type-allowed should be ignored
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass on clean code with named types', () => {
    const testDir = path.join(fixturesDir, 'inline-types-clean');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
    expect(result?.exitCode).toBe(0);
  });

  it('should allow named type declarations', () => {
    const testDir = path.join(fixturesDir, 'inline-types-named');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Named type/interface declarations should be allowed
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should detect multiple inline types in one file', () => {
    const testDir = path.join(fixturesDir, 'inline-types-multiple');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    // Should detect all inline types in the file
    expect(result?.violationCount).toBeGreaterThan(1);
  });

  it('should allow conditional types', () => {
    const testDir = path.join(fixturesDir, 'inline-types-conditional');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Conditional types should be allowed
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should detect inline types in class properties', () => {
    const testDir = path.join(fixturesDir, 'inline-types-class');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect inline types in arrow functions', () => {
    const testDir = path.join(fixturesDir, 'inline-types-arrow');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should work with structured format', () => {
    const testDir = path.join(fixturesDir, 'inline-types-params');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.checkName).toBe('inline-types');
  });

  it('should return proper CheckResult structure', () => {
    const testDir = path.join(fixturesDir, 'inline-types-clean');
    const result = runInlineTypesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('checkName');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('violationCount');
    expect(result).toHaveProperty('exitCode');
    expect(result?.checkName).toBe('inline-types');
  });
});
