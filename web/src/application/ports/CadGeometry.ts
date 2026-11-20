import type { Document, Result } from '../../model';
import type { WorldPart } from '../../geometry/validate';

/** Stable CAD types; application must not import concrete import/export implementations. */
export type CadExportBundle = { svg: string; dxf: string; world: WorldPart[] };
export type CadImportReview = {
  document: Document;
  warnings: string[];
  replace: boolean;
  issues?: string[];
  layers?: string[];
  result?: Result;
};

export interface CadGeometry {
  prepareExport(document: Document, revision: number, runId: number, result?: Result): Promise<CadExportBundle>;
  importFiles(
    files: { name: string; text: string }[],
    revision: number,
    runId: number,
    options: { scale: number; tolerance?: number; enclosed?: 'holes' | 'parts'; layers?: string[] },
  ): Promise<CadImportReview>;
}
