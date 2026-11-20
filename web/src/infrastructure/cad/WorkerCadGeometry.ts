import type { Document, Result } from '../../model';
import type { GeometryReply, GeometryRequest } from '../../workers/protocol';
import { geometryTask } from '../../workers/geometryTask';
import type { CadGeometry, CadExportBundle, CadImportReview } from '../../application/ports/CadGeometry';

/**
 * Preserve the existing off-main-thread CAD pipeline. No DXF parsing,
 * interpolation, validation, millimetre conversion or source curves are altered.
 */
export class WorkerCadGeometry implements CadGeometry {
  constructor(private readonly task: (request: GeometryRequest) => Promise<GeometryReply> = geometryTask) {}

  async prepareExport(document: Document, revision: number, runId: number, result?: Result): Promise<CadExportBundle> {
    const reply = await this.task({ type: 'export', runId, documentRevision: revision, document, result });
    if (reply.type !== 'export-result') throw Error('Güncel yerleşimin DXF verisi hazırlanamadı.');
    return reply.bundle;
  }

  async importFiles(
    files: { name: string; text: string }[],
    revision: number,
    runId: number,
    options: { scale: number; tolerance?: number; enclosed?: 'holes' | 'parts'; layers?: string[] },
  ): Promise<CadImportReview> {
    const reply = await this.task({
      type: 'import', runId, documentRevision: revision, files, ...options,
    });
    if (reply.type !== 'import-review') throw Error('Çizim içe aktarılamadı.');
    return reply.review;
  }
}
