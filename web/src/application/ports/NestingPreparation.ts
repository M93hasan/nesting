import type { Document } from '../../model';

export interface NestingPreparation {
  normalize(document: Document, revision: number, runId: number): Promise<Document>;
}
