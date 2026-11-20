import type { Document, Result } from '../../model';

/** A transport-agnostic view of a solver run. */
export type NestingProgress =
  | { type: 'phase'; name: string; elapsedMs: number }
  | { type: 'candidate'; result: Result; sequence: number }
  | { type: 'diagnostic'; message: string };

export interface NestingRunOptions {
  revision: number;
  signal?: AbortSignal;
  onProgress?: (event: NestingProgress) => void;
}

/** Implemented by a Worker/WASM adapter; never by the domain layer. */
export interface NestingEngine {
  run(document: Document, options: NestingRunOptions): Promise<Result>;
}
