import type { Document } from '../../model';
import { wallClockLimitSeconds } from '../../domain/nesting/wallClockLimitSeconds';

/**
 * Deadline counts preparation and worker startup time. Background tab changes
 * must not reset the original hard wall-clock budget.
 */
export function calculateSolverDeadline(
  document: Document,
  requestedAt: number,
  nowPerformance: number,
  nowEpoch: number,
): number {
  const alreadyElapsedMs = Math.max(0, nowPerformance - requestedAt);
  return nowEpoch + Math.max(0, wallClockLimitSeconds(document) * 1000 - alreadyElapsedMs);
}

export interface DeadlineState {
  ended?: string;
  deadline?: ReturnType<typeof setTimeout>;
  deadlineAtEpochMs?: number;
}

/** Re-arm an existing deadline after visibility changes without extending it. */
export function scheduleSolverDeadline(state: DeadlineState, onDeadline: () => void): void {
  if (state.ended) return;
  if (state.deadline) clearTimeout(state.deadline);
  const remaining = Math.max(0, (state.deadlineAtEpochMs ?? Date.now()) - Date.now());
  if (remaining <= 0) {
    onDeadline();
    return;
  }
  state.deadline = setTimeout(onDeadline, remaining);
}
