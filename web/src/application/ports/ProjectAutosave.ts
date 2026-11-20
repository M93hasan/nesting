/** Browser-independent cloud autosave boundary. */
export type CloudSaveOutcome = 'saved' | 'signed-out' | 'error';
export interface ProjectAutosave {
  save(name: string, serializedProject: string): Promise<CloudSaveOutcome>;
}
