import type { Document, Result } from '../../model';

/** Kept for staged API compatibility with future Promise-based solver consumers. */
export type NestingProgress =
  | { type: 'phase'; name: string; elapsedMs: number }
  | { type: 'candidate'; result: Result; sequence: number }
  | { type: 'diagnostic'; message: string };
export interface NestingRunOptions {
  revision: number;
  signal?: AbortSignal;
  onProgress?: (event: NestingProgress) => void;
}

/**
 * Long-running nesting is a session, not a single Promise: the UI must be
 * able to subscribe, receive previews, stop, invalidate and load snapshots.
 * A transport implementation owns all Worker state.
 */
export interface NestingSession<TSnapshot, TDiagnostics> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TSnapshot;
  activate(): () => void;
  markResultRendered(result?: Result, live?: { result: Result }): void;
  start(document: Document, revision: number, threads?: number, requestedAt?: number): void;
  stop(): void;
  invalidate(): void;
  load(result: Result): void;
  skipToCompression(): void;
  diagnostics: { current: TDiagnostics | undefined };
}

/** The preferred engine contract for interactive nesting. */
export type NestingEngine<TSnapshot, TDiagnostics> = NestingSession<TSnapshot, TDiagnostics>;
