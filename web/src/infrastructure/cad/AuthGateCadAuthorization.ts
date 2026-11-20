import type { CadExportAuthorization } from '../../application/ports/CadExportAuthorization';
import { authorizeExport } from '../../AuthGate';

/** Reuse the existing authenticated credits and export-history API. */
export class AuthGateCadAuthorization implements CadExportAuthorization {
  async authorize(projectName: string, sourceFileName: string, fileName: string, dxf: string, projectJson: string): Promise<void> {
    await authorizeExport(projectName, sourceFileName, fileName, dxf, projectJson);
  }
}
