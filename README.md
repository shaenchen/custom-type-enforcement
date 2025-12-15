# @shaenchen/custom-type-enforcement

> Enforce TypeScript type architecture and code quality rules across any TypeScript project

A portable CLI tool that enforces custom TypeScript type architecture patterns and prevents common code quality issues. Works seamlessly with single packages and monorepos.

[![npm version](https://img.shields.io/npm/v/@shaenchen/custom-type-enforcement.svg)](https://www.npmjs.com/package/@shaenchen/custom-type-enforcement)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Philosophy: Opinionated by Design

**This tool enforces opinionated preferences for TypeScript architecture.** Not everyone will agree with these rules, and that's okay. These patterns emerged from real-world experience maintaining large TypeScript codebases where certain architectural decisions proved their worth over time.

### Why These Rules?

While you might initially wonder "what value does this bring?", these checks address common pain points:

- **🔍 Findability**: When types live in predictable locations (`types.ts` files), developers know exactly where to look. No more hunting through implementation files or following circular imports.

- **♻️ Maintainability**: Named types (vs inline types) are searchable, refactorable, and provide better error messages. Changes propagate cleanly through the codebase.

- **🎯 Consistency**: Enforcing patterns across teams prevents the "every file is different" problem that makes codebases hard to navigate as they scale.

- **📦 Modularity**: Preventing barrel files and enforcing type organization reduces circular dependencies and improves tree-shaking.

### Not a One-Size-Fits-All

You don't need to adopt all checks. Use `--checks` to run only what makes sense for your project:
- Just want type organization? Run `--checks=type-exports,type-imports`
- Just want to reduce duplication? Run `--checks=type-duplicates`
- Have legitimate use cases for barrel files? Skip the `barrel-files` check

These rules work best for **medium-to-large codebases** where consistency and maintainability matter more than individual file convenience. For smaller projects or prototypes, some rules might feel like overkill—and that's a valid perspective.

## Features

- 📦 **Architecture**: Enforce clean type organization and imports
- 🔍 **Quality**: Prevent code smells like barrel files and inline types
- ♻️ **Maintainability**: Reduce type duplication across your codebase
- 🚀 **Fast**: Minimal dependencies, runs in seconds
- 🎯 **Configurable**: Run all checks or selectively via CLI flags
- 🌳 **Monorepo-ready**: Works with npm workspaces and multi-package repos

## Table of Contents

- [Philosophy: Opinionated by Design](#philosophy-opinionated-by-design)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Checks](#available-checks)
  - [1. Barrel Files Check](#1-barrel-files-check)
  - [2. Type Exports Check](#2-type-exports-check)
  - [3. Type Imports Check](#3-type-imports-check)
  - [4. Type Duplicates Check](#4-type-duplicates-check)
  - [5. Inline Types Check](#5-inline-types-check)
- [CLI Options](#cli-options)
- [Configuration](#configuration)
- [Monorepo Usage](#monorepo-usage)
- [Ignore Patterns](#ignore-patterns)
- [Output Formats](#output-formats)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install -D @shaenchen/custom-type-enforcement
```

Or use directly with `npx`:

```bash
npx @shaenchen/custom-type-enforcement
```

## Quick Start

Run all checks in your TypeScript project:

```bash
npx custom-type-enforcement
```

Run specific checks only:

```bash
npx custom-type-enforcement --checks=barrel-files,type-exports
```

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "check": "custom-type-enforcement",
    "check:types": "custom-type-enforcement --checks=type-exports,type-imports"
  }
}
```

## Available Checks

### 1. Barrel Files Check

**Purpose**: Prevent pure wrapper files that only re-export from other files.

**Detects**: Files that ONLY contain:
- `export { ... } from '...'`
- `export * from '...'`
- `export type { ... } from '...'`

**Rationale**:
- Makes dependencies explicit
- Prevents circular dependencies
- Improves tree-shaking
- Clearer code navigation

**Example violation**:

```typescript
// ❌ BAD: Pure barrel file (utils/index.ts)
export { formatDate } from './date'
export { parseUrl } from './url'
export * from './helpers'

// ✅ GOOD: Add actual implementation
export { formatDate } from './date'
export { parseUrl } from './url'

// Utility function in this file
export function compose(...fns) {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x)
}
```

**Allow barrel files when needed**:

```typescript
// @barrel-file-allowed
export * from './components'
```

---

### 2. Type Exports Check

**Purpose**: Enforce that types/interfaces/enums are only exported from `types.ts` or `types/{domain}.ts` files.

**Rules**:

✅ **Allowed**:
- Export types from `types.ts` files
- Export types from `types/{domain}.ts` files (can export **anything**: types, functions, constants, classes)
- Export functions/classes from any file
- Define types locally (non-exported) in any file
- Export runtime constants (function calls, `new` expressions, objects with runtime values)
- Export TypeBox/Zod schemas (runtime validators)

❌ **Forbidden**:
- Export types from non-types files
- Export type-like constants (pure literals) from non-types files
- `export type *` pattern (discouraged everywhere, including in types/ directories)

**Example violations**:

```typescript
// ❌ BAD: Exporting types from implementation file (user.service.ts)
export interface User {
  id: string
  name: string
}

export class UserService {
  // ...
}

// ✅ GOOD: Move types to types.ts
// types.ts
export interface User {
  id: string
  name: string
}

// user.service.ts
import type { User } from './types'

export class UserService {
  // ...
}
```

**File path validation**: Types must be in files ending with `types.ts` or containing `/types/` in the path.

**Types/ directories allow anything**: Files in `types/` directories can export anything—types, type guards, helper functions, constants, and classes. This pragmatic approach recognizes that:
- Type guards naturally co-locate with their discriminated union types
- `as const` arrays are often used with Zod schemas
- Default configuration objects belong with their type definitions

```typescript
// ✅ GOOD: types/alerts.ts - all exports allowed
export interface ThresholdCondition {
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
}

export interface RuleCondition {
  rules: string[];
}

export type AlertCondition = ThresholdCondition | RuleCondition;

// Type guards - allowed in types/ directory
export function isThresholdCondition(c: AlertCondition): c is ThresholdCondition {
  return 'threshold' in c;
}

// Constants - allowed in types/ directory
export const ALERT_TYPES = ['threshold', 'rule'] as const;
export const DEFAULT_TIMEOUT = 5000;
```

**Runtime constants are automatically allowed**:

```typescript
// ✅ GOOD: These are runtime values, not type definitions

// Function call initializers
export const logger = pino({ level: 'info' });
export const client = axios.create({ baseURL: 'https://api.example.com' });

// new expressions
export const service = new MyService();
export const pool = new Pool({ connectionString: DB_URL });

// Object literals with runtime values (identifiers, property access, function calls)
export const config = {
  url: process.env.DATABASE_URL,
  timeout: getDefaultTimeout(),
  ...baseConfig,
};

// TypeBox/Zod schemas (runtime validators)
export const UserSchema = Type.Object({ name: Type.String() });
export const EmailSchema = z.string().email();
```

```typescript
// ❌ BAD: These are type-like constants (pure literals)
export const API_KEY = 'my-api-key';        // Primitive literal
export const MAX_RETRIES = 3;               // Primitive literal
export const config = { timeout: 5000 };    // Object with only literals
export const items = ['one', 'two'];        // Array of literals
```

**Allow type exports when needed**:

```typescript
// @type-export-allowed
export interface LegacyType {
  // Special case that needs to be exported from this file
}
```

---

### 3. Type Imports Check

**Purpose**: Enforce that type imports only come from `types.ts` or `types/{domain}.ts` files.

**Rules**:

✅ **Allowed**:
- Import types from `types.ts` files
- Import types from `types/{domain}.ts` files
- Import types from external packages (npm)
- Import types between sibling types files (types file → types file)

❌ **Forbidden**:
- Import types from implementation files
- Import types from non-types files

**Example violations**:

```typescript
// ❌ BAD: Importing type from implementation file
import type { User } from './user.service'

// ✅ GOOD: Import from types file
import type { User } from './types'

// ✅ GOOD: Import from external package
import type { Request, Response } from 'express'
```

**Mixed imports**:

```typescript
// Both syntax variants are detected:
import type { User, Product } from './services' // ❌ BAD
import { type User, UserService } from './services' // ❌ BAD (type from non-types file)

import type { User } from './types' // ✅ GOOD
import { UserService } from './services' // ✅ GOOD
```

**Sibling types file imports are automatically allowed**:

```typescript
// ✅ GOOD: types/charts.ts importing from types/metrics.ts
// Both files are in the types/ directory - this is allowed
import type { Metric, MetricValue } from './metrics';
import type { ValidationError } from './common';

export interface ChartData {
  metric: Metric;
  values: MetricValue[];
}
```

**Allow type imports when needed**:

```typescript
// @type-import-allowed
import type { SpecialType } from './external-library-wrapper'
```

---

### 4. Type Duplicates Check

**Purpose**: Warn about structurally similar types that could be consolidated.

**Detects**:
1. Exact structural matches (field order independent)
2. Optional field variance (same required fields, different optionals)
3. Composition opportunities (subset relationships → use `Pick`/`Omit`)
4. `Required<T>` opportunities (same fields, different optionality)
5. Intersection opportunities (could use `Type1 & Type2`)

**Example violations**:

```typescript
// ❌ BAD: Duplicate types
// types/user.ts
export interface User {
  id: string
  name: string
  email: string
}

// types/customer.ts
export interface Customer {
  id: string
  name: string
  email: string
}

// ✅ GOOD: Use composition
// types/user.ts
export interface BaseUser {
  id: string
  name: string
  email: string
}

export type User = BaseUser
export type Customer = BaseUser

// Or even better, just use one type:
export interface User {
  id: string
  name: string
  email: string
}
```

**Composition opportunities**:

```typescript
// ❌ BAD: Subset duplication
export interface User {
  id: string
  name: string
  email: string
  role: string
}

export interface PublicUser {
  id: string
  name: string
}

// ✅ GOOD: Use Pick
export interface User {
  id: string
  name: string
  email: string
  role: string
}

export type PublicUser = Pick<User, 'id' | 'name'>
```

**Ignore duplicates**:

```typescript
// @type-duplicate-allowed
export interface SpecialCaseType {
  // Intentionally duplicated for specific reason
}
```

**Smart filtering**:
- Ignores types with < 2 fields (too generic)
- Ignores types in the same file (already co-located)
- Only checks types in `types.ts` files

---

### 5. Inline Types Check

**Purpose**: Discourage inline object types in favor of named interfaces/types.

**Detects**:
- Type assertions: `as { ... }`
- Variable declarations: `const x: { ... }`
- Function parameters: `function foo(param: { ... })`
- Return types: `): { ... }`

**Allows**:
- Generic constraints: `<T extends { ... }>`
- Mapped/conditional types: `{ [P in keyof T]: ... }`
- Named type/interface declarations

**Example violations**:

```typescript
// ❌ BAD: Inline object types
function createUser(data: { name: string; email: string }) {
  return data
}

const config: { apiKey: string; timeout: number } = {
  apiKey: 'xxx',
  timeout: 5000
}

// ✅ GOOD: Named types
interface UserData {
  name: string
  email: string
}

interface Config {
  apiKey: string
  timeout: number
}

function createUser(data: UserData) {
  return data
}

const config: Config = {
  apiKey: 'xxx',
  timeout: 5000
}
```

**Rationale**:
- Named types have better error messages
- More searchable and refactorable
- Self-documenting (type name explains intent)
- Can be reused across the codebase

**Allow inline types when appropriate**:

```typescript
// @inline-type-allowed
function legacyApi(opts: { debug: boolean }) {
  // One-off parameter that won't be reused
}
```

---

## CLI Options

```bash
custom-type-enforcement [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--checks=<checks>` | Comma-separated list of checks to run | All checks |
| `--exclude=<patterns>` | Comma-separated glob patterns to exclude files | None |
| `--help` | Show help message | - |

### Excluding Files

Use `--exclude` to skip files matching glob patterns. This is useful for test files, generated code, or other files that don't need type enforcement:

```bash
# Exclude test files
npx custom-type-enforcement --exclude="**/*.test.ts,**/*.spec.ts,**/__tests__/**"

# Exclude generated files
npx custom-type-enforcement --exclude="**/generated/**,**/*.generated.ts"

# Combine with specific checks
npx custom-type-enforcement --checks=type-exports --exclude="**/*.test.ts"
```

### Available Checks

- `barrel-files` - Prevent pure re-export files
- `type-exports` - Enforce type export architecture
- `type-imports` - Enforce type import architecture
- `type-duplicates` - Warn about duplicate types
- `inline-types` - Discourage inline object types

### Examples

Run all checks (default):
```bash
npx custom-type-enforcement
```

Run specific checks:
```bash
npx custom-type-enforcement --checks=barrel-files,type-exports
npx custom-type-enforcement --checks=type-exports,type-imports
```

Get help:
```bash
npx custom-type-enforcement --help
```

---

## Configuration

### package.json Integration

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "check": "custom-type-enforcement",
    "check:types": "custom-type-enforcement --checks=type-exports,type-imports,type-duplicates",
    "check:quality": "custom-type-enforcement --checks=barrel-files,inline-types",
    "precommit": "custom-type-enforcement"
  }
}
```

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  quality-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx custom-type-enforcement
```

### Pre-commit Hook

Using `husky`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "custom-type-enforcement"
    }
  }
}
```

---

## Monorepo Usage

The tool runs from wherever it's called (uses `process.cwd()`). For monorepos, delegate checks via npm workspaces.

### Root package.json

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "check": "npm run check --workspaces --if-present",
    "check:types": "npm run check:types --workspaces --if-present"
  },
  "devDependencies": {
    "@shaenchen/custom-type-enforcement": "^1.0.0"
  }
}
```

### Workspace package.json

```json
{
  "name": "@myorg/api",
  "scripts": {
    "check": "custom-type-enforcement",
    "check:types": "custom-type-enforcement --checks=type-exports,type-imports"
  }
}
```

### Running checks

```bash
# Check all workspaces
npm run check

# Check specific workspace
npm run check -w @myorg/api
```

---

## Ignore Patterns

Suppress false positives using comment directives:

### Barrel Files Check

```typescript
// @barrel-file-allowed
export * from './components'
export * from './utils'
```

### Type Exports Check

```typescript
// @type-export-allowed
export interface LegacyType {
  // Special case requiring export from this file
}

// Can also be placed on the same line
export type SpecialCase = {}; // @type-export-allowed
```

### Type Imports Check

```typescript
// @type-import-allowed
import type { ExternalType } from './wrapper'

// Can also be placed on the same line
import type { LibraryType } from './lib'; // @type-import-allowed
```

### Type Duplicates Check

```typescript
// @type-duplicate-allowed
export interface SpecialCase {
  // Intentionally similar to another type
  id: string
  name: string
}
```

### Inline Types Check

```typescript
// @inline-type-allowed
function legacyFunction(opts: { debug: boolean }) {
  // One-off parameter
}
```

---

## Output Format

The tool uses a minimal, LLM-optimized output format designed for efficient token usage.

### Success (all checks pass):
```
✓ All checks passed
```

### Failures (with violations):
```
✗ 2 checks failed (3 violations)

type-exports (2):
  src/services/user.service.ts:5: Type exported from non-types file
  src/utils/helpers.ts:12: Interface exported from non-types file

Fix: Move type/interface/enum exports to types.ts or types/{domain}.ts files
     Keep functional exports (functions, classes) in implementation files
     Use type composition (Pick, Omit, &) to create variations of types
     To suppress: Add // @type-export-allowed comment on same line or line above

inline-types (1):
  src/app.ts:15: Inline type in function parameter

Fix: Extract inline types to named type aliases or interfaces
     Define types in appropriate types.ts files
     Use descriptive type names that explain the purpose
     To suppress: Add // @inline-type-allowed comment on same line or line above
```

This format:
- Uses 80-90% fewer tokens than the previous format
- Shows only failed checks
- Groups violations by check type
- Provides actionable fix instructions
- Includes suppress instructions at the end of each Fix section

---

## Contributing

Contributions are welcome! Here's how to add a new check:

### 1. Create Check Implementation

Create `src/checks/my-check.ts`:

```typescript
import { getTypeScriptFiles } from '../lib/get-typescript-files.js'
import { Formatter } from '../lib/formatter.js'
import type { CheckOptions, CheckResult } from '../types.js'
import * as fs from 'fs'

/**
 * Run my custom check
 */
export function runMyCheck(options: CheckOptions = {}): CheckResult | void {
  const formatter = new Formatter('My Check')
  formatter.start()

  const files = getTypeScriptFiles({ projectRoot: options.projectRoot })
  if (!files) {
    console.error('ERROR: No TypeScript files found')
    process.exit(1)
  }

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // Your check logic here
      if (/* violation detected */) {
        formatter.addViolation({
          file,
          line: index + 1,
          content: line.trim(),
          message: 'Violation description',
          severity: 'HIGH',
        })
      }
    })
  }

  const exitCode = formatter.finish({
    blocking: true,
    noExit: options.noExit,
    howToFix: [
      'How to fix this issue',
      'Alternative solution'
    ],
    whyItMatters: [
      'Why this check is important',
      'What problems it prevents'
    ],
  })

  if (options.noExit) {
    return {
      checkName: 'my-check',
      passed: exitCode === 0,
      violationCount: formatter.getViolationCount(),
      exitCode,
      violations: formatter.getViolations().map(v => ({
        file: v.file,
        line: v.line,
        message: v.message ?? 'Violation detected',
      })),
      howToFix: [
        'How to fix this issue',
        'Alternative solution'
      ],
      suppressInstruction: 'To suppress: Add // @my-check-allowed comment on same line or line above',
    }
  }
}
```

### 2. Add to CLI

Update `src/cli/index.ts`:

```typescript
import { runMyCheck } from '../checks/my-check.js'

const CHECK_RUNNERS: Record<CheckName, CheckRunner> = {
  // ... existing checks
  'my-check': runMyCheck,
}
```

### 3. Update Types

Add to `src/types.ts`:

```typescript
export type CheckName =
  | 'barrel-files'
  // ... existing checks
  | 'my-check'
```

### 4. Write Tests

Create `tests/my-check.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { runMyCheck } from '../src/checks/my-check'

describe('My Check', () => {
  it('should detect violations', () => {
    // Test implementation
  })
})
```

### 5. Update Documentation

Add check description to README.md.

---

## Requirements

- **Node.js**: >= 18.0.0
- **TypeScript**: Project must have `tsconfig.json` in root directory

---

## Troubleshooting

### Error: No tsconfig.json found

The tool must be run from a TypeScript project root containing `tsconfig.json`.

```bash
# Make sure you're in the right directory
cd /path/to/your/typescript/project

# Verify tsconfig.json exists
ls tsconfig.json

# Run the tool
npx custom-type-enforcement
```

### Monorepo: Checks not running in workspaces

Make sure:
1. Each workspace has the check script in its `package.json`
2. You're using `--workspaces --if-present` in the root script
3. The tool is installed (either in root or workspace `devDependencies`)

### False positives

Use ignore comments to suppress false positives:
- `// @barrel-file-allowed` - Allow barrel files
- `// @type-export-allowed` - Allow type exports from non-types files
- `// @type-import-allowed` - Allow type imports from non-types files
- `// @type-duplicate-allowed` - Ignore type duplicates
- `// @inline-type-allowed` - Allow inline object types

All flags can be placed either on the same line or on the line above the code.

---

## License

MIT © Steve Haenchen

See [LICENSE](LICENSE) file for details.

---

## Links

- [npm package](https://www.npmjs.com/package/@shaenchen/custom-type-enforcement)
- [GitHub repository](https://github.com/shaenchen/custom-type-enforcement)
- [Issue tracker](https://github.com/shaenchen/custom-type-enforcement/issues)

---

**Built with ❤️ to enforce code quality and architectural consistency in TypeScript projects.**
