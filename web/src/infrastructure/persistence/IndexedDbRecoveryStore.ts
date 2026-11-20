import type { Project } from '../../model';
import type { RecoveryStore } from '../../application/ports/RecoveryStore';
import { readRecovery, saveRecovery } from '../../storage/recovery';

/** Wrap the original IndexedDB transaction logic without migrating stored data. */
export class IndexedDbRecoveryStore implements RecoveryStore {
  loadLatest(): Promise<Project | undefined> { return readRecovery(); }
  async saveLatest(project: Project): Promise<void> { await saveRecovery(project); }
}
