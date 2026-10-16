/** Select a safe solver pool size, leaving CPU resources for the editor.
 * Browsers can limit hardwareConcurrency for privacy; honor the reported value.
 * A multi-threaded WASM worker needs both cross-origin isolation and SharedArrayBuffer.
 */
export function chooseAutomaticSolverThreads(
  logicalCores: number | undefined,
  isolated: boolean,
  sharedMemory: boolean
): 1 | 2 | 3 {
  if (!isolated || !sharedMemory || !Number.isFinite(logicalCores)
    || !Number.isInteger(logicalCores) || (logicalCores ?? 0) < 1) return 1;
  if (logicalCores! >= 6) return 3;
  if (logicalCores! >= 4) return 2;
  return 1;
}

export function automaticSolverThreads(): 1 | 2 | 3 {
  return chooseAutomaticSolverThreads(
    typeof navigator==='undefined' ? undefined : navigator.hardwareConcurrency,
    typeof crossOriginIsolated!=='undefined' && crossOriginIsolated,
    typeof SharedArrayBuffer!=='undefined'
  );
}
