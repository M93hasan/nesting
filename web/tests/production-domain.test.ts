import { describe, expect, it } from 'vitest';
import { newPart, DEFAULT_SETTINGS, type Document, type Result } from '../src/model';
import { productionTotals as domainTotals } from '../src/domain/production/productionTotals';
import { productionTotals as legacyTotals } from '../src/geometry/production';

const documentWith = (settings: Partial<Document['settings']> = {}): Document => ({
  name: 'Test',
  parts: [{ ...newPart([[0, 0], [10, 0], [10, 10], [0, 10]]), quantity: 3 }],
  settings: { ...DEFAULT_SETTINGS, ...settings },
  seriesMultiplier: 2,
});

const resultWith = (overrides: Partial<Result> = {}): Result => ({
  documentRevision: 1,
  solverRevision: 'test',
  seed: 'test',
  elapsedSeconds: 0,
  usedLengthMm: 12.345,
  placements: [],
  validation: {
    status: 'passed',
    overlapAreaMm2: 0,
    maxBoundaryViolationMm: 0,
    minClearanceMm: null,
    errors: [],
  },
  ...overrides,
});

describe('domain production totals extraction', () => {
  it('preserves the old import contract', () => {
    const doc = documentWith();
    expect(legacyTotals(doc, resultWith())).toEqual(domainTotals(doc, resultWith()));
  });

  it('calculates roll material and production-only copies', () => {
    expect(domainTotals(documentWith(), resultWith())).toEqual({
      piecesPerSeries: '3',
      totalPieces: '6',
      material: { amount: '24.69', unit: 'mm' },
    });
  });

  it('calculates sheet counts without duplicating expanded copies', () => {
    const doc = { ...documentWith({ materialType: 'sheet' as const }), seriesCountMode: 'expanded' as const };
    expect(domainTotals(doc, resultWith({ sheetCount: 2 }))).toEqual({
      piecesPerSeries: '1',
      totalPieces: '3',
      material: { amount: '2', unit: 'plaka' },
    });
  });

  it('rejects invalid series multiplier', () => {
    expect(() => domainTotals({ ...documentWith(), seriesMultiplier: 0 })).toThrow();
  });
});
