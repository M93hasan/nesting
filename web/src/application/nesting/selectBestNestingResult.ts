import type { Document, Result } from '../../model';

/**
 * Accept only validated candidates (caller enforces validation.status).
 * Preserve the existing Serula criteria:
 * - Roll: strictly shorter used length.
 * - Sheet: fewer sheets, then shorter native Sparrow strip length.
 * Returned state is explicit so a rejected candidate cannot mutate the run.
 */
export function selectBestNestingResult(input: {
  materialType: Document['settings']['materialType'];
  best?: Result;
  bestSheetSolverLength?: number;
  candidate: Result;
  candidateSolverLength: number;
}): { accepted: boolean; best?: Result; bestSheetSolverLength?: number } {
  const { materialType, best, bestSheetSolverLength, candidate, candidateSolverLength } = input;
  if (candidate.validation.status !== 'passed') {
    return { accepted: false, best, bestSheetSolverLength };
  }

  if (materialType !== 'sheet') {
    const accepted = !best || candidate.usedLengthMm < best.usedLengthMm;
    return {
      accepted,
      best: accepted ? candidate : best,
      bestSheetSolverLength,
    };
  }

  const sheets = candidate.sheetCount ?? 1;
  const bestSheets = best?.sheetCount ?? Infinity;
  const accepted = !best || sheets < bestSheets
    || (sheets === bestSheets
      && (bestSheetSolverLength === undefined || candidateSolverLength < bestSheetSolverLength));
  return {
    accepted,
    best: accepted ? candidate : best,
    bestSheetSolverLength: accepted ? candidateSolverLength : bestSheetSolverLength,
  };
}
