import type { Document, Placement } from '../../model';
import type { WorldPart } from '../../geometry/validate';

/** CAD transport adapter. Geometry validation must happen before this call. */
export interface DxfExporter {
  serialize(
    document: Document,
    world: WorldPart[],
    placements: Placement[],
    preserveSourceCurves?: boolean,
  ): string;
}
