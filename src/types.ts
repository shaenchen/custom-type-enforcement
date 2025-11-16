/**
 * Package-level types for custom-type-enforcement
 */

/**
 * Available check names that can be run by the CLI
 */
export type CheckName =
  | 'barrel-files'
  | 'type-exports'
  | 'type-imports'
  | 'type-duplicates'
  | 'inline-types';

/**
 * Options passed to check functions
 */
export interface CheckOptions {
  /**
   * Root directory of the project (defaults to process.cwd())
   */
  projectRoot?: string;

  /**
   * If true, return CheckResult instead of exiting the process
   * Used by CLI to aggregate results from multiple checks
   */
  noExit?: boolean;
}

/**
 * Result returned by check functions
 */
export interface CheckResult {
  /**
   * Name of the check that was run
   */
  checkName: CheckName;

  /**
   * Whether the check passed (true) or failed (false)
   */
  passed: boolean;

  /**
   * Number of violations found
   */
  violationCount: number;

  /**
   * Exit code to use (0 for pass, 1 for fail)
   */
  exitCode: number;

  /**
   * Violations found by this check
   */
  violations: Array<{
    file: string;
    line?: number;
    message: string;
  }>;

  /**
   * How to fix these violations (array of fix steps)
   */
  howToFix: string[];

  /**
   * How to suppress these violations (single instruction line)
   */
  suppressInstruction: string;
}

/**
 * Function signature for check runner functions
 */
export type CheckRunner = (options: CheckOptions) => CheckResult | void;

/**
 * Parsed command-line arguments
 */
export interface ParsedArgs {
  /**
   * List of checks to run
   */
  checks: CheckName[];

  /**
   * Whether help was requested
   */
  help: boolean;
}
