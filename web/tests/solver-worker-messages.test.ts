import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document, type Result } from '../src/model';
import {
  initializeNestingWorkers, matchesRunMessage, matchesValidationReply,
  startNestingWorker, validateNestingCandidate,
} from '../src/infrastructure/nesting/workerMessages';

const doc: Document = { name: 'test', parts: [], settings: DEFAULT_SETTINGS };
const result: Result = {
  documentRevision: 5, solverRevision: 'test', seed: 'seed', elapsedSeconds: 1,
  usedLengthMm: 20, placements: [],
  validation: { status: 'passed', overlapAreaMm2: 0, maxBoundaryViolationMm: 0, minClearanceMm: null, errors: [] },
};
const run = { id: 9, revision: 5 };

describe('nesting worker message boundary', () => {
  it('drops messages from previous runs or document revisions', () => {
    expect(matchesRunMessage({ runId: 9, documentRevision: 5 }, run)).toBe(true);
    expect(matchesRunMessage({ runId: 8, documentRevision: 5 }, run)).toBe(false);
    expect(matchesRunMessage({ runId: 9, documentRevision: 4 }, run)).toBe(false);
  });

  it('accepts only the currently checking candidate response', () => {
    const reply = { type: 'validated-candidate' as const, runId: 9, documentRevision: 5, sequence: 3, result };
    expect(matchesValidationReply(reply, run, 3)).toBe(true);
    expect(matchesValidationReply(reply, run, 2)).toBe(false);
    expect(matchesValidationReply(reply, run, undefined)).toBe(false);
    expect(matchesValidationReply({ ...reply, runId: 8 }, run, 3)).toBe(false);
  });

  it('preserves solver start envelope including deadline and requested threads', () => {
    const worker = { postMessage: vi.fn() };
    startNestingWorker(worker, run, doc, 'seed', 2, 25000);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'start', runId: 9, documentRevision: 5, document: doc,
      seed: 'seed', threads: 2, hardLimitMs: 25000,
    });
  });

  it('initializes validation before geometry preview with the original envelopes', () => {
    const order: string[] = [];
    const validator = { postMessage: vi.fn(() => order.push('validator')) };
    const preview = { postMessage: vi.fn(() => order.push('preview')) };
    initializeNestingWorkers(validator, preview, run, doc);
    expect(order).toEqual(['validator', 'preview']);
    expect(validator.postMessage).toHaveBeenCalledWith({ type: 'init', document: doc });
    expect(preview.postMessage).toHaveBeenCalledWith({
      type: 'live-preview-init', runId: 9, documentRevision: 5, document: doc,
    });
  });

  it('dispatches candidate validation with run and revision identifiers', () => {
    const validator = { postMessage: vi.fn() };
    validateNestingCandidate(validator, run, 12, result);
    expect(validator.postMessage).toHaveBeenCalledWith({
      type: 'validate', runId: 9, documentRevision: 5, sequence: 12, result,
    });
  });
});
