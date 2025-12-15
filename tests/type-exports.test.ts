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
function runCheck(options: { allowExportsPatterns?: string[] } = {}) {
  const originalCwd = process.cwd();
  try {
    process.chdir(TEST_DIR);
    return runTypeExportsCheck({ noExit: true, ...options });
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

  it('should allow functional code export from types/ directory (function)', () => {
    createTestProject({
      'types/helpers.ts': `
        export type User = { name: string; };

        export function validateUser(user: User): boolean {
          return user.name.length > 0;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow class export from types/ directory', () => {
    createTestProject({
      'types/models.ts': `
        export type User = { name: string; };

        export class UserModel {
          constructor(public name: string) {}
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow functional const export from types/ directory', () => {
    createTestProject({
      'types/utils.ts': `
        export type User = { name: string; };

        export const processUser = (user: User): string => {
          return user.name.toUpperCase();
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
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

  it('should allow abstract class export from types/ directory', () => {
    createTestProject({
      'types/base.ts': `
        export type User = { name: string; };

        export abstract class BaseModel {
          abstract validate(): boolean;
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
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

  // ===== SCHEMA LIBRARY TESTS (TypeBox, Zod) =====

  it('should pass when const export is a TypeBox schema (Type.Object)', () => {
    createTestProject({
      'schemas/user.ts': `
        import { Type } from '@sinclair/typebox';

        export const UserSchema = Type.Object({
          name: Type.String(),
          age: Type.Number(),
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a TypeBox schema (Type.String)', () => {
    createTestProject({
      'schemas/common.ts': `
        import { Type } from '@sinclair/typebox';

        export const UuidParam = Type.String({
          format: 'uuid',
          description: 'UUID v4 identifier',
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a TypeBox schema (Type.Union)', () => {
    createTestProject({
      'schemas/status.ts': `
        import { Type } from '@sinclair/typebox';

        export const StatusSchema = Type.Union([
          Type.Literal('active'),
          Type.Literal('inactive'),
          Type.Literal('pending'),
        ]);
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a TypeBox schema (Type.Array)', () => {
    createTestProject({
      'schemas/items.ts': `
        import { Type } from '@sinclair/typebox';

        export const ItemsSchema = Type.Array(Type.Object({
          id: Type.Number(),
          name: Type.String(),
        }));
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a Zod schema (z.object)', () => {
    createTestProject({
      'schemas/user.ts': `
        import { z } from 'zod';

        export const UserSchema = z.object({
          name: z.string(),
          age: z.number(),
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a Zod schema (z.enum)', () => {
    createTestProject({
      'config/presets.ts': `
        import { z } from 'zod';

        export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
        export const TestTypeSchema = z.enum([
          'pattern',
          'trend',
          'mixture',
        ]);
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a Zod schema (z.string, z.number)', () => {
    createTestProject({
      'validators/common.ts': `
        import { z } from 'zod';

        export const EmailSchema = z.string().email();
        export const PositiveNumberSchema = z.number().positive();
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass with multiple TypeBox schemas in a single file', () => {
    createTestProject({
      'schemas/alerts.ts': `
        import { Type } from '@sinclair/typebox';

        export const ThresholdOperatorSchema = Type.Union([
          Type.Literal('gt'),
          Type.Literal('lt'),
          Type.Literal('eq'),
        ]);

        export const AlertConditionSchema = Type.Object({
          type: Type.Union([
            Type.Literal('threshold'),
            Type.Literal('spc_rule'),
          ]),
          operator: Type.Optional(ThresholdOperatorSchema),
          value: Type.Optional(Type.Number()),
        });

        export const AlertResponseSchema = Type.Object({
          id: Type.Number(),
          name: Type.String(),
          condition: AlertConditionSchema,
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when TypeBox schema is on multiple lines with type annotation', () => {
    createTestProject({
      'schemas/metrics.ts': `
        import { Type, TSchema } from '@sinclair/typebox';

        export const MetricResponseSchema: TSchema =
          Type.Object({
            id: Type.Number(),
            name: Type.String(),
          });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should still detect non-schema const exports alongside schema exports', () => {
    createTestProject({
      'schemas/mixed.ts': `
        import { Type } from '@sinclair/typebox';

        // This is valid - TypeBox schema
        export const UserSchema = Type.Object({
          name: Type.String(),
        });

        // This should be flagged - plain object, not a schema
        export const defaultUser = {
          name: 'Anonymous',
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(1);
  });

  // ===== RUNTIME CONSTANT TESTS (Enhancement #5) =====

  it('should pass when const export is initialized with a function call', () => {
    createTestProject({
      'logger.ts': `
        import pino from 'pino';

        export const logger = pino({
          level: 'info',
          transport: { target: 'pino-pretty' },
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is initialized with a method call', () => {
    createTestProject({
      'cache.ts': `
        import Redis from 'ioredis';

        export const redisClient = Redis.createClient({
          host: 'localhost',
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const export is a new expression', () => {
    createTestProject({
      'service.ts': `
        import { MyService } from './my-service';

        export const service = new MyService();
        export const anotherService = new AnotherService({ debug: true });
      `,
      'my-service.ts': `
        export class MyService {}
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when object literal contains environment variable references', () => {
    createTestProject({
      'config.ts': `
        const REDIS_URL = process.env.REDIS_URL;
        const API_KEY = process.env.API_KEY;

        export const config = {
          redis: {
            url: REDIS_URL,
            maxRetries: 3,
          },
          api: {
            key: API_KEY,
          },
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when object literal contains property access', () => {
    createTestProject({
      'worker-config.ts': `
        const baseConfig = { level: 'info' };

        export const workerConfig = {
          logging: {
            level: baseConfig.level,
          },
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when object literal contains function calls', () => {
    createTestProject({
      'settings.ts': `
        function getDefaultTimeout() { return 5000; }

        export const settings = {
          timeout: getDefaultTimeout(),
          retries: 3,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when object literal contains template literals with expressions', () => {
    createTestProject({
      'endpoints.ts': `
        const API_VERSION = 'v1';

        export const endpoints = {
          users: \`/api/\${API_VERSION}/users\`,
          items: '/api/items',
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when object literal contains spread operator', () => {
    createTestProject({
      'merged-config.ts': `
        const defaults = { timeout: 5000 };

        export const mergedConfig = {
          ...defaults,
          apiKey: 'test',
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const is initialized with multi-line function call', () => {
    createTestProject({
      'database.ts': `
        import { createPool } from 'mysql2';

        export const pool = createPool(
          {
            host: 'localhost',
            user: 'root',
          }
        );
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when const is initialized with chained method calls', () => {
    createTestProject({
      'client.ts': `
        import axios from 'axios';

        export const client = axios.create({
          baseURL: 'https://api.example.com',
        });
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should still detect pure literal object exports (no runtime values)', () => {
    createTestProject({
      'constants.ts': `
        export const config = {
          apiKey: 'test',
          timeout: 5000,
          enabled: true,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(1);
  });

  it('should still detect pure literal array exports', () => {
    createTestProject({
      'data.ts': `
        export const items = ['one', 'two', 'three'];
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(1);
  });

  it('should still detect pure literal primitive exports', () => {
    createTestProject({
      'constants.ts': `
        export const API_KEY = 'my-api-key';
        export const MAX_RETRIES = 3;
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(2);
  });

  it('should handle mixed runtime and literal const exports', () => {
    createTestProject({
      'mixed.ts': `
        import pino from 'pino';

        // Runtime - should pass
        export const logger = pino({ level: 'info' });

        // Literal - should fail
        export const MAX_RETRIES = 3;
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(1);
  });

  it('should pass when const export uses process.env directly', () => {
    createTestProject({
      'env-config.ts': `
        export const config = {
          port: process.env.PORT,
          host: process.env.HOST,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when value is on next line after equals sign', () => {
    createTestProject({
      'multi-line.ts': `
        export const instance =
          new MyClass({ option: true });

        class MyClass {
          constructor(opts: { option: boolean }) {}
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when function call is on next line after equals sign', () => {
    createTestProject({
      'deferred-init.ts': `
        export const client =
          createClient({ url: 'http://localhost' });

        function createClient(opts: { url: string }) { return opts; }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.exitCode).toBe(0);
    expect(result?.violationCount).toBe(0);
  });

  // ===== ALLOW-EXPORTS FLAG TESTS =====

  it('should pass when file matches --allow-exports pattern (schemas)', () => {
    createTestProject({
      'schemas/user.ts': `
        import { Type, Static } from '@sinclair/typebox';

        export type UserRole = 'admin' | 'user' | 'guest';

        export const UserRoleValues = ['admin', 'user', 'guest'] as const;

        export const UserSchema = Type.Object({
          id: Type.String(),
          name: Type.String(),
        });

        export type User = Static<typeof UserSchema>;
      `,
    });

    // Without flag - should fail
    const resultWithoutFlag = runCheck();
    expect(resultWithoutFlag?.passed).toBe(false);

    // With flag - should pass
    const resultWithFlag = runCheck({ allowExportsPatterns: ['schemas/**'] });
    expect(resultWithFlag?.passed).toBe(true);
    expect(resultWithFlag?.violationCount).toBe(0);
  });

  it('should pass when file matches --allow-exports pattern (config)', () => {
    createTestProject({
      'config/database.ts': `
        export interface DatabaseConfig {
          host: string;
          port: number;
        }

        export const databaseConfig: DatabaseConfig = {
          host: 'localhost',
          port: 5432,
        };
      `,
    });

    // Without flag - should fail (interface from non-types file)
    const resultWithoutFlag = runCheck();
    expect(resultWithoutFlag?.passed).toBe(false);

    // With flag - should pass
    const resultWithFlag = runCheck({ allowExportsPatterns: ['config/**'] });
    expect(resultWithFlag?.passed).toBe(true);
  });

  it('should still fail for files not matching --allow-exports pattern', () => {
    createTestProject({
      'schemas/user.ts': `
        export type User = { name: string; };
      `,
      'services/user.service.ts': `
        export interface User {
          id: string;
          name: string;
        }
      `,
    });

    // With schemas pattern - services should still fail
    const result = runCheck({ allowExportsPatterns: ['schemas/**'] });

    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBe(1);
  });

  it('should support multiple --allow-exports patterns', () => {
    createTestProject({
      'schemas/user.ts': `
        export type User = { name: string; };
      `,
      'config/db.ts': `
        export interface DbConfig { host: string; }
      `,
      'services/auth.ts': `
        export type AuthToken = string;
      `,
    });

    // With both patterns - only services should fail
    const result = runCheck({
      allowExportsPatterns: ['schemas/**', 'config/**'],
    });

    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBe(1);
  });

  it('should still run barrel-files check on files matching --allow-exports', () => {
    // This test verifies that --allow-exports only affects type-exports check
    // Other checks should still run on these files
    // (barrel-files check is separate, so this just documents the behavior)
    createTestProject({
      'schemas/user.ts': `
        export type User = { name: string; };
      `,
    });

    const result = runCheck({ allowExportsPatterns: ['schemas/**'] });

    // type-exports check should pass due to --allow-exports
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should handle nested directory patterns', () => {
    createTestProject({
      'src/domain/schemas/user.ts': `
        export type User = { name: string; };
      `,
    });

    // Pattern with ** prefix should match nested directories
    const result = runCheck({ allowExportsPatterns: ['**/schemas/**'] });

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  // ===== TYPES/ DIRECTORY RELAXED ENFORCEMENT TESTS =====

  it('should allow any exports from types/ directory (mixed content)', () => {
    createTestProject({
      'types/alerts.ts': `
        export interface ThresholdCondition {
          threshold: number;
          operator: 'gt' | 'lt' | 'eq';
        }

        export interface RuleTriggerCondition {
          tests: string[];
        }

        export type AlertCondition = ThresholdCondition | RuleTriggerCondition;

        // Type guards - allowed
        export function isThresholdCondition(
          condition: AlertCondition
        ): condition is ThresholdCondition {
          return 'threshold' in condition && 'operator' in condition;
        }

        export function isRuleTriggerCondition(
          condition: AlertCondition
        ): condition is RuleTriggerCondition {
          return 'tests' in condition && Array.isArray(condition.tests);
        }

        // Constants - allowed
        export const DEFAULT_TIMEOUT = 5000;
        export const STATUS_VALUES = ['active', 'inactive'] as const;
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should allow constants, functions, and classes in types/ directory', () => {
    createTestProject({
      'types/full-example.ts': `
        // Types
        export interface Config {
          timeout: number;
        }

        // Constants (now allowed)
        export const DEFAULT_TIMEOUT = 5000;
        export const API_VERSION = 'v1';
        export const SUPPORTED_FORMATS = ['json', 'xml'];

        // Functions (now allowed)
        export function createConfig(timeout: number): Config {
          return { timeout };
        }

        // Classes (now allowed)
        export class ConfigManager {
          constructor(public config: Config) {}
        }
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should still flag type re-export anti-pattern in types/ directory', () => {
    createTestProject({
      'types/index.ts': `
        export type * from './user';
      `,
      'types/user.ts': `
        export type User = { name: string; };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.exitCode).toBe(1);
    expect(result?.violationCount).toBe(1);
  });

  it('should allow schema library exports in types/ directory', () => {
    createTestProject({
      'types/schemas.ts': `
        import { Type } from '@sinclair/typebox';

        export type User = { name: string; };

        export const UserSchema = Type.Object({
          name: Type.String(),
        });

        export const UserRoles = ['admin', 'user', 'guest'] as const;
      `,
    });

    const result = runCheck();
    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  // ===== _testExports PATTERN TESTS =====

  it('should pass when _testExports contains function references (shorthand)', () => {
    createTestProject({
      'services/query-executor.ts': `
        function internalParse(sql: string) {
          return sql;
        }

        function internalValidate(query: string) {
          return true;
        }

        export function executeQuery(sql: string) {
          const parsed = internalParse(sql);
          if (!internalValidate(parsed)) {
            throw new Error('Invalid query');
          }
          return parsed;
        }

        export const _testExports = {
          internalParse,
          internalValidate,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when _testExports uses explicit property syntax', () => {
    createTestProject({
      'services/utils.ts': `
        function helper1() {}
        function helper2() {}

        export const _testExports = {
          helper1: helper1,
          helper2: helper2,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should pass when object contains nested identifier reference', () => {
    createTestProject({
      'services/parser.ts': `
        const parse = {
          json: (s: string) => JSON.parse(s),
          xml: (s: string) => s,
        };

        export const _testExports = {
          parse,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });

  it('should still fail when object contains mixed values (identifier + literal)', () => {
    createTestProject({
      'services/config.ts': `
        function getDefaultTimeout() {
          return 5000;
        }

        export const _config = {
          getDefaultTimeout,
          maxRetries: 3,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBe(1);
  });

  it('should still fail when object contains only literals', () => {
    createTestProject({
      'config.ts': `
        export const config = {
          apiKey: 'test',
          timeout: 5000,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(false);
    expect(result?.violationCount).toBe(1);
  });

  it('should pass when object has single identifier value', () => {
    createTestProject({
      'services/singleton.ts': `
        function createInstance() {
          return { id: 1 };
        }

        const instance = createInstance();

        export const _testExports = {
          instance,
        };
      `,
    });

    const result = runCheck();

    expect(result?.passed).toBe(true);
    expect(result?.violationCount).toBe(0);
  });
});
