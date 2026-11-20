import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document } from '../src/model';
import { calculateSolverDeadline, scheduleSolverDeadline } from '../src/infrastructure/nesting/solverDeadline';

const doc: Document = { name: 'deadline test', parts: [], settings: { ...DEFAULT_SETTINGS, timeLimitSeconds: 30 } };

describe('solver hard wall-clock deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('subtracts preparation time from the original budget', () => {
    const epoch = Date.now();
    expect(calculateSolverDeadline(doc, 100, 2100, epoch)).toBe(epoch + 28_000);
  });

  it('does not grant more time when preparation exceeds the budget', () => {
    const epoch = Date.now();
    expect(calculateSolverDeadline(doc, 0, 31_000, epoch)).toBe(epoch);
  });

  it('preserves the automatic 59-second default', () => {
    const automatic = { ...doc, settings: { ...doc.settings, timeLimitSeconds: null } };
    expect(calculateSolverDeadline(automatic, 0, 1000, Date.now())).toBe(Date.now() + 58_000);
  });

  it('rescheduling does not extend the original deadline', () => {
    const onDeadline = vi.fn();
    const state = { deadlineAtEpochMs: Date.now() + 10_000, deadline: undefined as ReturnType<typeof setTimeout> | undefined };
    scheduleSolverDeadline(state, onDeadline);
    vi.advanceTimersByTime(4_000);
    scheduleSolverDeadline(state, onDeadline);
    vi.advanceTimersByTime(5_999);
    expect(onDeadline).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDeadline).toHaveBeenCalledTimes(1);
  });

  it('expired deadlines invoke completion immediately and ended runs are ignored', () => {
    const expired = vi.fn();
    scheduleSolverDeadline({ deadlineAtEpochMs: Date.now() - 1 }, expired);
    expect(expired).toHaveBeenCalledTimes(1);
    const ended = vi.fn();
    scheduleSolverDeadline({ ended: 'Complete', deadlineAtEpochMs: Date.now() - 1 }, ended);
    expect(ended).not.toHaveBeenCalled();
  });
});
