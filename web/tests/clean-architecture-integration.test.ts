import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document, type Project, type Result } from '../src/model';
import { HttpProjectAutosave } from '../src/infrastructure/persistence/HttpProjectAutosave';
import { autosaveProject } from '../src/application/use-cases/AutosaveProject';
import { IndexedDbRecoveryStore } from '../src/infrastructure/persistence/IndexedDbRecoveryStore';
import { WorkerCadGeometry } from '../src/infrastructure/cad/WorkerCadGeometry';
import { prepareCadExport } from '../src/application/use-cases/PrepareCadExport';
import { importCadFiles } from '../src/application/use-cases/ImportCadFiles';
import { validQuantity, validRotationRule, normalizedRotationRule } from '../src/domain/project/editorRules';
import type { GeometryRequest, GeometryReply } from '../src/workers/protocol';

const document: Document = { name: 'Nesting', parts: [], settings: { ...DEFAULT_SETTINGS } };
const project: Project = { ...document, revision: 1, schemaVersion: 1 };
const result: Result = {
  documentRevision: 1, solverRevision: 'test', seed: 'test', elapsedSeconds: 0,
  usedLengthMm: 25, placements: [],
  validation: { status: 'passed', overlapAreaMm2: 0, maxBoundaryViolationMm: 0, minClearanceMm: null, errors: [] },
};

describe('application and infrastructure boundaries', () => {
  it('retains cloud save endpoint, credentials and request envelope', async () => {
    const fetchStub = vi.fn(async () => ({ ok: true, status: 200 } as Response));
    const repository = new HttpProjectAutosave(fetchStub as unknown as typeof fetch);
    expect(await autosaveProject(repository, 'Nesting', JSON.stringify(project))).toBe('saved');
    expect(fetchStub).toHaveBeenCalledWith('/api/project/autosave', {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectName: 'Nesting', projectJson: JSON.stringify(project) }),
    });
  });

  it('preserves signed-out and failure statuses', async () => {
    const fetchStub = vi.fn(async () => ({ ok: false, status: 401 } as Response));
    const repository = new HttpProjectAutosave(fetchStub as unknown as typeof fetch);
    expect(await repository.save('p', '{}')).toBe('signed-out');
    fetchStub.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    expect(await repository.save('p', '{}')).toBe('error');
  });

  it('keeps latest IndexedDB recovery facade as the same public contract', () => {
    const recovery = new IndexedDbRecoveryStore();
    expect(typeof recovery.loadLatest).toBe('function');
    expect(typeof recovery.saveLatest).toBe('function');
  });

  it('sends original export request through the worker and returns its bundle', async () => {
    const bundle = { dxf: '0\\nEOF\\n', svg: '<svg/>', world: [] };
    const task = vi.fn(async (_request: GeometryRequest): Promise<GeometryReply> => ({
      type: 'export-result', runId: 3, documentRevision: 1, bundle,
    }));
    const adapter = new WorkerCadGeometry(task);
    expect(await prepareCadExport(adapter, document, 1, 3, result)).toEqual(bundle);
    expect(task).toHaveBeenCalledWith({
      type: 'export', runId: 3, documentRevision: 1, document, result,
    });
  });

  it('preserves import request options and review result', async () => {
    const review = { document, warnings: ['review'], replace: false };
    const task = vi.fn(async (_request: GeometryRequest): Promise<GeometryReply> => ({
      type: 'import-review', runId: 4, documentRevision: 2, review,
    }));
    const adapter = new WorkerCadGeometry(task);
    const files = [{ name: 'fixture.dxf', text: '0\\nEOF\\n' }];
    expect(await importCadFiles(adapter, files, 2, 4, {
      scale: 1, tolerance: .01, enclosed: 'holes',
    })).toEqual(review);
    expect(task).toHaveBeenCalledWith({
      type: 'import', runId: 4, documentRevision: 2, files,
      scale: 1, tolerance: .01, enclosed: 'holes',
    });
  });

  it('surfaces geometry errors without bypassing validation', async () => {
    const task = vi.fn(async (_request: GeometryRequest): Promise<GeometryReply> => ({
      type: 'error', runId: 1, documentRevision: 1, message: 'invalid geometry',
    }));
    await expect(new WorkerCadGeometry(task).prepareExport(document, 1, 1, result)).rejects.toThrow();
  });

  it('validates quantities and rotations as pure domain rules', () => {
    expect(validQuantity(0)).toBe(true);
    expect(validQuantity(501)).toBe(false);
    expect(validRotationRule({ kind: 'discrete', degrees: [0, 180] })).toBe(true);
    expect(validRotationRule({ kind: 'discrete', degrees: [] })).toBe(false);
    expect(normalizedRotationRule(undefined)).toEqual({ kind: 'discrete', degrees: [0, 180] });
  });
});
