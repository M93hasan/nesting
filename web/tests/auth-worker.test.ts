import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import worker from '../worker/serula-worker.js';
import {hashPassword,verifyPassword} from '../worker/passwords.js';

// Execute the real Worker queries against SQLite, with D1 batch rollback semantics.
function database(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
  let failChunks=false,chunkWrites=0;
  const DB={prepare(sql:string){
    let values:unknown[]=[];
    const statement={bind(...args:unknown[]){values=args;return statement},
      first:async()=>sqlite.prepare(sql).get(...values)??null,
      all:async()=>({results:sqlite.prepare(sql).all(...values)}),
      async run(){
        if(failChunks&&sql.startsWith('INSERT INTO export_file_chunks')&&++chunkWrites===2)throw Error('simulated chunk failure');
        const meta=sqlite.prepare(sql).run(...values);
        return {success:true,meta:{changes:Number(meta.changes),last_row_id:Number(meta.lastInsertRowid)}};
      }};return statement;
  },async batch(statements:any[]){
    sqlite.exec('BEGIN');
    try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}
    catch(error){sqlite.exec('ROLLBACK');throw error}
  }};
  return {DB,sqlite,fail(){failChunks=true}};
}
async function call(env:any,path:string,data?:unknown,cookie=''){
  return worker.fetch(new Request('https://serula.site'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',origin:'https://serula.site',cookie},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
}
async function account(env:any){
  const response=await call(env,'/api/auth/register',{email:'test@example.com',name:'Test',password:'a-good-password'});
  expect(response.status).toBe(201);
  return response.headers.get('set-cookie')!.split(';')[0];
}
const payload={projectName:'Project',fileName:'test.dxf',dxf:'0\nSECTION\n0\nEOF',projectJson:'{}'};

describe('Workers password compatibility',()=>{
  it('creates native-compatible hashes and rejects incorrect passwords',async()=>{
    const hash=await hashPassword('parola-123');
    expect(hash.startsWith('pbkdf2_sha256$100000$')).toBe(true);
    expect(await verifyPassword('parola-123',hash)).toBe(true);
    expect(await verifyPassword('wrong',hash)).toBe(false);
  });
  it('verifies existing 210k hashes against an independent PBKDF2 implementation',async()=>{
    const salt=Buffer.alloc(16,7),digest=pbkdf2Sync('old-password',salt,210000,32,'sha256');
    const hash=`pbkdf2_sha256$210000$${salt.toString('base64')}$${digest.toString('base64')}`;
    expect(await verifyPassword('old-password',hash)).toBe(true);
    expect(await verifyPassword('incorrect',hash)).toBe(false);
    expect(await verifyPassword('old-password',hash.replace('210000','999999999'))).toBe(false);
  });
});
describe('Worker accounts and credit transactions',()=>{
  it('boots a blank database and supports register, login, logout',async()=>{
    const env=database(),cookie=await account(env);
    expect((await call(env,'/api/auth/me',undefined,cookie)).status).toBe(200);
    expect((await call(env,'/api/auth/login',{email:'test@example.com',password:'wrong'})).status).toBe(401);
    expect((await call(env,'/api/auth/login',{email:'test@example.com',password:'a-good-password'})).status).toBe(200);
    await call(env,'/api/auth/logout',{},cookie);
    expect((await call(env,'/api/auth/me',undefined,cookie)).status).toBe(401);
    env.sqlite.close();
  });
  it('charges exactly once per persisted export and blocks a sixth export',async()=>{
    const env=database(),cookie=await account(env);
    for(let i=0;i<5;i++)expect((await call(env,'/api/export/authorize',payload,cookie)).status).toBe(200);
    expect((await call(env,'/api/export/authorize',payload,cookie)).status).toBe(402);
    expect(env.sqlite.prepare('SELECT nesting_credits FROM users').get()?.nesting_credits).toBe(0);
    expect(env.sqlite.prepare('SELECT count(*) n FROM export_files').get()?.n).toBe(5);
    expect(env.sqlite.prepare('SELECT sum(used_credit) n FROM nesting_history').get()?.n).toBe(5);
    env.sqlite.close();
  });
  it('rolls back credit, history, metadata and chunks when storage fails',async()=>{
    const env=database(),cookie=await account(env);env.fail();
    expect((await call(env,'/api/export/authorize',payload,cookie)).status).toBe(500);
    expect(env.sqlite.prepare('SELECT nesting_credits FROM users').get()?.nesting_credits).toBe(5);
    for(const table of ['nesting_history','export_files','export_file_chunks'])expect(env.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get()?.n).toBe(0);
    env.sqlite.close();
  });
  it('rejects invalid and oversized exports without charging credits',async()=>{
    const env=database(),cookie=await account(env);
    expect((await call(env,'/api/export/authorize',{...payload,dxf:''},cookie)).status).toBe(400);
    expect((await call(env,'/api/export/authorize',{...payload,dxf:'X'.repeat(10*1024*1024+1)},cookie)).status).toBe(413);
    expect(env.sqlite.prepare('SELECT nesting_credits FROM users').get()?.nesting_credits).toBe(5);
    expect(env.sqlite.prepare('SELECT count(*) n FROM export_files').get()?.n).toBe(0);
    expect(env.sqlite.prepare('SELECT count(*) n FROM nesting_history').get()?.n).toBe(0);
    env.sqlite.close();
  });
  it('recovers from failed chunk storage and charges once on successful retry',async()=>{
    const env=database(),cookie=await account(env);env.fail();
    const largeDxf='0\\nSECTION\\n'+('LINE\\n'.repeat(60000))+'0\\nEOF';
    expect((await call(env,'/api/export/authorize',{...payload,dxf:largeDxf},cookie)).status).toBe(500);
    expect(env.sqlite.prepare('SELECT nesting_credits FROM users').get()?.nesting_credits).toBe(5);
    const retry=await call(env,'/api/export/authorize',{...payload,dxf:largeDxf},cookie);
    expect(retry.status).toBe(200);
    const {exportId}=await retry.json();
    expect((await (await call(env,`/api/exports/${exportId}`,undefined,cookie)).text())).toBe(largeDxf);
    expect(env.sqlite.prepare('SELECT nesting_credits FROM users').get()?.nesting_credits).toBe(4);
    expect(env.sqlite.prepare('SELECT count(*) n FROM export_files').get()?.n).toBe(1);
    expect(env.sqlite.prepare('SELECT sum(used_credit) n FROM nesting_history').get()?.n).toBe(1);
    expect(env.sqlite.prepare('SELECT count(*) n FROM export_file_chunks').get()?.n).toBeGreaterThan(1);
    env.sqlite.close();
  });
  it('leaves unlimited users uncharged and protects exports/admin APIs',async()=>{
    const env=database(),cookie=await account(env);
    env.sqlite.exec('UPDATE users SET unlimited=1,nesting_credits=0');
    expect((await call(env,'/api/export/authorize',payload,cookie)).status).toBe(200);
    expect(env.sqlite.prepare('SELECT used_credit FROM nesting_history').get()?.used_credit).toBe(0);
    expect((await call(env,'/api/export/authorize',payload)).status).toBe(401);
    expect((await call(env,'/api/admin/users',undefined,cookie)).status).toBe(403);
    expect((await call(env,'/api/nesting/start',{},cookie)).status).toBe(410);
    env.sqlite.close();
  });
  it('blocks protected example DXF assets until user permission is granted',async()=>{
    let assetReads=0;
    const env={...database(),ASSETS:{fetch:async()=>{assetReads++;return new Response('DXF DATA',{status:200})}}};
    const file='/examples/test%20klasoru%20dxf/test.dxf';
    const get=(path:string,cookie='')=>worker.fetch(new Request('https://serula.site'+path,{headers:cookie?{cookie}:{}}),env);
    expect((await get(file)).status).toBe(403);
    expect(assetReads).toBe(0);
    const cookie=await account(env);
    expect((await get(file,cookie)).status).toBe(403);
    expect((await get('/examples/test%20klasoru%20dxf/not-allowed.dxf',cookie)).status).toBe(403);
    expect(assetReads).toBe(0);
    env.sqlite.exec('INSERT INTO user_features(user_id,test_dxf_enabled) SELECT id,1 FROM users');
    const allowed=await get(file,cookie);
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toBe('DXF DATA');
    expect(assetReads).toBe(1);
    env.sqlite.close();
  });
  it('applies the baseline migration twice without changing existing accounts',async()=>{
    const env=database();
    const migration=readFileSync(new URL('../migrations/0001_accounts_and_exports.sql',import.meta.url),'utf8');
    env.sqlite.exec(migration);
    const cookie=await account(env);env.sqlite.exec(migration);
    expect((await call(env,'/api/auth/me',undefined,cookie)).status).toBe(200);
    env.sqlite.close();
  });
  it('lets an authenticated admin list users and change credits',async()=>{
    const env={...database(),ADMIN_PASSWORD:'admin-test-password'};
    await account(env);
    const login=await call(env,'/api/auth/admin-login',{email:'m93hasan@icloud.com',password:env.ADMIN_PASSWORD});
    expect(login.status).toBe(200);
    const cookie=login.headers.get('set-cookie')!.split(';')[0];
    const users=await (await call(env,'/api/admin/users',undefined,cookie)).json();
    expect(users.users).toHaveLength(1);
    expect((await call(env,`/api/admin/users/${users.users[0].id}/credits`,{credits:12},cookie)).status).toBe(200);
    expect(env.sqlite.prepare('SELECT nesting_credits FROM users').get()?.nesting_credits).toBe(12);
    env.sqlite.close();
  });
});
