import type { CadGeometry } from '../ports/CadGeometry';
import type { Document, Result } from '../../model';
/**
 * CAD conversion must complete BEFORE any export authorization or charge.
 * Auth/credit processing stays in the existing AuthGate implementation.
 */
export async function prepareCadExport(
  geometry: CadGeometry, document: Document, revision: number, runId: number, result?: Result,
) {
  return geometry.prepareExport(document, revision, runId, result);
}
