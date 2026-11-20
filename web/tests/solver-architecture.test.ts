import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS, newPart, type Document } from '../src/model';
import { candidateResult } from '../src/infrastructure/nesting/candidateResult';
import { phaseImprovements } from '../src/application/nesting/phaseImprovements';
import { wallClockLimitSeconds } from '../src/domain/nesting/wallClockLimitSeconds';
import { candidateResult as legacyCandidateResult, phaseImprovements as legacyPhaseImprovements, wallClockLimitSeconds as legacyClock } from '../src/workers/useSolver';
import type { Candidate } from '../src/workers/protocol';

const doc: Document = { name: 'sheet', settings: { ...DEFAULT_SETTINGS, materialType: 'sheet', materialLengthMm: 100 }, parts: [{ ...newPart([[0,0],[10,0],[10,10],[0,10]]), id: 'p', quantity: 1 }], placements: [{ partId: 'p', copyIndex: 0, xMm: 0, yMm: 0, angleDeg: 0, mirrorX: true }] };
const candidate = { type: 'candidate', runId: 1, documentRevision: 7, sequence: 1, report: 'SheetFeas', elapsedMs: 1500, solution: { strip_width: 120, layout: { placed_items: [{ item_id: 0, transformation: { rotation: 90, translation: [120, 12], reflected: false } }] } } } as Candidate;

test('candidate mapping keeps sheet index, translation, inverse rotation and original mirror', () => {
  const value = candidateResult(doc, candidate, 'seed');
  expect(value.placements).toEqual([{ partId: 'p', copyIndex: 0, xMm: 12, yMm: 20, angleDeg: -90, mirrorX: true, sheetIndex: 1 }]);
  expect(value.documentRevision).toBe(7);
  expect(value.elapsedSeconds).toBe(1.5);
  expect(value.validation.status).toBe('pending');
  expect(legacyCandidateResult).toBe(candidateResult);
});

test('reflected candidates are rejected rather than silently transformed', () => {
  const reflected: Candidate = { ...candidate, solution: { ...candidate.solution, layout: { placed_items: [{ item_id: 0, transformation: { rotation: 0, translation: [0, 0], reflected: true } }] } } };
  expect(() => candidateResult(doc, reflected, 'seed')).toThrow(/reflected/);
});

test('phase metrics preserve public interface', () => {
  const history = [{ sequence: 1, elapsedMs: 100, lengthMm: 100, validation: 'passed', phase: 'Exploration' }, { sequence: 2, elapsedMs: 200, lengthMm: 80, validation: 'passed', phase: 'Exploration' }, { sequence: 3, elapsedMs: 300, lengthMm: 70, validation: 'passed', phase: 'Compression' }];
  expect(phaseImprovements(history, 70)).toEqual({ explore: 20, compress: 12.5 });
  expect(legacyPhaseImprovements).toBe(phaseImprovements);
  expect(wallClockLimitSeconds(doc)).toBe(30);
  expect(wallClockLimitSeconds({ ...doc, settings: { ...doc.settings, timeLimitSeconds: null } })).toBe(59);
  expect(legacyClock).toBe(wallClockLimitSeconds);
});
