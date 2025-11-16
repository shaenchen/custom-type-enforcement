import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runTypeDuplicatesCheck } from '../src/checks/type-duplicates.js';

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

describe('Type Duplicates Check', () => {
  const fixturesDir = path.resolve(process.cwd(), 'test-fixtures');

  beforeAll(() => {
    // Ensure all test fixture directories have tsconfig.json
    const testDirs = [
      'type-duplicates',
      'type-duplicates-subset',
      'type-duplicates-optional',
      'type-duplicates-required',
      'type-duplicates-same-file',
      'type-duplicates-small',
      'type-duplicates-ignore',
      'type-duplicates-no-types',
    ];

    testDirs.forEach(dir => {
      const fullPath = path.join(fixturesDir, dir);
      if (fs.existsSync(fullPath)) {
        ensureTsConfig(fullPath);
      }
    });
  });

  it('should have runTypeDuplicatesCheck function', () => {
    expect(typeof runTypeDuplicatesCheck).toBe('function');
  });

  it('should detect exact structural matches', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates');
    const result = runTypeDuplicatesCheck({
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

  it('should detect subset relationships', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-subset');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect optional field variance', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-optional');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should detect Required<T> opportunities', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-required');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBeGreaterThan(0);
  });

  it('should ignore duplicates in same file', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-same-file');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Same-file duplicates should be ignored
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should ignore types with fewer than 2 fields', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-small');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Small types (< 2 fields) should be ignored
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should respect @type-duplicate-allowed comments', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-ignore');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    // Types with @type-duplicate-allowed should be skipped
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when no types are present', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-no-types');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
    expect(result?.exitCode).toBe(0);
  });

  it('should work with structured format', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result?.checkName).toBe('type-duplicates');
  });

  it('should return proper CheckResult structure', () => {
    const testDir = path.join(fixturesDir, 'type-duplicates-no-types');
    const result = runTypeDuplicatesCheck({
      noExit: true,
      projectRoot: testDir,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('checkName');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('violationCount');
    expect(result).toHaveProperty('exitCode');
    expect(result?.checkName).toBe('type-duplicates');
  });
});
