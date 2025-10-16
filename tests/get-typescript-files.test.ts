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
});
