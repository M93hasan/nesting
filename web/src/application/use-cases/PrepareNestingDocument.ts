import type { NestingPreparation } from '../ports/NestingPreparation';
import type { Document } from '../../model';

/** No React state, no Worker imports and no material geometry mutations. */
export function prepareNestingDocument(
  preparation: NestingPreparation,
  document: Document,
  revision: number,
  runId: number,
): Promise<Document> {
  return preparation.normalize(document, revision, runId);
}
