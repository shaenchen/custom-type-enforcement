import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Formatter } from '../src/lib/formatter.js';
import type { Violation, Warning } from '../src/lib/types.js';

describe('Formatter', () => {
  let consoleOutput: string[] = [];
  let originalLog: typeof console.log;

  beforeEach(() => {
    consoleOutput = [];
    originalLog = console.log;
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe('Structured Format', () => {
    it('should display structured header on start', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      expect(consoleOutput).toContain('─'.repeat(65));
      expect(consoleOutput).toContain('🔍 CHECK: Test Check');
    });

    it('should display PASSED status with no violations', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();
      const exitCode = formatter.finish({ noExit: true });

      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('STATUS: ✅ PASSED');
    });

    it('should display FAILED status with violations', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      const violation: Violation = {
        file: 'test.ts',
        line: 42,
        type: 'Test Violation',
        message: 'This is a test violation',
      };

      formatter.addViolation(violation);
      const exitCode = formatter.finish({ noExit: true });

      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('STATUS: ❌ FAILED (1 issue found)');
    });

    it('should display multiple violations with proper formatting', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addViolation({
        file: 'test1.ts',
        line: 10,
        type: 'Type A',
        severity: 'HIGH',
        content: 'const x = "test"',
        message: 'First violation',
        reason: 'Because reasons',
      });

      formatter.addViolation({
        file: 'test2.ts',
        line: 20,
        type: 'Type B',
        message: 'Second violation',
      });

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('STATUS: ❌ FAILED (2 issues found)');
      expect(output).toContain('VIOLATIONS:');
      expect(output).toContain('1. test1.ts:10');
      expect(output).toContain('HIGH: Type A');
      expect(output).toContain('const x = "test"');
      expect(output).toContain('First violation');
      expect(output).toContain('Reason: Because reasons');
      expect(output).toContain('2. test2.ts:20');
      expect(output).toContain('Type B');
      expect(output).toContain('Second violation');
    });

    it('should display violation without line number', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'File-level violation',
      });

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('1. test.ts');
      expect(output).not.toContain('test.ts:');
    });

    it('should display warnings', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      const warning: Warning = {
        file: 'test.ts',
        line: 15,
        message: 'This is a warning',
        suggestion: 'Consider refactoring',
      };

      formatter.addWarning(warning);
      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('WARNINGS:');
      expect(output).toContain('1. test.ts:15');
      expect(output).toContain('This is a warning');
      expect(output).toContain('Suggestion: Consider refactoring');
    });

    it('should display how to fix section', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue found',
      });

      formatter.finish({
        noExit: true,
        howToFix: ['Fix option 1', 'Fix option 2', 'Fix option 3'],
      });

      const output = consoleOutput.join('\n');
      expect(output).toContain('HOW TO FIX:');
      expect(output).toContain('• Fix option 1');
      expect(output).toContain('• Fix option 2');
      expect(output).toContain('• Fix option 3');
    });

    it('should display why it matters section', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue found',
      });

      formatter.finish({
        noExit: true,
        whyItMatters: ['Reason 1', 'Reason 2'],
      });

      const output = consoleOutput.join('\n');
      expect(output).toContain('WHY THIS MATTERS:');
      expect(output).toContain('• Reason 1');
      expect(output).toContain('• Reason 2');
    });

    it('should display suggestions', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addSuggestion('Suggestion 1');
      formatter.addSuggestion('Suggestion 2');

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('SUGGESTIONS:');
      expect(output).toContain('• Suggestion 1');
      expect(output).toContain('• Suggestion 2');
    });

    it('should use custom exit code when provided', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue',
      });

      const exitCode = formatter.finish({
        noExit: true,
        exitCode: 42,
      });

      expect(exitCode).toBe(42);
    });

    it('should return 0 when non-blocking with violations', () => {
      const formatter = new Formatter('Test Check', { format: 'structured' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue',
      });

      const exitCode = formatter.finish({
        noExit: true,
        blocking: false,
      });

      expect(exitCode).toBe(0);
    });
  });

  describe('Compact Format', () => {
    it('should not display header on start', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      expect(consoleOutput).toHaveLength(0);
    });

    it('should display compact PASSED status', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();
      const exitCode = formatter.finish({ noExit: true });

      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('Test Check ✅ PASSED');
    });

    it('should display compact FAILED status with count', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        line: 10,
        type: 'Test Type',
        message: 'Test message',
      });

      const exitCode = formatter.finish({ noExit: true });

      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Test Check ❌ FAILED (1 issue)');
    });

    it('should display violations in compact format', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      formatter.addViolation({
        file: 'test1.ts',
        line: 10,
        severity: 'HIGH',
        type: 'Type A',
      });

      formatter.addViolation({
        file: 'test2.ts',
        line: 20,
        message: 'Message B',
      });

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('test1.ts:10');
      expect(output).toContain('HIGH: Type A');
      expect(output).toContain('test2.ts:20');
      expect(output).toContain('Message B');
    });

    it('should display warnings in compact format', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      formatter.addWarning({
        file: 'test.ts',
        line: 15,
        message: 'Warning message',
      });

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('test.ts:15');
      expect(output).toContain('WARNING: Warning message');
    });

    it('should display first fix in compact format', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue',
      });

      formatter.finish({
        noExit: true,
        howToFix: ['Primary fix', 'Secondary fix'],
      });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Fix: Primary fix');
      expect(output).toContain('Secondary fix');
    });

    it('should use singular "issue" for 1 violation', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue',
      });

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('(1 issue)');
      expect(output).not.toContain('(1 issues)');
    });

    it('should use plural "issues" for multiple violations', () => {
      const formatter = new Formatter('Test Check', { format: 'compact' });
      formatter.start();

      formatter.addViolation({ file: 'test1.ts', message: 'Issue 1' });
      formatter.addViolation({ file: 'test2.ts', message: 'Issue 2' });

      formatter.finish({ noExit: true });

      const output = consoleOutput.join('\n');
      expect(output).toContain('(2 issues)');
    });
  });

  describe('Violation Count', () => {
    it('should return correct violation count', () => {
      const formatter = new Formatter('Test Check');

      expect(formatter.getViolationCount()).toBe(0);

      formatter.addViolation({ file: 'test1.ts', message: 'Issue 1' });
      expect(formatter.getViolationCount()).toBe(1);

      formatter.addViolation({ file: 'test2.ts', message: 'Issue 2' });
      expect(formatter.getViolationCount()).toBe(2);

      formatter.addViolation({ file: 'test3.ts', message: 'Issue 3' });
      expect(formatter.getViolationCount()).toBe(3);
    });

    it('should not count warnings as violations', () => {
      const formatter = new Formatter('Test Check');

      formatter.addWarning({ file: 'test.ts', message: 'Warning' });
      expect(formatter.getViolationCount()).toBe(0);

      formatter.addViolation({ file: 'test.ts', message: 'Violation' });
      expect(formatter.getViolationCount()).toBe(1);
    });
  });

  describe('Default Options', () => {
    it('should use structured format by default', () => {
      const formatter = new Formatter('Test Check');
      formatter.start();

      expect(consoleOutput).toContain('─'.repeat(65));
      expect(consoleOutput).toContain('🔍 CHECK: Test Check');
    });

    it('should be blocking by default', () => {
      const formatter = new Formatter('Test Check');
      formatter.start();

      formatter.addViolation({
        file: 'test.ts',
        message: 'Issue',
      });

      const exitCode = formatter.finish({ noExit: true });
      expect(exitCode).toBe(1);
    });
  });
});
