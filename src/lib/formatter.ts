/**
 * Formatter for standardized output across all checks
 */

import type { Violation, Warning, FormatterOptions, FinishOptions } from './types.js';

/**
 * Formatter class for displaying check results in structured or compact format
 */
export class Formatter {
  private checkName: string;
  private format: 'structured' | 'compact';
  private violations: Violation[] = [];
  private warnings: Warning[] = [];
  private suggestions: string[] = [];

  constructor(checkName: string, options: FormatterOptions = {}) {
    this.checkName = checkName;
    this.format = options.format ?? 'structured';
  }

  /**
   * Start the check output
   */
  start(): void {
    if (this.format === 'structured') {
      console.log('─'.repeat(65));
      console.log(`🔍 CHECK: ${this.checkName}`);
      console.log('─'.repeat(65));
      console.log('');
    }
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
   * Finish the check and exit with appropriate code, or return the exit code if noExit is true
   * @param options - Finish options
   * @returns Exit code if noExit is true, otherwise never returns (calls process.exit())
   */
  finish(options: FinishOptions = {}): number {
    const {
      blocking = true,
      exitCode,
      whyItMatters = [],
      howToFix = [],
      noExit = false,
    } = options;

    const hasViolations = this.violations.length > 0;
    const finalExitCode = exitCode ?? (hasViolations && blocking ? 1 : 0);

    if (this.format === 'structured') {
      this.printStructured(hasViolations, howToFix, whyItMatters);
    } else {
      this.printCompact(hasViolations, howToFix);
    }

    if (noExit) {
      return finalExitCode;
    }

    process.exit(finalExitCode);
  }

  /**
   * Print results in structured (detailed) format
   */
  private printStructured(
    hasViolations: boolean,
    howToFix: string[],
    whyItMatters: string[]
  ): void {
    // Status
    if (hasViolations) {
      console.log(`STATUS: ❌ FAILED (${this.violations.length} issue${this.violations.length === 1 ? '' : 's'} found)`);
    } else {
      console.log('STATUS: ✅ PASSED');
    }
    console.log('');

    // Violations
    if (this.violations.length > 0) {
      console.log('VIOLATIONS:');
      this.violations.forEach((violation, index) => {
        const location = violation.line
          ? `${violation.file}:${violation.line}`
          : violation.file;

        console.log(`  ${index + 1}. ${location}`);

        if (violation.severity && violation.type) {
          console.log(`     ${violation.severity}: ${violation.type}`);
        } else if (violation.type) {
          console.log(`     ${violation.type}`);
        }

        if (violation.content) {
          console.log(`     ${violation.content}`);
        }

        if (violation.message) {
          console.log(`     ${violation.message}`);
        }

        if (violation.reason) {
          console.log(`     Reason: ${violation.reason}`);
        }

        console.log('');
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log('WARNINGS:');
      this.warnings.forEach((warning, index) => {
        const location = warning.line
          ? `${warning.file}:${warning.line}`
          : warning.file;

        console.log(`  ${index + 1}. ${location}`);
        console.log(`     ${warning.message}`);

        if (warning.suggestion) {
          console.log(`     Suggestion: ${warning.suggestion}`);
        }

        console.log('');
      });
    }

    // How to fix
    if (howToFix.length > 0) {
      console.log('HOW TO FIX:');
      howToFix.forEach((fix) => {
        console.log(`  • ${fix}`);
      });
      console.log('');
    }

    // Why it matters
    if (whyItMatters.length > 0) {
      console.log('WHY THIS MATTERS:');
      whyItMatters.forEach((reason) => {
        console.log(`  • ${reason}`);
      });
      console.log('');
    }

    // Suggestions
    if (this.suggestions.length > 0) {
      console.log('SUGGESTIONS:');
      this.suggestions.forEach((suggestion) => {
        console.log(`  • ${suggestion}`);
      });
      console.log('');
    }

    console.log('─'.repeat(65));
  }

  /**
   * Print results in compact format
   */
  private printCompact(hasViolations: boolean, howToFix: string[]): void {
    const status = hasViolations ? '❌ FAILED' : '✅ PASSED';
    const count = hasViolations ? ` (${this.violations.length} issue${this.violations.length === 1 ? '' : 's'})` : '';

    console.log(`${this.checkName} ${status}${count}`);
    console.log('');

    // Violations
    if (this.violations.length > 0) {
      this.violations.forEach((violation) => {
        const location = violation.line
          ? `${violation.file}:${violation.line}`
          : violation.file;

        const severity = violation.severity ? `${violation.severity}: ` : '';
        const type = violation.type ?? '';
        const message = violation.message ?? '';
        const display = type || message;

        console.log(`  ${location.padEnd(30)} ${severity}${display}`);
      });
      console.log('');
    }

    // Warnings
    if (this.warnings.length > 0) {
      this.warnings.forEach((warning) => {
        const location = warning.line
          ? `${warning.file}:${warning.line}`
          : warning.file;

        console.log(`  ${location.padEnd(30)} WARNING: ${warning.message}`);
      });
      console.log('');
    }

    // Fix suggestion
    if (howToFix.length > 0) {
      console.log(`Fix: ${howToFix[0]}`);
      if (howToFix.length > 1) {
        howToFix.slice(1).forEach((fix) => {
          console.log(`     ${fix}`);
        });
      }
      console.log('');
    }
  }
}
