import { describe, expect, it, vi } from 'vitest';
import { handleExportRoutes } from '../worker/export-routes.js';
import { handleAdminOverviewRoutes } from '../worker/admin-overview-routes.js';
import { handleAdminSettingsRoutes } from '../worker/admin-settings-routes.js';
import { handleSupportRoutes } from '../worker/support-routes.js';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: {'content-type':'application/json'} });
const request = (path: string, method='GET') => new Request('https://serula.test'+path, { method });

function deps() {
  const prepare=vi.fn((_query:string)=>({
    bind:vi.fn(function(this:unknown){return this;}),
    first:vi.fn(async()=>({id:7,email:'test@example.com'})),
    all:vi.fn(async()=>({results:[]})),
    run:vi.fn(async()=>({meta:{changes:1}})),
  }));
  const batch=vi.fn(async (_statements:unknown[])=>undefined);
  const env={DB:{prepare,batch}};
  const helpers={
    json,
    sessionUser:vi.fn(async()=>null as {id:number}|null),
    adminSessionValid:vi.fn(async()=>false),
    licenseExpired:vi.fn(()=>false),
    body:vi.fn(async()=>({} as Record<string,unknown>)),
    encodeExportChunks:vi.fn(()=>({byteSize:10,chunks:['text']})),
    audit:vi.fn(async()=>undefined),
    publicUser:(value:unknown)=>value,
    readExportText:vi.fn(async()=> 'content'),
    touchPresence:vi.fn(async()=>undefined),
    onlineSql:"datetime(p.last_seen)>=datetime('now','-15 seconds')",
    systemDefaults:vi.fn(async()=>({materialWidthMm:1000})),
    cleanSettings:vi.fn((value:unknown)=>value),
    hasEmailSender:vi.fn(()=>false),
    randomToken:vi.fn(()=> 'a'.repeat(64)),
    sha256:vi.fn(async()=> 'hash'),
    sendAppEmail:vi.fn(async()=>undefined),
  };
  return {env,helpers,prepare,batch};
}

describe('isolated Cloudflare export and admin boundaries',()=>{
  it('never reaches credit-writing D1 statements for an anonymous export',async()=>{
    const {env,helpers,prepare,batch}=deps();
    const response=await handleExportRoutes(request('/api/export/authorize','POST'),env,
      '/api/export/authorize',new URL('https://serula.test/api/export/authorize'),helpers);
    expect(response?.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it('refuses expired licenses before parsing or charging an export',async()=>{
    const {env,helpers,prepare,batch}=deps();
    helpers.sessionUser.mockResolvedValueOnce({id:7});
    helpers.licenseExpired.mockReturnValueOnce(true);
    const response=await handleExportRoutes(request('/api/export/authorize','POST'),env,
      '/api/export/authorize',new URL('https://serula.test/api/export/authorize'),helpers);
    expect(response?.status).toBe(403);
    expect(helpers.body).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it('refuses empty and oversized DXF before database credit trigger',async()=>{
    const {env,helpers,batch}=deps();
    helpers.sessionUser.mockResolvedValue({id:7});
    expect((await handleExportRoutes(request('/api/export/authorize','POST'),env,
      '/api/export/authorize',new URL('https://serula.test/api/export/authorize'),helpers))?.status).toBe(400);
    helpers.body.mockResolvedValueOnce({dxf:'0\\nEOF\\n', projectJson:'{}'});
    helpers.encodeExportChunks.mockReturnValueOnce({byteSize:11*1024*1024,chunks:['oversized']});
    expect((await handleExportRoutes(request('/api/export/authorize','POST'),env,
      '/api/export/authorize',new URL('https://serula.test/api/export/authorize'),helpers))?.status).toBe(413);
    expect(batch).not.toHaveBeenCalled();
  });

  it('keeps export charge and history in one D1 batch',async()=>{
    const {env,helpers,batch}=deps();
    helpers.sessionUser.mockResolvedValue({id:7});
    helpers.body.mockResolvedValueOnce({dxf:'DXF',projectJson:'{}',fileName:'p.dxf'});
    const response=await handleExportRoutes(request('/api/export/authorize','POST'),env,
      '/api/export/authorize',new URL('https://serula.test/api/export/authorize'),helpers);
    expect(response?.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(3);
    expect(helpers.audit).toHaveBeenCalledWith(env,'export_saved',expect.any(Object));
  });

  it('requires admin sessions for user overview and deletion',async()=>{
    const {env,helpers,prepare,batch}=deps();
    expect((await handleAdminOverviewRoutes(request('/api/admin/users'),env,'/api/admin/users',
      new URL('https://serula.test/api/admin/users'),helpers))?.status).toBe(403);
    expect((await handleAdminOverviewRoutes(request('/api/admin/users/7','DELETE'),env,'/api/admin/users/7',
      new URL('https://serula.test/api/admin/users/7'),helpers))?.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it('requires admin sessions and validates credit count before mutation',async()=>{
    const {env,helpers,prepare}=deps();
    const path='/api/admin/users/7/credits',url=new URL('https://serula.test'+path);
    expect((await handleAdminSettingsRoutes(request(path,'POST'),env,path,url,helpers))?.status).toBe(403);
    helpers.adminSessionValid.mockResolvedValueOnce(true);
    helpers.body.mockResolvedValueOnce({credits:-2});
    expect((await handleAdminSettingsRoutes(request(path,'POST'),env,path,url,helpers))?.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('does not disclose support status or alter data for anonymous users',async()=>{
    const {env,helpers,prepare}=deps();
    const path='/api/support/status';
    const response=await handleSupportRoutes(request(path),env,path,new URL('https://serula.test'+path),helpers);
    expect(response?.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('delegates unknown paths to the next handler without mutation',async()=>{
    const {env,helpers,batch,prepare}=deps();
    const path='/api/version',url=new URL('https://serula.test'+path);
    expect(await handleExportRoutes(request(path),env,path,url,helpers)).toBeUndefined();
    expect(await handleAdminOverviewRoutes(request(path),env,path,url,helpers)).toBeUndefined();
    expect(await handleSupportRoutes(request(path),env,path,url,helpers)).toBeUndefined();
    expect(await handleAdminSettingsRoutes(request(path),env,path,url,helpers)).toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});
