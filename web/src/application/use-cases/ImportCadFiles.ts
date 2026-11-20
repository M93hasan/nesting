import type { CadGeometry } from '../ports/CadGeometry';
export async function importCadFiles(
  geometry: CadGeometry,
  files: { name: string; text: string }[],
  revision: number,
  runId: number,
  options: { scale: number; tolerance?: number; enclosed?: 'holes' | 'parts'; layers?: string[] },
) {
  return geometry.importFiles(files, revision, runId, options);
}
