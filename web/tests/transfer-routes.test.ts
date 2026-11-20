import { expect, test, vi } from 'vitest';
import { handleTransferRoutes } from '../worker/transfer-routes.js';

const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const env = { DB: { prepare: vi.fn() } };
const deps=(user: {id:number} | null)=>({
  json,
  sessionUser:vi.fn(async ()=>user),
  licenseExpired:vi.fn(()=>false),
  corelAllowed:vi.fn(async ()=>true),
  body:vi.fn(async ()=>({ target: 'corel' })),
  randomToken:vi.fn(()=> 'b'.repeat(64)),
  sha256:vi.fn(async ()=> 'hash'),
  audit:vi.fn(async ()=>undefined),
  testDxfAllowed:vi.fn(async ()=>true),
  TEST_DXF_FILES:['test.dxf'],
});

test('local transfer access never grants anonymous Corel authorization',async()=>{
  const h=deps(null);
  const response=await handleTransferRoutes(new Request('https://serula.test/api/transfer/access'),env,'/api/transfer/access',h);
  expect(await response?.json()).toEqual({corel:false,rdworks:false});
  expect(h.corelAllowed).not.toHaveBeenCalled();
});

test('issued transfer tickets require authenticated users and valid licenses',async()=>{
  const h=deps(null);
  const response=await handleTransferRoutes(new Request('https://serula.test/api/transfer/ticket',{method:'POST'}),env,'/api/transfer/ticket',h);
  expect(response?.status).toBe(403);
  expect(h.randomToken).not.toHaveBeenCalled();
});

test('invalid transfer redeem tokens cannot reach D1',async()=>{
  const h=deps({id:7});
  h.body.mockResolvedValueOnce({ target:'corel',ticket:'short' });
  const response=await handleTransferRoutes(new Request('https://serula.test/api/transfer/redeem',{method:'POST'}),env,'/api/transfer/redeem',h);
  expect(response?.status).toBe(403);
  expect(env.DB.prepare).not.toHaveBeenCalled();
});

test('test DXF catalog requires login and uses per-user feature authorization',async()=>{
  const h=deps(null);
  const anonymous=await handleTransferRoutes(new Request('https://serula.test/api/test-dxf'),env,'/api/test-dxf',h);
  expect(anonymous?.status).toBe(401);
  h.sessionUser.mockResolvedValueOnce({id:7});
  const allowed=await handleTransferRoutes(new Request('https://serula.test/api/test-dxf'),env,'/api/test-dxf',h);
  expect(await allowed?.json()).toEqual({allowed:true,files:['test.dxf']});
  expect(h.testDxfAllowed).toHaveBeenCalledWith(7,env);
});

test('unrecognized route is left to remaining API handlers',async()=>{
  const result=await handleTransferRoutes(new Request('https://serula.test/api/other'),env,'/api/other',deps(null));
  expect(result).toBeUndefined();
});
