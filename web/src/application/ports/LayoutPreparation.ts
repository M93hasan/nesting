import type { Document } from '../../model';

/** Off-thread layout arrangement contract; no Worker dependency in Application. */
export interface LayoutPreparation {
  arrange(document: Document, revision: number, runId: number, pinnedIds: string[], compact: boolean): Promise<Document>;
}
