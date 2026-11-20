/** Authorizes a chargeable DXF export; implementations must not silently bypass it. */
export interface CadExportAuthorization {
  authorize(projectName: string, sourceFileName: string, fileName: string, dxf: string, projectJson: string): Promise<void>;
}
