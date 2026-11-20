import type { Project } from '../../model';
/** Recovery is a single latest snapshot; it is not a general multi-project repository. */
export interface RecoveryStore {
  loadLatest(): Promise<Project | undefined>;
  saveLatest(project: Project): Promise<void>;
}
