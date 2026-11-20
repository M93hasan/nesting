import { expect, test, vi } from 'vitest';
import { handleAccountRoutes } from '../worker/account-routes.js';

const json=(value:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(value),{status,headers});
const noop=vi.fn(async()=>undefined);
const h=()=>({
  json,sessionUser:vi.fn(async()=>null),touchPresence:noop,publicUser:(u:unknown)=>u,
  body:vi.fn(async()=>({})),cleanLocale:(l:string)=>l,validEmail:vi.fn(()=>false),passwordOk:vi.fn(()=>false),
  hasEmailSender:vi.fn(()=>false),hashPassword:noop,sendVerificationCode:noop,audit:noop,
  verifyPassword:vi.fn(async()=>false),confirmVerificationCode:noop,
  cookie:vi.fn(()=> 'cookie'),makeSession:noop,adminSessionValid:vi.fn(async()=>false),
  ADMIN_LOGIN_EMAIL:'test@example.com',secureEqual:vi.fn(async()=>false),
  adminCookie:vi.fn(()=> 'admin-cookie'),makeAdminSession:noop,
  googleUserFromCredential:noop,sha256:noop,cookieToken:vi.fn(()=>''),
});
const env={DB:{prepare:vi.fn()}};
const req=(path:string,method='GET')=>new Request('https://serula.test'+path,{method});

test('anonymous user and preference endpoints remain protected',async()=>{
  const helpers=h();
  const me=await handleAccountRoutes(req('/api/auth/me'),env,'/api/auth/me',helpers);
  expect(me?.status).toBe(401);
  const prefs=await handleAccountRoutes(req('/api/preferences'),env,'/api/preferences',helpers);
  expect(prefs?.status).toBe(401);
  expect(env.DB.prepare).not.toHaveBeenCalled();
});

test('admin-me requires a valid dedicated admin session',async()=>{
  const helpers=h();
  const res=await handleAccountRoutes(req('/api/auth/admin-me'),env,'/api/auth/admin-me',helpers);
  expect(res?.status).toBe(401);
  helpers.adminSessionValid.mockResolvedValueOnce(true);
  const permitted=await handleAccountRoutes(req('/api/auth/admin-me'),env,'/api/auth/admin-me',helpers);
  expect((await permitted?.json())?.user?.role).toBe('admin');
});

test('register rejects invalid credentials before touching the database',async()=>{
  const helpers=h();
  const res=await handleAccountRoutes(req('/api/auth/register','POST'),env,'/api/auth/register',helpers);
  expect(res?.status).toBe(400);
  expect(env.DB.prepare).not.toHaveBeenCalled();
});

test('logout deletes no sessions when there is no auth cookie',async()=>{
  const helpers=h();
  const res=await handleAccountRoutes(req('/api/auth/logout','POST'),env,'/api/auth/logout',helpers);
  expect(res?.status).toBe(200);
  expect(env.DB.prepare).not.toHaveBeenCalled();
  expect(res?.headers.get('set-cookie')).toBe('cookie');
});

test('other routes are delegated to their own handlers',async()=>{
  expect(await handleAccountRoutes(req('/api/exports'),env,'/api/exports',h())).toBeUndefined();
});
