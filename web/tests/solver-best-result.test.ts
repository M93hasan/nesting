import { describe, expect, it } from 'vitest';
import type { Result } from '../src/model';
import { selectBestNestingResult } from '../src/application/nesting/selectBestNestingResult';

const result = (usedLengthMm: number, sheetCount?: number, status: 'passed'|'failed'='passed'): Result => ({
  documentRevision: 1,
  solverRevision: 'test',
  seed: 'test',
  elapsedSeconds: 0,
  usedLengthMm,
  ...(sheetCount === undefined ? {} : { sheetCount }),
  placements: [],
  validation: { status, overlapAreaMm2: 0, maxBoundaryViolationMm: 0, minClearanceMm: null, errors: [] },
});

describe('best validated candidate selection', () => {
  it('accepts first roll result, then only strictly shorter results', () => {
    const first = result(100), improved = result(80), equal = result(80);
    expect(selectBestNestingResult({ materialType: 'roll', candidate: first, candidateSolverLength: 100 }))
      .toEqual({ accepted: true, best: first, bestSheetSolverLength: undefined });
    expect(selectBestNestingResult({ materialType: 'roll', best: first, candidate: improved, candidateSolverLength: 80 }).accepted).toBe(true);
    expect(selectBestNestingResult({ materialType: 'roll', best: improved, candidate: equal, candidateSolverLength: 80 }))
      .toEqual({ accepted: false, best: improved, bestSheetSolverLength: undefined });
  });

  it('prioritizes fewer physical sheets over native strip length', () => {
    const best = result(50, 3), candidate = result(300, 2);
    expect(selectBestNestingResult({ materialType: 'sheet', best, bestSheetSolverLength: 50, candidate, candidateSolverLength: 300 }))
      .toEqual({ accepted: true, best: candidate, bestSheetSolverLength: 300 });
  });

  it('breaks equal sheet counts by strict native solver strip width', () => {
    const best = result(90, 2), candidate = result(20, 2);
    expect(selectBestNestingResult({ materialType: 'sheet', best, bestSheetSolverLength: 75, candidate, candidateSolverLength: 75 }))
      .toEqual({ accepted: false, best, bestSheetSolverLength: 75 });
    expect(selectBestNestingResult({ materialType: 'sheet', best, bestSheetSolverLength: 75, candidate, candidateSolverLength: 74 }))
      .toEqual({ accepted: true, best: candidate, bestSheetSolverLength: 74 });
  });

  it('treats absent sheet count as one and initializes missing tie-breaker', () => {
    const best = result(90, 1), candidate = result(80);
    expect(selectBestNestingResult({ materialType: 'sheet', best, candidate, candidateSolverLength: 80 }))
      .toEqual({ accepted: true, best: candidate, bestSheetSolverLength: 80 });
  });

  it('rejects unvalidated or failed candidates even if they look better', () => {
    const best = result(90);
    const candidate = result(1, undefined, 'failed');
    expect(selectBestNestingResult({ materialType: 'roll', best, candidate, candidateSolverLength: 1 }))
      .toEqual({ accepted: false, best, bestSheetSolverLength: undefined });
  });
});
