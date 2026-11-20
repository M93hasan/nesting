import type { Document } from '../../model';
import { documentPlacements, withDocumentPlacements } from '../../geometry/placements';
import type { LayoutPreparation } from '../ports/LayoutPreparation';

/**
 * Move the editable preparation coordinates without changing the physical copy
 * offsets. Mirrors and rotations are preserved from original placements.
 */
export async function prepareLayoutDocument(
  adapter: LayoutPreparation, document: Document, revision: number, runId: number,
  pinnedIds: string[] = [], compact = false,
): Promise<Document> {
  const prepared=await adapter.arrange(document,revision,runId,pinnedIds,compact);
  const parts=document.parts.map((part,i)=>({...part,preparationPosition:prepared.parts[i].preparationPosition}));
  const placements=documentPlacements(document).map(placement=>{
    const before=document.parts.find(part=>part.id===placement.partId)!.preparationPosition;
    const after=parts.find(part=>part.id===placement.partId)!.preparationPosition;
    return {...placement,xMm:placement.xMm+after[0]-before[0],yMm:placement.yMm+after[1]-before[1]};
  });
  return withDocumentPlacements({...document,parts},placements);
}
