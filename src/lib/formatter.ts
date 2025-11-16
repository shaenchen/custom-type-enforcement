/**
 * Formatter for standardized output across all checks
 */

import type { Violation, Warning, FormatterOptions, FinishOptions } from './types.js';

/**
 * Formatter class for displaying check results in minimal LLM-optimized format
 */
export class Formatter {
  private checkName: string;
  private violations: Violation[] = [];
  private warnings: Warning[] = [];
  private suggestions: string[] = [];

  constructor(checkName: string, _options: FormatterOptions = {}) {
    this.checkName = checkName;
  }

  /**
   * Start the check output (no-op for minimal format)
   */
  start(): void {
    // No output at start for minimal format
  }

  /**
   * Add a violation to the results
   */
  addViolation(violation: Violation): void {
    this.violations.push(violation);
  }

  /**
   * Add a warning to the results
   */
  addWarning(warning: Warning): void {
    this.warnings.push(warning);
  }

  /**
   * Add a suggestion for fixing issues
   */
  addSuggestion(suggestion: string): void {
    this.suggestions.push(suggestion);
  }

  /**
   * Get the current violation count
   */
  getViolationCount(): number {
    return this.violations.length;
  }

  /**
   * Get violations for aggregation in CLI
   */
  getViolations(): Violation[] {
    return this.violations;
  }

  /**
   * Get check name for aggregation
   */
  getCheckName(): string {
    return this.checkName;
  }

  /**
   * Finish the check and return exit code
   * Note: This doesn't print output anymore - output is handled by CLI aggregation
   * @param options - Finish options
   * @returns Exit code
   */
  finish(options: FinishOptions = {}): number {
    const {
      blocking = true,
      exitCode,
      noExit = false,
    } = options;

    const hasViolations = this.violations.length > 0;
    const finalExitCode = exitCode ?? (hasViolations && blocking ? 1 : 0);

    if (noExit) {
      return finalExitCode;
    }

    process.exit(finalExitCode);
  }
}
