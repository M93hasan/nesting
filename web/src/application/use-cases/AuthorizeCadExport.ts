import type { CadGeometry } from '../ports/CadGeometry';
import type { CadExportAuthorization } from '../ports/CadExportAuthorization';
import type { Document, Result } from '../../model';

/**
 * Production export invariant: finish geometrical/DXF validation before
 * requesting a chargeable server authorization. Returns text only after
 * the original authorization endpoint succeeds.
 */
export async function authorizeCadExport(
  geometry: CadGeometry,
  authorization: CadExportAuthorization,
  options: {
    sourceDocument: Document;
    exportDocument: Document;
    result?: Result;
    revision: number;
    runId: number;
    fileName: string;
    unit: 'mm' | 'in';
    cloudLabel: string;
  },
): Promise<string> {
  const { sourceDocument, exportDocument, result, revision, runId, fileName, unit, cloudLabel } = options;
  const bundle=await geometry.prepareExport(exportDocument,revision,runId,result);
  const dxf=bundle.dxf;
  const sourceFileName=sourceDocument.parts.find(part=>part.source.format==='dxf'||part.source.format==='plt')?.source.fileName??sourceDocument.name;
  const projectJson=JSON.stringify({
    ...sourceDocument,
    ...(result?{placements:result.placements,result}:{}),
    schemaVersion:1,revision,
    serulaCloud:{label:cloudLabel,ui:{unit}},
  });
  await authorization.authorize(sourceDocument.name,sourceFileName,fileName,dxf,projectJson);
  return dxf;
}
