import type { ProjectAutosave, CloudSaveOutcome } from '../../application/ports/ProjectAutosave';

/** Preserve the existing authenticated endpoint, credentials and exact JSON envelope. */
export class HttpProjectAutosave implements ProjectAutosave {
  constructor(private readonly request: typeof fetch = fetch) {}
  async save(name: string, serializedProject: string): Promise<CloudSaveOutcome> {
    const response = await this.request('/api/project/autosave', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectName: name, projectJson: serializedProject }),
    });
    return response.status === 401 ? 'signed-out' : response.ok ? 'saved' : 'error';
  }
}
