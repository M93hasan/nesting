import type { Document, Result } from '../../model';
import type { ExportBundle } from '../../export/svg';
import type { ImportReview } from '../../import/sparrow';

export interface CadGeometry {
  prepareExport(document: Document, revision: number, runId: number, result?: Result): Promise<ExportBundle>;
  importFiles(
    files: { name: string; text: string }[],
    revision: number,
    runId: number,
    options: { scale: number; tolerance?: number; enclosed?: 'holes' | 'parts'; layers?: string[] },
  ): Promise<ImportReview>;
}
