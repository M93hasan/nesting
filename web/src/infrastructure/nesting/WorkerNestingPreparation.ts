import type { Document } from '../../model';
import type { GeometryReply, GeometryRequest } from '../../workers/protocol';
import { geometryTask } from '../../workers/geometryTask';
import type { NestingPreparation } from '../../application/ports/NestingPreparation';

/** Geometry normalization is still performed by the existing Worker pipeline. */
export class WorkerNestingPreparation implements NestingPreparation {
  constructor(private readonly task: (request: GeometryRequest) => Promise<GeometryReply> = geometryTask) {}

  async normalize(document: Document, revision: number, runId: number): Promise<Document> {
    const response = await this.task({
      type: 'normalize', runId, documentRevision: revision, document,
    });
    if (response.type !== 'normalized') throw Error('Nesting hazırlığı tamamlanamadı.');
    return response.document;
  }
}
