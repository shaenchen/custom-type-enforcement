import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runTypeImportsCheck } from '../src/checks/type-imports.js';

// Create a temporary test directory
const TEST_DIR = path.join(process.cwd(), 'test-temp-type-imports');

// Helper to create test files
function createTestFile(filename: string, content: string): string {
  const filePath = path.join(TEST_DIR, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// Helper to create tsconfig.json
function createTsConfig(include: string[] = ['**/*.ts']): void {
  const tsConfigPath = path.join(TEST_DIR, 'tsconfig.json');
  fs.writeFileSync(
    tsConfigPath,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        strict: true,
      },
      include,
      exclude: ['node_modules', 'dist'],
    }),
    'utf-8'
  );
}

describe('Type Imports Check', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Valid type imports (should pass)', () => {
    it('should allow type imports from types.ts files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/user.ts',
        "import type { User } from './types.js';\nconst user: User = { name: 'Alice' };"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow type imports from types/{domain}.ts files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types/user.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/services/user-service.ts',
        "import type { User } from '../types/user.js';\nconst user: User = { name: 'Alice' };"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow type imports from external packages', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/app.ts',
        "import type { Request, Response } from 'express';\nimport type { ReactNode } from 'react';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow type imports from scoped external packages', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/app.ts',
        "import type { Config } from '@company/config';\nimport type { Logger } from '@aws-sdk/client-s3';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow inline type imports from types files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/user.ts',
        "import { type User, getDefaultUser } from './types.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should pass when no type imports exist', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/app.ts', "import { getUserName } from './user.js';");

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });
  });

  describe('Invalid type imports (should detect violations)', () => {
    it('should detect type imports from implementation files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User { name: string; }');
      createTestFile('src/app.ts', "import type { User } from './user.js';");

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should detect inline type imports from non-types files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/services/auth.ts',
        'export interface AuthConfig { apiKey: string; }\nexport function authenticate() {}'
      );
      createTestFile(
        'src/app.ts',
        "import { type AuthConfig, authenticate } from './services/auth.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should detect multiple type imports from non-types files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/models.ts',
        'export interface User {}\nexport interface Post {}'
      );
      createTestFile(
        'src/app.ts',
        "import type { User, Post } from './models.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should detect type imports from nested implementation files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/services/user/user-service.ts',
        'export interface UserService {}'
      );
      createTestFile(
        'src/app.ts',
        "import type { UserService } from './services/user/user-service.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should detect type imports without .js extension', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User { name: string; }');
      createTestFile('src/app.ts', "import type { User } from './user';");

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle files with multiple import statements', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types.ts', 'export interface User {}');
      createTestFile('src/models.ts', 'export interface Post {}');
      createTestFile(
        'src/app.ts',
        "import type { User } from './types.js';\nimport type { Post } from './models.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should handle import paths ending with /types', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/shared/types/index.ts', 'export interface Config {}');
      createTestFile(
        'src/app.ts',
        "import type { Config } from './shared/types';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should handle mixed type and regular imports', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/utils.ts',
        'export interface Config {}\nexport function getConfig() {}'
      );
      createTestFile(
        'src/app.ts',
        "import { type Config, getConfig } from './utils.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should handle imports with various whitespace', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User {}');
      createTestFile(
        'src/app.ts',
        "import   type   {   User   }   from   './user.js'  ;"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should handle absolute import paths starting with /', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User {}');
      createTestFile('src/app.ts', "import type { User } from '/src/user.js';");

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle missing tsconfig.json', () => {
      // Don't create tsconfig.json

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should handle empty project (no TypeScript files)', () => {
      createTsConfig(['src/**/*.ts']);
      // Don't create any TypeScript files

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });
  });

  describe('Ignore flag support', () => {
    it('should skip violations with @type-import-allowed on same line', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/app.ts',
        "import type { User } from './user.js'; // @type-import-allowed"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should skip violations with @type-import-allowed on previous line', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/models.ts', 'export interface Post { title: string; }');
      createTestFile(
        'src/app.ts',
        "// @type-import-allowed\nimport type { Post } from './models.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should skip multiple violations with ignore flags', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User {}');
      createTestFile('src/post.ts', 'export interface Post {}');
      createTestFile(
        'src/app.ts',
        "// @type-import-allowed\nimport type { User } from './user.js';\nimport type { Post } from './post.js'; // @type-import-allowed"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should still detect violations without ignore flag', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User {}');
      createTestFile('src/post.ts', 'export interface Post {}');
      createTestFile(
        'src/app.ts',
        "// @type-import-allowed\nimport type { User } from './user.js';\nimport type { Post } from './post.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should allow ignore flag for inline type imports', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/utils.ts',
        'export interface Config {}\nexport function getConfig() {}'
      );
      createTestFile(
        'src/app.ts',
        "import { type Config, getConfig } from './utils.js'; // @type-import-allowed"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow ignore flag with mixed imports (some ignored, some not)', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types.ts', 'export interface User {}');
      createTestFile('src/models.ts', 'export interface Post {}');
      createTestFile('src/services.ts', 'export interface Service {}');
      createTestFile(
        'src/app.ts',
        "import type { User } from './types.js';\n// @type-import-allowed\nimport type { Post } from './models.js';\nimport type { Service } from './services.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });
  });

  describe('Sibling types file imports (Enhancement #3)', () => {
    it('should allow type imports between files in the same types/ directory', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types/metrics.ts', 'export interface Metric { name: string; }');
      createTestFile(
        'src/types/charts.ts',
        "import type { Metric } from './metrics.js';\nexport interface Chart { metric: Metric; }"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow type imports from types.ts into types/{domain}.ts', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types.ts', 'export interface BaseEntity { id: number; }');
      createTestFile(
        'src/types/user.ts',
        "import type { BaseEntity } from '../types.js';\nexport interface User extends BaseEntity { name: string; }"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow type imports from types/{domain}.ts into types.ts', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types/user.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/types.ts',
        "import type { User } from './types/user.js';\nexport type { User };"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow multiple sibling imports in one types file', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types/metrics.ts', 'export interface Metric { name: string; }');
      createTestFile('src/types/database.ts', 'export interface DatabaseHelper { query: string; }');
      createTestFile('src/types/schema.ts', 'export interface SchemaAnalysis { tables: string[]; }');
      createTestFile(
        'src/types/charts.ts',
        [
          "import type { Metric } from './metrics.js';",
          "import type { DatabaseHelper } from './database.js';",
          "import type { SchemaAnalysis } from './schema.js';",
          'export interface Chart { metric: Metric; helper: DatabaseHelper; schema: SchemaAnalysis; }',
        ].join('\n')
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow type imports between nested types directories', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/shared/types/common.ts', 'export interface Common { id: number; }');
      createTestFile(
        'src/domain/types/entity.ts',
        "import type { Common } from '../../shared/types/common.js';\nexport interface Entity extends Common { name: string; }"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should still detect violations when types file imports from non-types file', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/models/user.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/types/charts.ts',
        "import type { User } from '../models/user.js';\nexport interface Chart { user: User; }"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should still detect violations when non-types file imports from non-types file', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/models/user.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/services/user-service.ts',
        "import type { User } from '../models/user.js';"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(false);
      expect(result?.exitCode).toBe(1);
    });

    it('should allow type imports without extension between sibling types files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types/metrics.ts', 'export interface Metric { name: string; }');
      createTestFile(
        'src/types/charts.ts',
        "import type { Metric } from './metrics';\nexport interface Chart { metric: Metric; }"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });

    it('should allow inline type imports between sibling types files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/types/metrics.ts',
        'export interface Metric { name: string; }\nexport function createMetric(): Metric { return { name: "" }; }'
      );
      createTestFile(
        'src/types/charts.ts',
        "import { type Metric, createMetric } from './metrics.js';\nexport interface Chart { metric: Metric; }"
      );

      const result = runTypeImportsCheck({ projectRoot: TEST_DIR, noExit: true });
      expect(result?.passed).toBe(true);
      expect(result?.exitCode).toBe(0);
    });
  });
});
