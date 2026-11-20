import type { ProjectAutosave, CloudSaveOutcome } from '../ports/ProjectAutosave';

/** Status is returned to presentation, which decides how to display errors. */
export async function autosaveProject(
  repository: ProjectAutosave,
  name: string,
  serializedProject: string,
): Promise<CloudSaveOutcome> {
  return repository.save(name, serializedProject);
}
