import type { Document, Result } from '../../model';
import type { Identity, SolverMessage } from '../../workers/protocol';

/** Treat obsolete run/revision messages as stale: never apply them to a new run. */
export interface SolverRunIdentity { id: number; revision: number }

export function matchesRunMessage(message: Identity, run: SolverRunIdentity): boolean {
  return message.runId === run.id && message.documentRevision === run.revision;
}

export interface ValidatedCandidateMessage extends Identity {
  type: 'validated-candidate';
  sequence: number;
  result?: Result;
  error?: string;
}

/**
 * A validator response is actionable only for the run's in-flight candidate.
 * Late responses after invalidation or for an older sequence must be ignored.
 */
export function matchesValidationReply(
  message: ValidatedCandidateMessage,
  run: SolverRunIdentity,
  checkingSequence: number | undefined,
): boolean {
  return message.type === 'validated-candidate'
    && matchesRunMessage(message, run)
    && checkingSequence !== undefined
    && message.sequence === checkingSequence;
}

export type WorkerSender = Pick<Worker, 'postMessage'>;

/** Send the original typed start envelope without changing the Worker protocol. */
export function startNestingWorker(
  worker: WorkerSender,
  run: SolverRunIdentity,
  document: Document,
  seed: string,
  threads: number | undefined,
  hardLimitMs: number,
): void {
  worker.postMessage({
    type: 'start',
    runId: run.id,
    documentRevision: run.revision,
    document,
    seed,
    threads,
    hardLimitMs,
  } satisfies Extract<import('../../workers/protocol').Start, { type: 'start' }>);
}

/** Initialize validation and live-preview workers in the existing order. */
export function initializeNestingWorkers(
  validator: WorkerSender,
  preview: WorkerSender,
  run: SolverRunIdentity,
  document: Document,
): void {
  validator.postMessage({ type: 'init', document });
  preview.postMessage({
    type: 'live-preview-init',
    runId: run.id,
    documentRevision: run.revision,
    document,
  });
}

export function validateNestingCandidate(
  validator: WorkerSender,
  run: SolverRunIdentity,
  sequence: number,
  result: Result,
): void {
  validator.postMessage({
    type: 'validate',
    runId: run.id,
    documentRevision: run.revision,
    sequence,
    result,
  });
}

/** Preserve the typed solver message contract for future Worker adapters. */
export type NestingSolverReply = SolverMessage;
