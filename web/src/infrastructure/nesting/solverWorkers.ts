/**
 * Infrastructure boundary for spawning the three dedicated nesting workers.
 * Keep Vite's static `new Worker(new URL(..., import.meta.url))` paths intact
 * so bundling and worker isolation remain unchanged.
 */
export interface SolverWorkerResources {
  solver?: Pick<Worker, 'postMessage'>;
  preview: Pick<Worker, 'terminate'>;
  validator: Pick<Worker, 'terminate'>;
}

export function createSolverWorkers(): {
  solver: Worker;
  preview: Worker;
  validator: Worker;
} {
  const solver = new Worker(new URL('../../workers/solver.worker.ts', import.meta.url), { type: 'module' });
  let preview: Worker | undefined;
  try {
    preview = new Worker(new URL('../../workers/geometry.worker.ts', import.meta.url), { type: 'module' });
    const validator = new Worker(new URL('../../workers/candidate-validator.worker.ts', import.meta.url), { type: 'module' });
    return { solver, preview, validator };
  } catch (error) {
    // Prevent a stranded worker if a subsequent constructor fails.
    preview?.terminate();
    solver.terminate();
    throw error;
  }
}

/** Preserve existing cancellation semantics: signal solver, terminate auxiliary workers. */
export function releaseSolverWorkers(resources: SolverWorkerResources): void {
  resources.solver?.postMessage({ type: 'stop' });
  resources.preview.terminate();
  resources.validator.terminate();
}
