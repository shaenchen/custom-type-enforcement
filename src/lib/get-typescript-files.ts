/**
 * Utility to discover TypeScript files based on tsconfig.json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TSConfig, GetTypeScriptFilesOptions } from './types.js';

/**
 * Default directories to always exclude
 */
const DEFAULT_EXCLUDES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.next',
  'out',
];

/**
 * Get all TypeScript files based on tsconfig.json configuration
 * @param options - Options for file discovery
 * @returns Array of absolute file paths, or null if tsconfig.json not found
 */
export function getTypeScriptFiles(
  options: GetTypeScriptFilesOptions = {}
): string[] | null {
  const projectRoot = options.projectRoot ?? process.cwd();
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

  // Check if tsconfig.json exists
  if (!fs.existsSync(tsconfigPath)) {
    return null;
  }

  // Read and parse tsconfig.json
  const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
  const tsconfig: TSConfig = JSON.parse(tsconfigContent);

  // Get include patterns (default to all TypeScript files if not specified)
  const includePatterns = tsconfig.include ?? ['**/*'];

  // Get exclude patterns and merge with defaults
  const excludePatterns = [
    ...DEFAULT_EXCLUDES,
    ...(tsconfig.exclude ?? []),
  ];

  // Get explicit files list
  const explicitFiles = tsconfig.files ?? [];

  // Find all files matching the patterns
  const allFiles: string[] = [];

  // Add explicit files
  explicitFiles.forEach((file) => {
    const absolutePath = path.resolve(projectRoot, file);
    if (
      fs.existsSync(absolutePath) &&
      absolutePath.endsWith('.ts') &&
      !absolutePath.endsWith('.d.ts')
    ) {
      allFiles.push(absolutePath);
    }
  });

  // Find files matching include patterns
  includePatterns.forEach((pattern) => {
    const matchedFiles = findFilesMatchingPattern(
      projectRoot,
      pattern,
      excludePatterns
    );
    allFiles.push(...matchedFiles);
  });

  // Remove duplicates and sort
  const uniqueFiles = Array.from(new Set(allFiles));
  return uniqueFiles.sort();
}

/**
 * Find files matching a glob pattern
 */
function findFilesMatchingPattern(
  rootDir: string,
  pattern: string,
  excludePatterns: string[]
): string[] {
  const files: string[] = [];
  const patternRegex = globToRegex(pattern);
  const excludeRegexes = excludePatterns.map((p) => globToRegex(p));

  function scanDirectory(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        // Check if path should be excluded
        const shouldExclude = excludeRegexes.some((regex) =>
          regex.test(relativePath)
        );

        if (shouldExclude) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check if file matches the pattern
          if (
            patternRegex.test(relativePath) &&
            fullPath.endsWith('.ts') &&
            !fullPath.endsWith('.d.ts')
          ) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      return;
    }
  }

  scanDirectory(rootDir);
  return files;
}

/**
 * Convert a glob pattern to a regular expression
 * Supports:
 * - ** (matches any number of directories, including zero)
 * - * (matches any characters except /)
 * - Literal characters
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and /
  let regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Replace ** with a placeholder
  regexPattern = regexPattern.replace(/\*\*/g, '__DOUBLE_STAR__');

  // Replace single * with regex pattern (match anything except /)
  regexPattern = regexPattern.replace(/\*/g, '[^/]*');

  // Replace placeholder with regex pattern for **
  // (?:.*/|) means "either zero or more directories followed by /, or nothing"
  regexPattern = regexPattern.replace(/__DOUBLE_STAR__\//g, '(?:.*/|)');
  regexPattern = regexPattern.replace(/__DOUBLE_STAR__/g, '.*');

  // Anchor the pattern
  regexPattern = `^${regexPattern}$`;

  return new RegExp(regexPattern);
}
