/**
 * Tests for get-typescript-files utility
 */

import { describe, it, expect } from 'vitest';
import { getTypeScriptFiles } from '../src/lib/get-typescript-files.js';
import * as path from 'path';

describe('getTypeScriptFiles', () => {
  it('should return null when tsconfig.json does not exist', () => {
    const result = getTypeScriptFiles({
      projectRoot: '/nonexistent/path',
    });

    expect(result).toBeNull();
  });

  it('should find TypeScript files in the current project', () => {
    const projectRoot = path.resolve(process.cwd());
    const result = getTypeScriptFiles({ projectRoot });

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);

    if (result) {
      // Should find our source files
      const hasSourceFiles = result.some((file) => file.includes('/src/'));
      expect(hasSourceFiles).toBe(true);

      // Should not include .d.ts files
      const hasDeclarationFiles = result.some((file) => file.endsWith('.d.ts'));
      expect(hasDeclarationFiles).toBe(false);

      // Should not include node_modules
      const hasNodeModules = result.some((file) => file.includes('node_modules'));
      expect(hasNodeModules).toBe(false);

      // Should not include dist
      const hasDist = result.some((file) => file.includes('/dist/'));
      expect(hasDist).toBe(false);

      // All paths should be absolute
      result.forEach((file) => {
        expect(path.isAbsolute(file)).toBe(true);
      });

      // All files should end with .ts
      result.forEach((file) => {
        expect(file.endsWith('.ts')).toBe(true);
      });
    }
  });

  it('should use process.cwd() when projectRoot is not specified', () => {
    const result = getTypeScriptFiles();

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
  });

  describe('excludePatterns', () => {
    it('should exclude files matching a single pattern', () => {
      const projectRoot = path.resolve(process.cwd());
      const resultWithoutExclude = getTypeScriptFiles({ projectRoot });
      const resultWithExclude = getTypeScriptFiles({
        projectRoot,
        excludePatterns: ['**/checks/**'],
      });

      expect(resultWithoutExclude).not.toBeNull();
      expect(resultWithExclude).not.toBeNull();

      if (resultWithoutExclude && resultWithExclude) {
        // Without exclude, should have checks files
        const hasChecksWithout = resultWithoutExclude.some((file) =>
          file.includes('/checks/')
        );
        expect(hasChecksWithout).toBe(true);

        // With exclude, should not have checks files
        const hasChecksWith = resultWithExclude.some((file) =>
          file.includes('/checks/')
        );
        expect(hasChecksWith).toBe(false);

        // With exclude should have fewer files
        expect(resultWithExclude.length).toBeLessThan(resultWithoutExclude.length);
      }
    });

    it('should exclude files matching multiple patterns', () => {
      const projectRoot = path.resolve(process.cwd());
      const resultWithExclude = getTypeScriptFiles({
        projectRoot,
        excludePatterns: ['**/checks/**', '**/lib/**'],
      });

      expect(resultWithExclude).not.toBeNull();

      if (resultWithExclude) {
        // Should not have checks files
        const hasChecks = resultWithExclude.some((file) =>
          file.includes('/checks/')
        );
        expect(hasChecks).toBe(false);

        // Should not have lib files
        const hasLib = resultWithExclude.some((file) => file.includes('/lib/'));
        expect(hasLib).toBe(false);

        // Should still have CLI file
        const hasCli = resultWithExclude.some((file) => file.includes('/cli/'));
        expect(hasCli).toBe(true);
      }
    });

    it('should exclude files matching suffix patterns like *.test.ts', () => {
      const projectRoot = path.resolve(process.cwd());

      // First verify we would normally include test files if they were in src
      // Since tests are in tests/ folder which is excluded by tsconfig,
      // we test with a pattern that matches files we know exist
      const resultWithExclude = getTypeScriptFiles({
        projectRoot,
        excludePatterns: ['**/*-files.ts'],
      });

      expect(resultWithExclude).not.toBeNull();

      if (resultWithExclude) {
        // Should not have barrel-files.ts
        const hasBarrelFiles = resultWithExclude.some((file) =>
          file.endsWith('barrel-files.ts')
        );
        expect(hasBarrelFiles).toBe(false);
      }
    });

    it('should be additive to default excludes', () => {
      const projectRoot = path.resolve(process.cwd());
      const resultWithExclude = getTypeScriptFiles({
        projectRoot,
        excludePatterns: ['**/checks/**'],
      });

      expect(resultWithExclude).not.toBeNull();

      if (resultWithExclude) {
        // Default excludes should still work
        const hasNodeModules = resultWithExclude.some((file) =>
          file.includes('node_modules')
        );
        expect(hasNodeModules).toBe(false);

        const hasDist = resultWithExclude.some((file) =>
          file.includes('/dist/')
        );
        expect(hasDist).toBe(false);
      }
    });

    it('should handle empty excludePatterns array', () => {
      const projectRoot = path.resolve(process.cwd());
      const resultWithEmpty = getTypeScriptFiles({
        projectRoot,
        excludePatterns: [],
      });
      const resultWithoutOption = getTypeScriptFiles({ projectRoot });

      expect(resultWithEmpty).not.toBeNull();
      expect(resultWithoutOption).not.toBeNull();

      if (resultWithEmpty && resultWithoutOption) {
        // Results should be identical
        expect(resultWithEmpty.length).toBe(resultWithoutOption.length);
      }
    });
  });
});
