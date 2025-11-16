/**
 * Shared utility types for lib functions
 */

/**
 * Represents a violation found by a check
 */
export interface Violation {
  /**
   * File path where the violation was found
   */
  file: string;

  /**
   * Line number where the violation occurs (optional)
   */
  line?: number;

  /**
   * The actual code content that violates the rule (optional)
   */
  content?: string;

  /**
   * Human-readable message describing the violation (optional)
   */
  message?: string;

  /**
   * Type/category of the violation (optional)
   */
  type?: string;

  /**
   * Severity level (e.g., 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW') (optional)
   */
  severity?: string;

  /**
   * Reason why this is a violation (optional)
   */
  reason?: string;
}

/**
 * Represents a warning (non-blocking issue) found by a check
 */
export interface Warning {
  /**
   * File path where the warning was found
   */
  file: string;

  /**
   * Line number where the warning occurs (optional)
   */
  line?: number;

  /**
   * Human-readable message describing the warning
   */
  message: string;

  /**
   * Suggestion for how to fix the warning (optional)
   */
  suggestion?: string;
}

/**
 * Options for the Formatter class
 * Empty for now - kept for backward compatibility if needed
 */
export interface FormatterOptions {
  // No options needed for minimal format
}

/**
 * Options to pass to the finish() method
 */
export interface FinishOptions {
  /**
   * Whether this check should block (exit with non-zero code)
   */
  blocking?: boolean;

  /**
   * Exit code to use (defaults to 1 if blocking, 0 otherwise)
   */
  exitCode?: number;

  /**
   * Additional context about why this check matters (optional)
   */
  whyItMatters?: string[];

  /**
   * How to fix violations (optional)
   */
  howToFix?: string[];

  /**
   * If true, return the exit code instead of calling process.exit()
   * Useful for CLI aggregation of multiple checks
   */
  noExit?: boolean;
}

/**
 * Options for getTypeScriptFiles function
 */
export interface GetTypeScriptFilesOptions {
  /**
   * Project root directory (defaults to process.cwd())
   */
  projectRoot?: string;
}

/**
 * TypeScript configuration file structure (simplified)
 */
export interface TSConfig {
  /**
   * Compiler options
   */
  compilerOptions?: TSConfigCompilerOptions;

  /**
   * Files to include (glob patterns)
   */
  include?: string[];

  /**
   * Files to exclude (glob patterns)
   */
  exclude?: string[];

  /**
   * Explicit list of files to compile
   */
  files?: string[];

  /**
   * Whether to extend another config
   */
  extends?: string;
}

/**
 * TypeScript compiler options (simplified subset)
 */
export interface TSConfigCompilerOptions {
  /**
   * Base directory for resolving non-relative module names
   */
  baseUrl?: string;

  /**
   * Output directory for compiled files
   */
  outDir?: string;

  /**
   * Root directory of source files
   */
  rootDir?: string;

  /**
   * Module resolution strategy
   */
  moduleResolution?: string;

  /**
   * List of path mappings
   */
  paths?: Record<string, string[]>;
}
