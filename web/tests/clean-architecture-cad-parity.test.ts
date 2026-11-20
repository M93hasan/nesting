import { expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document } from '../src/model';
import { exportDXF } from '../src/export/dxf';
import { NativeDxfExporter } from '../src/infrastructure/cad/NativeDxfExporter';
import { WorkerNestingPreparation } from '../src/infrastructure/nesting/WorkerNestingPreparation';
import { prepareNestingDocument } from '../src/application/use-cases/PrepareNestingDocument';
import type { GeometryRequest, GeometryReply } from '../src/workers/protocol';

const document: Document = { name: 'Original mm drawing', parts: [], settings: DEFAULT_SETTINGS };

test('native DXF adapter is byte-identical to the production serializer', () => {
  const legacy = exportDXF(document, [], [], true);
  expect(new NativeDxfExporter().serialize(document, [], [], true)).toBe(legacy);
});

test('nesting preparation preserves the Worker normalization request', async () => {
  const normalized = { ...document, name: 'Normalized' };
  const task = vi.fn(async (_request: GeometryRequest): Promise<GeometryReply> => ({
    type: 'normalized', runId: 6, documentRevision: 2, document: normalized,
  }));
  const adapter = new WorkerNestingPreparation(task);
  expect(await prepareNestingDocument(adapter, document, 2, 6)).toBe(normalized);
  expect(task).toHaveBeenCalledWith({
    type: 'normalize', runId: 6, documentRevision: 2, document,
  });
});

test('nesting preparation refuses unsuccessful Worker normalization', async () => {
  const task = vi.fn(async (_request: GeometryRequest): Promise<GeometryReply> => ({
    type: 'error', runId: 6, documentRevision: 2, message: 'invalid document',
  }));
  await expect(prepareNestingDocument(new WorkerNestingPreparation(task), document, 2, 6)).rejects.toThrow();
});
