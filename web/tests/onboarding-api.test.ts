import {DatabaseSync} from 'node:sqlite';
import {afterEach,expect,test,vi} from 'vitest';
import worker from '../worker/serula-worker.js';

const databases:DatabaseSync[]=[];
afterEach(()=>{for(const db of databases)db.close();databases.length=0;vi.unstubAllGlobals();});

function environment(){
  const db=new DatabaseSync(':memory:');databases.push(db);
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,name TEXT,
    password_hash TEXT,google_id TEXT,role TEXT NOT NULL,nesting_credits INTEGER NOT NULL,unlimited INTEGER NOT NULL,last_login_at TEXT)`);
  const DB={prepare(sql:string){
    let values:any[]=[];
    return{
      bind(...args:any[]){values=args;return this;},
      async run(){const result=db.prepare(sql).run(...values);return{meta:{last_row_id:Number(result.lastInsertRowid),changes:Number(result.changes)}};},
      async first(){return db.prepare(sql).get(...values)??null;},
      async all(){return{results:db.prepare(sql).all(...values)};},
    };
  },async batch(statements:{run:()=>Promise<unknown>}[]){return Promise.all(statements.map(statement=>statement.run()));}};
  return{db,DB};
}
function call(env:ReturnType<typeof environment>,path:string,{cookie='',data,origin}:{cookie?:string;data?:unknown;origin?:string}={}){
  return worker.fetch(new Request('https://serula.test'+path,{method:data===undefined?'GET':'POST',headers:{cookie,...(origin?{origin}:{}),'content-type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
}
async function register(env:ReturnType<typeof environment>,email='new@example.test'){
  const response=await call(env,'/api/auth/register',{data:{name:'Örnek',email,password:'a-valid-password'}});
  expect(response.status).toBe(201);
  const data=await response.json();return{user:data.user,cookie:response.headers.get('set-cookie')!.split(';')[0]};
}

test('email registrations are pending; completion persists across login and cannot affect another account',async()=>{
  const env=environment(),a=await register(env),b=await register(env,'other@example.test');
  expect(await (await call(env,'/api/onboarding',a)).json()).toEqual({pending:true});
  expect((await call(env,'/api/onboarding',{...a,data:{status:'pending'}})).status).toBe(400);
  expect((await call(env,'/api/onboarding',{...a,data:null})).status).toBe(400);
  expect((await call(env,'/api/onboarding',{...a,data:{status:'completed',userId:b.user.id}})).status).toBe(200);
  expect(await (await call(env,'/api/onboarding',b)).json()).toEqual({pending:true});
  const login=await call(env,'/api/auth/login',{data:{email:'new@example.test',password:'a-valid-password'}});
  expect(login.status).toBe(200);
  expect(await (await call(env,'/api/onboarding',{cookie:login.headers.get('set-cookie')!.split(';')[0]})).json()).toEqual({pending:false});
});

test('existing accounts are not enrolled on login; dismissal requires the current authenticated session',async()=>{
  const env=environment(),a=await register(env);
  env.db.prepare('DELETE FROM user_onboarding WHERE user_id=?').run(a.user.id);
  const login=await call(env,'/api/auth/login',{data:{email:a.user.email,password:'a-valid-password'}});
  expect(login.status).toBe(200);
  expect(await (await call(env,'/api/onboarding',a)).json()).toEqual({pending:false});
  expect((await call(env,'/api/onboarding')).status).toBe(401);
  expect((await call(env,'/api/onboarding',{data:{status:'dismissed'}})).status).toBe(401);
  expect((await call(env,'/api/onboarding',{...a,data:{status:'dismissed'},origin:'https://other.test'})).status).toBe(403);
  expect((await call(env,'/api/onboarding',{...a,data:{status:'dismissed'}})).status).toBe(200);
  expect(await (await call(env,'/api/onboarding',a)).json()).toEqual({pending:false});
});

test('Google enrolls only a newly created account and preserves the dismissed state on later login',async()=>{
  const env=environment();
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({aud:'249559754500-36grgmm2jucf2159d41efqdcqut02lj6.apps.googleusercontent.com',iss:'https://accounts.google.com',email_verified:'true',email:'google@example.test',sub:'google-example',name:'Google Örnek'})));
  const google=()=>call(env,'/api/auth/google',{data:{credential:'mock-google-credential',locale:'tr'}});
  const response=await google();expect(response.status).toBe(200);
  const cookie=response.headers.get('set-cookie')!.split(';')[0];
  expect(await (await call(env,'/api/onboarding',{cookie})).json()).toEqual({pending:true});
  await call(env,'/api/onboarding',{cookie,data:{status:'dismissed'}});
  expect((await google()).status).toBe(200);
  expect(await (await call(env,'/api/onboarding',{cookie})).json()).toEqual({pending:false});
  env.db.exec('DELETE FROM user_onboarding');
  expect((await google()).status).toBe(200);
  expect(await (await call(env,'/api/onboarding',{cookie})).json()).toEqual({pending:false});
});
