import { expect, test, vi } from 'vitest';
import { handleDesignRoutes } from '../worker/design-routes.js';
import { handleUserChatRoutes } from '../worker/user-chat-routes.js';

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const url=(path:string,method='GET')=>new Request('https://serula.test'+path,{method});

test('design publication and rollback require admin session before D1 mutations',async()=>{
  const prepare=vi.fn();
  const env={DB:{prepare}};
  const helpers={json,parseDesignPayload:vi.fn((x:unknown)=>x),adminSessionValid:vi.fn(async()=>false),
    body:vi.fn(async()=>({confirmation:'YAYINLA',versionId:1})),audit:vi.fn()};
  for(const [path,method] of [
    ['/api/admin/design/publish','POST'], ['/api/admin/design/rollback','POST'], ['/api/admin/design/restore','POST'],
    ['/api/admin/design/draft','POST'], ['/api/admin/design/versions','GET'],
  ]) {
    const response=await handleDesignRoutes(url(path,method),env,path,helpers);
    expect(response?.status).toBe(403);
  }
  expect(prepare).not.toHaveBeenCalled();
});

test('anonymous chat requests never read or write message tables',async()=>{
  const prepare=vi.fn(),touchPresence=vi.fn();
  const env={DB:{prepare}};
  const helpers={json,sessionUser:vi.fn(async()=>null),touchPresence,
    body:vi.fn(async()=>({message:'should not be stored'}))};
  for(const method of ['GET','POST']){
    const response=await handleUserChatRoutes(url('/api/chat',method),env,'/api/chat',helpers);
    expect(response?.status).toBe(401);
  }
  expect(prepare).not.toHaveBeenCalled();
  expect(touchPresence).not.toHaveBeenCalled();
});

test('retired nesting HTTP endpoint still cannot charge a credit',async()=>{
  const prepare=vi.fn();
  const env={DB:{prepare}};
  const response=await handleUserChatRoutes(url('/api/nesting/start','POST'),env,
    '/api/nesting/start',{json,sessionUser:vi.fn(),touchPresence:vi.fn(),body:vi.fn()});
  expect(response?.status).toBe(410);
  expect(prepare).not.toHaveBeenCalled();
});
