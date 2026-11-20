import { describe, expect, it, vi } from 'vitest';
import { putCloudProject, getCloudProject } from '../worker/cloud-project-routes.js';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const request = (method: string, query = '') => new Request('https://serula.test/api/project/autosave' + query, { method });

function helpers(user: { id: number } | null = { id: 7 }) {
  const prepare = vi.fn((_sql: string) => ({
    bind: vi.fn(function (this: unknown) { return this; }),
    first: vi.fn(async () => ({ label: 'Serula Nesting En Temiz Hali', project_name: 'Nesting', byte_size: 10, updated_at: '2026-11-20' })),
  }));
  const batch = vi.fn(async (_statements: unknown[]) => undefined);
  const env = { DB: { prepare, batch } };
  const injected = {
    json,
    sessionUser: vi.fn(async () => user),
    body: vi.fn(async () => ({ projectName: 'Nesting', projectJson: '{"schemaVersion":1}' })),
    encodeExportChunks: vi.fn((_source: string) => ({ byteSize: 20, chunks: ['encoded'] })),
    audit: vi.fn(async () => undefined),
    readCloudProjectText: vi.fn(async () => '{"schemaVersion":1}'),
  };
  return { env, injected, prepare, batch };
}

describe('Cloudflare cloud project route extraction', () => {
  it('rejects unsigned autosave without performing any database statements', async () => {
    const { env, injected, prepare } = helpers(null);
    const response = await putCloudProject(request('PUT'), env, injected);
    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('rejects blank or oversized cloud projects before persistence', async () => {
    const { env, injected, batch } = helpers();
    injected.body.mockResolvedValueOnce({ projectName: 'Empty', projectJson: ' ' });
    expect((await putCloudProject(request('PUT'), env, injected)).status).toBe(400);
    injected.encodeExportChunks.mockReturnValueOnce({ byteSize: 13 * 1024 * 1024, chunks: ['large'] });
    expect((await putCloudProject(request('PUT'), env, injected)).status).toBe(413);
    expect(batch).not.toHaveBeenCalled();
  });

  it('uses one D1 batch for project replacement and chunks', async () => {
    const { env, injected, batch } = helpers();
    const response = await putCloudProject(request('PUT'), env, injected);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, label: 'Serula Nesting En Temiz Hali' });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(3);
  });

  it('preserves access control and content retrieval on GET', async () => {
    const { env, injected } = helpers(null);
    expect((await getCloudProject(request('GET'), env, new URL('https://serula.test/api/project/autosave'), injected)).status).toBe(401);
    injected.sessionUser.mockResolvedValueOnce({ id: 7 });
    const url = new URL('https://serula.test/api/project/autosave?content=1');
    const response = await getCloudProject(request('GET', '?content=1'), env, url, injected);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"schemaVersion":1}');
  });
});
