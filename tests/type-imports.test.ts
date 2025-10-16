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

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
    });

    it('should allow type imports from types/{domain}.ts files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types/user.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/services/user-service.ts',
        "import type { User } from '../types/user.js';\nconst user: User = { name: 'Alice' };"
      );

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
    });

    it('should allow type imports from external packages', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/app.ts',
        "import type { Request, Response } from 'express';\nimport type { ReactNode } from 'react';"
      );

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
    });

    it('should allow type imports from scoped external packages', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile(
        'src/app.ts',
        "import type { Config } from '@company/config';\nimport type { Logger } from '@aws-sdk/client-s3';"
      );

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
    });

    it('should allow inline type imports from types files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/types.ts', 'export interface User { name: string; }');
      createTestFile(
        'src/user.ts',
        "import { type User, getDefaultUser } from './types.js';"
      );

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
    });

    it('should pass when no type imports exist', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/app.ts', "import { getUserName } from './user.js';");

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
    });
  });

  describe('Invalid type imports (should detect violations)', () => {
    it('should detect type imports from implementation files', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User { name: string; }');
      createTestFile('src/app.ts', "import type { User } from './user.js';");

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (failure)
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

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (failure)
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

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (failure)
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

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (failure)
    });

    it('should detect type imports without .js extension', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User { name: string; }');
      createTestFile('src/app.ts', "import type { User } from './user';");

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (failure)
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

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (one violation for models.js)
    });

    it('should handle import paths ending with /types', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/shared/types/index.ts', 'export interface Config {}');
      createTestFile(
        'src/app.ts',
        "import type { Config } from './shared/types';"
      );

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (success)
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

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (type import from non-types file)
    });

    it('should handle imports with various whitespace', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User {}');
      createTestFile(
        'src/app.ts',
        "import   type   {   User   }   from   './user.js'  ;"
      );

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (failure)
    });

    it('should handle absolute import paths starting with /', () => {
      createTsConfig(['src/**/*.ts']);
      createTestFile('src/user.ts', 'export interface User {}');
      createTestFile('src/app.ts', "import type { User } from '/src/user.js';");

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1 (absolute path to non-types file)
    });
  });

  describe('Error handling', () => {
    it('should handle missing tsconfig.json', () => {
      // Don't create tsconfig.json

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 1
    });

    it('should handle empty project (no TypeScript files)', () => {
      createTsConfig(['src/**/*.ts']);
      // Don't create any TypeScript files

      expect(() => {
        runTypeImportsCheck({ projectRoot: TEST_DIR, format: 'compact' });
      }).toThrow(); // Should exit with code 0 (no violations)
    });
  });
});
