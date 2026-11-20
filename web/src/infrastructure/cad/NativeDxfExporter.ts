import type { Document, Placement } from '../../model';
import type { WorldPart } from '../../geometry/validate';
import type { DxfExporter } from '../../application/ports/DxfExporter';
import { exportDXF } from '../../export/dxf';

/** Pure adapter around the existing lossless CAD serializer. */
export class NativeDxfExporter implements DxfExporter {
  serialize(
    document: Document,
    world: WorldPart[],
    placements: Placement[],
    preserveSourceCurves = true,
  ): string {
    return exportDXF(document, world, placements, preserveSourceCurves);
  }
}
