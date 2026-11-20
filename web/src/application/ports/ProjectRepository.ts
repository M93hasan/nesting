import type { Project } from '../../model';

/** Persistence contract: local recovery and cloud sync may use separate adapters. */
export interface ProjectRepository {
  load(id: string): Promise<Project | null>;
  save(id: string, project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}
