import type { Document } from '../../model';
import type { LayoutPreparation } from '../../application/ports/LayoutPreparation';
import type { GeometryRequest, GeometryReply } from '../../workers/protocol';
import { geometryTask } from '../../workers/geometryTask';

/** Retains geometry Worker message identity, preparation inputs and error handling. */
export class WorkerLayoutPreparation implements LayoutPreparation {
  constructor(private readonly task: (request: GeometryRequest) => Promise<GeometryReply> = geometryTask) {}
  async arrange(document: Document, revision: number, runId: number, pinnedIds: string[], compact: boolean): Promise<Document> {
    const reply=await this.task({type:'prepare-layout',runId,documentRevision:revision,document,pinnedIds,compact});
    if(reply.type!=='normalized')throw Error('Hazırlık çizimi düzenlenemedi.');
    return reply.document;
  }
}
