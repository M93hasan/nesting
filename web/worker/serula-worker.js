import {parseDesignPayload} from './design-document.js';
import {putCloudProject,getCloudProject} from './cloud-project-routes.js';
import {handleTransferRoutes} from './transfer-routes.js';
import {handleAccountRoutes} from './account-routes.js';
import {handleExportRoutes} from './export-routes.js';
import {handleAdminOverviewRoutes} from './admin-overview-routes.js';
import {hashPassword,verifyPassword} from './passwords.js';
import {sendVerificationCode,confirmVerificationCode} from './email-otp.js';
import {hasEmailSender,sendAppEmail} from './email-sender.js';

import packageInfo from '../package.json';
const GOOGLE_CLIENT_ID='207092733568-2h2751l65c8cbnb3o6qfpvl4uug9f975.apps.googleusercontent.com';
const SESSION_DAYS=30;
const ADMIN_LOGIN_EMAIL='m93hasan@icloud.com';
const APP_VERSION=String(packageInfo.version);

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const b64=bytes=>btoa(String.fromCharCode(...bytes));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function sha256(text){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))))}
function cookieToken(request){
  const match=request.headers.get('cookie')?.match(/(?:^|;\s*)serula_session=([^;]+)/);
  return match?decodeURIComponent(match[1]):'';
}
function cookie(value,maxAge=SESSION_DAYS*86400){return `serula_session=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;}
function adminCookieToken(request){const match=request.headers.get('cookie')?.match(/(?:^|;\s*)serula_admin_session=([^;]+)/);return match?decodeURIComponent(match[1]):'';}
function adminCookie(value,maxAge=SESSION_DAYS*86400){return `serula_admin_session=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;}
async function secureEqual(a,b){const [x,y]=await Promise.all([sha256(String(a)),sha256(String(b))]);let d=x.length^y.length;const n=Math.max(x.length,y.length);for(let i=0;i<n;i++)d|=(x.charCodeAt(i%x.length)||0)^(y.charCodeAt(i%y.length)||0);return d===0;}
async function makeAdminSession(env){const raw=randomToken(),expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)').bind(await sha256(raw),expires).run();return raw;}
async function adminSessionValid(request,env){const raw=adminCookieToken(request);if(!raw)return false;return !!await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash=? AND datetime(expires_at)>datetime('now')").bind(await sha256(raw)).first();}
async function cleanupExpiredHistory(env){
  await env.DB.batch([
    env.DB.prepare("DELETE FROM export_file_chunks WHERE export_id IN (SELECT id FROM export_files WHERE datetime(created_at)<datetime('now','-32 days'))"),
    env.DB.prepare("DELETE FROM export_files WHERE datetime(created_at)<datetime('now','-32 days')"),
    env.DB.prepare("DELETE FROM nesting_history WHERE datetime(created_at)<datetime('now','-32 days')")
  ]);
}
async function ensureSchema(env){
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      google_id TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      nesting_credits INTEGER NOT NULL DEFAULT 5 CHECK(nesting_credits>=0),
      unlimited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS email_verifications (
      user_id INTEGER PRIMARY KEY,
      challenge_hash TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL,
      window_started_at TEXT NOT NULL,
      window_count INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS password_reset_tokens (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_settings (user_id INTEGER PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_features (user_id INTEGER PRIMARY KEY, test_dxf_enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_corel_transfer_access (user_id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS transfer_tickets (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, target TEXT NOT NULL CHECK(target='corel'), expires_at TEXT NOT NULL, redeemed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      locale TEXT NOT NULL DEFAULT 'tr' CHECK(locale IN ('tr','en','ar','fa')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_licenses (
      user_id INTEGER PRIMARY KEY,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_licenses_expires ON user_licenses(expires_at)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_type TEXT NOT NULL, actor_user_id INTEGER, target_user_id INTEGER, action TEXT NOT NULL, detail TEXT, success INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_user_id)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      approved_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_support_sessions_user ON support_sessions(user_id)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_signals (
      session_id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'settings',
      offer_json TEXT,
      answer_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_frames (
      session_id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      frame_data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender TEXT NOT NULL CHECK(sender IN ('user','admin')),
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id,id)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS nesting_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT,
      source_file_name TEXT,
      used_credit INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_nesting_history_user ON nesting_history(user_id,id)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS export_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      source_file_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      dxf_text TEXT NOT NULL,
      project_json TEXT,
      byte_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_export_files_user_created ON export_files(user_id,id DESC)'),
    env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS serula_export_charge_v1
      BEFORE INSERT ON export_files BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND (unlimited=1 OR nesting_credits>0))
          THEN RAISE(ABORT,'serula_no_credits') END;
        INSERT INTO nesting_history(user_id,project_name,source_file_name,used_credit)
          SELECT id,NEW.project_name,NEW.source_file_name,CASE WHEN unlimited=1 THEN 0 ELSE 1 END FROM users WHERE id=NEW.user_id;
        UPDATE users SET nesting_credits=nesting_credits-1 WHERE id=NEW.user_id AND unlimited=0;
      END`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS export_file_chunks (
      export_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('dxf','project')),
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY(export_id,kind,chunk_index),
      FOREIGN KEY (export_id) REFERENCES export_files(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_export_file_chunks_export ON export_file_chunks(export_id,kind,chunk_index)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cloud_projects (
      user_id INTEGER PRIMARY KEY,
      label TEXT NOT NULL DEFAULT 'Serula Nesting En Temiz Hali',
      project_name TEXT NOT NULL DEFAULT '',
      byte_size INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cloud_project_chunks (
      user_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY(user_id,chunk_index),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_cloud_project_chunks_user ON cloud_project_chunks(user_id,chunk_index)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY,
      last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_presence_seen ON user_presence(last_seen)'),
    env.DB.prepare("DELETE FROM support_frames WHERE datetime(updated_at)<datetime('now','-5 minutes')"),
    env.DB.prepare("DELETE FROM audit_logs WHERE datetime(created_at)<datetime('now','-10 days')"),
    env.DB.prepare("UPDATE support_sessions SET status='expired',ended_at=COALESCE(ended_at,CURRENT_TIMESTAMP) WHERE status IN ('pending','approved') AND datetime(expires_at)<=datetime('now')")
  ]);
}
async function sessionUser(request,env){
  const raw=cookieToken(request);if(!raw)return null;
  const row=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,
      l.started_at license_started_at,l.expires_at license_expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    LEFT JOIN user_licenses l ON l.user_id=u.id
    WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now')
      AND NOT EXISTS (SELECT 1 FROM email_verifications v WHERE v.user_id=u.id)`).bind(await sha256(raw)).first();
  return row||null;
}
async function makeSession(userId,env){
  const raw=randomToken(),expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)').bind(userId,await sha256(raw),expires).run();
  return raw;
}
function licenseExpired(u){
  const expires=String(u?.license_expires_at||'');
  return !!expires&&Number.isFinite(Date.parse(expires))&&Date.parse(expires)<=Date.now();
}
function publicUser(u){
  const licenseStartedAt=u?.license_started_at||null,licenseExpiresAt=u?.license_expires_at||null;
  return {id:u.id,email:u.email,name:u.name||'',role:u.role,credits:Number(u.nesting_credits||0),unlimited:!!u.unlimited,
    licenseStartedAt,licenseExpiresAt,licenseExpired:licenseExpired(u)};
}
async function touchPresence(env,userId){
  if(!userId)return;
  await env.DB.prepare(`INSERT INTO user_presence(user_id,last_seen) VALUES(?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET last_seen=CURRENT_TIMESTAMP`).bind(userId).run();
}
const onlineSql="datetime(p.last_seen)>=datetime('now','-15 seconds')";
function sameOrigin(request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
async function body(request){try{return await request.json()}catch{return {}}}
const EXPORT_CHUNK_BYTES=1450000;
function fileChunkBase64(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+32768)));
  return btoa(binary);
}
function fileChunkBytes(value){
  const binary=atob(String(value||'')),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function encodeExportChunks(text){
  const bytes=new TextEncoder().encode(String(text||'')),chunks=[];
  for(let i=0;i<bytes.length;i+=EXPORT_CHUNK_BYTES)chunks.push(fileChunkBase64(bytes.subarray(i,Math.min(bytes.length,i+EXPORT_CHUNK_BYTES))));
  return {byteSize:bytes.length,chunks};
}
function decodeExportChunks(rows){
  const parts=rows.map(row=>fileChunkBytes(row.data)),size=parts.reduce((n,part)=>n+part.length,0),bytes=new Uint8Array(size);
  let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  return new TextDecoder().decode(bytes);
}
async function readExportText(env,exportId,kind,legacy=''){
  if(legacy)return String(legacy);
  const rows=await env.DB.prepare('SELECT data FROM export_file_chunks WHERE export_id=? AND kind=? ORDER BY chunk_index').bind(exportId,kind).all();
  return rows.results.length?decodeExportChunks(rows.results):'';
}
async function readCloudProjectText(env,userId){
  const rows=await env.DB.prepare('SELECT data FROM cloud_project_chunks WHERE user_id=? ORDER BY chunk_index').bind(userId).all();
  return rows.results.length?decodeExportChunks(rows.results):'';
}
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const cleanLocale=value=>['tr','en','ar','fa'].includes(String(value||'').toLowerCase())?String(value).toLowerCase():'tr';
const passwordOk=p=>typeof p==='string'&&p.length>=8&&p.length<=200;
const TEST_DXF_FILES=['1003.dxf','1239.dxf','test.dxf'];
async function corelAllowed(userId,env){
  if(!userId)return false;
  const row=await env.DB.prepare('SELECT enabled FROM user_corel_transfer_access WHERE user_id=?').bind(userId).first();
  return row==null?true:Number(row.enabled)===1;
}
async function testDxfAllowed(userId,env){
  if(!userId)return false;
  const row=await env.DB.prepare('SELECT test_dxf_enabled FROM user_features WHERE user_id=?').bind(userId).first();
  return !!row?.test_dxf_enabled;
}

const DEFAULT_ADMIN_SETTINGS={materialWidthMm:1400,clearanceMm:0,marginMm:0,rotation:'half',materialType:'roll',solverPreset:'standard'};
function cleanSettings(value){
  const input=value&&typeof value==='object'?value:{};
  const num=(v,fallback,min,max)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
  return {
    materialWidthMm:num(input.materialWidthMm,DEFAULT_ADMIN_SETTINGS.materialWidthMm,1,100000),
    clearanceMm:num(input.clearanceMm,DEFAULT_ADMIN_SETTINGS.clearanceMm,0,1000),
    marginMm:num(input.marginMm,DEFAULT_ADMIN_SETTINGS.marginMm,0,1000),
    rotation:['fixed','half','free'].includes(input.rotation)?input.rotation:DEFAULT_ADMIN_SETTINGS.rotation,
    materialType:['roll','sheet'].includes(input.materialType)?input.materialType:DEFAULT_ADMIN_SETTINGS.materialType,
    solverPreset:['standard','fast'].includes(input.solverPreset)?input.solverPreset:DEFAULT_ADMIN_SETTINGS.solverPreset
  };
}
async function audit(env,action,{actorType='system',actorUserId=null,targetUserId=null,detail='',success=true}={}){
  try{await env.DB.prepare('INSERT INTO audit_logs(actor_type,actor_user_id,target_user_id,action,detail,success) VALUES(?,?,?,?,?,?)').bind(actorType,actorUserId,targetUserId,action,String(detail||'').slice(0,1000),success?1:0).run()}catch{}
}
async function systemDefaults(env){
  const row=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='defaults'").first();
  if(!row?.value_json)return DEFAULT_ADMIN_SETTINGS;
  try{
    const raw=JSON.parse(row.value_json);
    // One-time compatibility migration for the historical Serula defaults that
    // could overwrite the frontend's 1400 mm / 0 mm production defaults.
    if(Number(raw?.materialWidthMm)===1000&&Number(raw?.clearanceMm)===0.3&&Number(raw?.marginMm??5)===5){
      const migrated={...cleanSettings(raw),materialWidthMm:1400,clearanceMm:0,marginMm:0};
      await env.DB.prepare("UPDATE system_settings SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE key='defaults'").bind(JSON.stringify(migrated)).run();
      return migrated;
    }
    return cleanSettings(raw);
  }catch{return DEFAULT_ADMIN_SETTINGS}
}

async function googleUserFromCredential(credential,env,requestedLocale='tr'){
  const locale=cleanLocale(requestedLocale);
  const verify=credential&&await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential));
  if(!verify||!verify.ok)return {error:'Google doğrulaması başarısız.',status:401};
  const claims=await verify.json(),email=String(claims.email||'').toLowerCase();
  if(claims.aud!==GOOGLE_CLIENT_ID||!['accounts.google.com','https://accounts.google.com'].includes(String(claims.iss||''))||claims.email_verified!=='true'||!validEmail(email))return {error:'Google hesabı doğrulanamadı.',status:401};
  let user=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at
    FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.email=?`).bind(email).first();
  if(!user){
    const result=await env.DB.prepare(`INSERT INTO users(email,name,google_id,role,nesting_credits,unlimited,last_login_at)
      VALUES(?,?,?,'user',5,0,CURRENT_TIMESTAMP)`).bind(email,String(claims.name||'').slice(0,120),String(claims.sub||'')).run();
    const userId=Number(result.meta.last_row_id);
    await env.DB.prepare(`INSERT INTO user_preferences(user_id,locale,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO NOTHING`).bind(userId,locale).run();
    user=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at
      FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?`).bind(userId).first();
  }else{
    await env.DB.prepare('UPDATE users SET google_id=COALESCE(google_id,?),last_login_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(claims.sub||''),user.id).run();
    // Google's verified-email claim satisfies activation for the same address.
    await env.DB.prepare('DELETE FROM email_verifications WHERE user_id=?').bind(user.id).run();
  }
  await audit(env,'login',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:'Google ile giriş'});
  return {user};
}

async function handleApi(request,env){
  await ensureSchema(env);
  const url=new URL(request.url),path=url.pathname;


  if(path==='/api/auth/google-config'&&request.method==='GET')return json({clientId:GOOGLE_CLIENT_ID});
  if(request.method!=='GET'&&!sameOrigin(request))return json({error:'Geçersiz istek.'},403);

  // Read-only published design. This does not override existing appearance or nesting data.
  if(path==='/api/design/published'&&request.method==='GET'){
    const row=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='design_published_v1'").first();
    let published=null;
    try{if(row)published=parseDesignPayload(JSON.parse(row.value_json));}catch{}
    return json({published});
  }
  // Design drafts and immutable revisions are isolated from the live appearance setting.
  if(path.startsWith('/api/admin/design/')){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_revision_store (id INTEGER PRIMARY KEY AUTOINCREMENT, document_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    const setting=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='design_draft_v1'").first();
    const current=setting?JSON.parse(setting.value_json):null;
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_publication_log (id INTEGER PRIMARY KEY AUTOINCREMENT, document_json TEXT, action TEXT NOT NULL, source_revision INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    if(path==='/api/admin/design/publications'&&request.method==='GET'){
      const rows=await env.DB.prepare('SELECT id,action,source_revision,created_at FROM design_publication_log ORDER BY id DESC LIMIT 30').all();
      return json({publications:rows.results??[]});
    }
    if(path==='/api/admin/design/publish'&&request.method==='POST'){
      const data=await body(request);
      if(data?.confirmation!=='YAYINLA'||!Number.isSafeInteger(data?.versionId)||data.versionId<=0)return json({error:'Sürüm ve yayın onayı gerekli.'},400);
      const row=await env.DB.prepare('SELECT document_json FROM design_revision_store WHERE id=?').bind(data.versionId).first();
      if(!row)return json({error:'Sürüm bulunamadı.'},404);
      let document;try{document=parseDesignPayload(JSON.parse(row.document_json));}catch{return json({error:'Sürüm geçersiz.'},400);}
      const encoded=JSON.stringify(document);
      // Preserve the prior published state (including the default/no-design state) before switching.
      const previous=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='design_published_v1'").first();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO design_publication_log(document_json,action) VALUES(?,'before_publish')").bind(previous?.value_json??null),
        env.DB.prepare("INSERT INTO design_publication_log(document_json,action,source_revision) VALUES(?,'publish',?)").bind(encoded,data.versionId),
        env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_published_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(encoded)
      ]);
      await audit(env,'design_published',{actorType:'admin',detail:String(data.versionId)});
      return json({published:document});
    }
    if(path==='/api/admin/design/rollback'&&request.method==='POST'){
      const data=await body(request);
      if(data?.confirmation!=='GERI AL'||!Number.isSafeInteger(data?.publicationId)||data.publicationId<=0)return json({error:'Geri alma onayı gerekli.'},400);
      const row=await env.DB.prepare('SELECT document_json FROM design_publication_log WHERE id=?').bind(data.publicationId).first();
      if(!row)return json({error:'Yayın bulunamadı.'},404);
      let document=null;
      try{if(row.document_json)document=parseDesignPayload(JSON.parse(row.document_json));}catch{return json({error:'Kayıtlı yayın geçersiz.'},400);}
      await env.DB.batch([
        env.DB.prepare("INSERT INTO design_publication_log(document_json,action) VALUES(?,'rollback')").bind(document?JSON.stringify(document):null),
        document?env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_published_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(document)):env.DB.prepare("DELETE FROM system_settings WHERE key='design_published_v1'")
      ]);
      await audit(env,'design_rolled_back',{actorType:'admin',detail:String(data.publicationId)});
      return json({published:document});
    }
    if(path==='/api/admin/design/draft'&&request.method==='GET')return json({draft:current});
    if(path==='/api/admin/design/versions'&&request.method==='GET'){
      const rows=await env.DB.prepare('SELECT id,created_at FROM design_revision_store ORDER BY id DESC LIMIT 30').all();
      return json({versions:rows.results??[]});
    }
    const versionPath=path.startsWith('/api/admin/design/versions/')?path.slice('/api/admin/design/versions/'.length):'';
    const match=/^[0-9]+$/.test(versionPath)?[path,versionPath]:null;
    if(match&&request.method==='GET'){
      const row=await env.DB.prepare('SELECT document_json FROM design_revision_store WHERE id=?').bind(Number(match[1])).first();
      return row?json({document:JSON.parse(row.document_json)}):json({error:'Sürüm bulunamadı.'},404);
    }
    if(path==='/api/admin/design/draft'&&request.method==='POST'){
      const raw=await request.text();
      if(raw.length>70000)return json({error:'Tasarım fazla büyük.'},413);
      let document;try{document=parseDesignPayload(JSON.parse(raw));}catch(error){return json({error:error.message},400);}
      const encoded=JSON.stringify(document);
      await env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_draft_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(encoded).run();
      const revision=await env.DB.prepare('INSERT INTO design_revision_store(document_json) VALUES(?)').bind(encoded).run();
      const revisionId=revision?.meta?.last_row_id;
      await audit(env,'design_draft_saved',{actorType:'admin',detail:'Draft revision recorded'});
      return json({draft:document,revisionId:Number.isSafeInteger(revisionId)&&revisionId>0?revisionId:null});
    }
    if(path==='/api/admin/design/restore'&&request.method==='POST'){
      const data=await body(request),id=data?.versionId;
      if(!Number.isSafeInteger(id)||id<=0)return json({error:'Geçersiz sürüm.'},400);
      const row=await env.DB.prepare('SELECT document_json FROM design_revision_store WHERE id=?').bind(id).first();
      if(!row)return json({error:'Sürüm bulunamadı.'},404);
      let document;try{document=parseDesignPayload(JSON.parse(row.document_json));}catch{return json({error:'Sürüm geçersiz.'},400);}
      const encoded=JSON.stringify(document);
      await env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_draft_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(encoded).run();
      await env.DB.prepare('INSERT INTO design_revision_store(document_json) VALUES(?)').bind(encoded).run();
      await audit(env,'design_draft_restored',{actorType:'admin',detail:String(id)});
      return json({draft:document});
    }
    return json({error:'İşlem desteklenmiyor.'},405);
  }
  if(path==='/api/version'&&request.method==='GET')return json({version:APP_VERSION});
  const transferReply=await handleTransferRoutes(request,env,path,{
    json,sessionUser,licenseExpired,corelAllowed,body,randomToken,
    sha256,audit,testDxfAllowed,TEST_DXF_FILES,
  });
  if(transferReply)return transferReply;
  const accountReply=await handleAccountRoutes(request,env,path,{
  sessionUser,touchPresence,json,publicUser,body,cleanLocale,validEmail,passwordOk,
  hasEmailSender,hashPassword,sendVerificationCode,audit,verifyPassword,
  confirmVerificationCode,cookie,makeSession,adminSessionValid,ADMIN_LOGIN_EMAIL,
  secureEqual,adminCookie,makeAdminSession,googleUserFromCredential,sha256,cookieToken,
  });
  if(accountReply)return accountReply;
  if(path==='/api/chat'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Canlı destek için giriş yapmalısınız.'},401);
    await touchPresence(env,user.id);
    await env.DB.prepare("UPDATE chat_messages SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND sender='admin' AND read_at IS NULL").bind(user.id).run();
    const rows=await env.DB.prepare("SELECT id,sender,body,created_at,read_at FROM chat_messages WHERE user_id=? ORDER BY id ASC LIMIT 300").bind(user.id).all();
    return json({messages:rows.results.map(m=>({id:m.id,sender:m.sender,body:m.body,createdAt:m.created_at,readAt:m.read_at||null}))});
  }
  if(path==='/api/chat'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Canlı destek için giriş yapmalısınız.'},401);
    const data=await body(request),message=String(data.message||'').trim();
    if(!message)return json({error:'Mesaj boş olamaz.'},400);
    if(message.length>2000)return json({error:'Mesaj en fazla 2000 karakter olabilir.'},400);
    await touchPresence(env,user.id);
    const result=await env.DB.prepare("INSERT INTO chat_messages(user_id,sender,body) VALUES(?,'user',?)").bind(user.id,message).run();
    return json({ok:true,id:Number(result.meta.last_row_id)});
  }
  if(path==='/api/nesting/start'&&request.method==='POST'){
    // Nesting is a free local preview; only a persisted export consumes a credit.
    return json({error:'Bu uç nokta kaldırıldı. Haklar yalnızca DXF dışa aktarımında kullanılır.'},410);
  }
  if(path==='/api/project/autosave'&&request.method==='PUT')
    return putCloudProject(request,env,{sessionUser,body,json,encodeExportChunks,audit});
  if(path==='/api/project/autosave'&&request.method==='GET')
    return getCloudProject(request,env,url,{sessionUser,json,readCloudProjectText});
  const exportReply=await handleExportRoutes(request,env,path,url,{
    json,sessionUser,licenseExpired,body,encodeExportChunks,audit,publicUser,readExportText,
  });
  if(exportReply)return exportReply;
  const adminOverviewReply=await handleAdminOverviewRoutes(request,env,path,url,{
    adminSessionValid,json,body,onlineSql,publicUser,audit,
  });
  if(adminOverviewReply)return adminOverviewReply;
  if(path==='/api/support/status'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({support:null},401);
    await touchPresence(env,user.id);
    const row=await env.DB.prepare(`SELECT s.id,s.status,s.expires_at,s.created_at,s.approved_at,COALESCE(g.mode,'settings') mode,g.offer_json,g.answer_json
      FROM support_sessions s LEFT JOIN support_signals g ON g.session_id=s.id
      WHERE s.user_id=? AND s.status IN ('pending','approved') AND datetime(s.expires_at)>datetime('now') ORDER BY s.id DESC LIMIT 1`).bind(user.id).first();
    return json({support:row?{id:row.id,status:row.status,mode:row.mode,expiresAt:row.expires_at,createdAt:row.created_at,approvedAt:row.approved_at,offer:row.offer_json?JSON.parse(row.offer_json):null,answer:row.answer_json?JSON.parse(row.answer_json):null}:null});
  }
  if(path==='/api/support/respond'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const data=await body(request),id=Number(data.id),approve=!!data.approve;
    const row=await env.DB.prepare("SELECT s.id,COALESCE(g.mode,'settings') mode FROM support_sessions s LEFT JOIN support_signals g ON g.session_id=s.id WHERE s.id=? AND s.user_id=? AND s.status='pending' AND datetime(s.expires_at)>datetime('now')").bind(id,user.id).first();
    if(!row)return json({error:'Destek isteği bulunamadı veya süresi dolmuş.'},404);
    if(approve){
      const expires=new Date(Date.now()+60*60*1000).toISOString();
      await env.DB.prepare("UPDATE support_sessions SET status='approved',approved_at=CURRENT_TIMESTAMP,expires_at=? WHERE id=?").bind(expires,id).run();
      await audit(env,'remote_support_approved',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:'60 dakika'});
      return json({support:{id,status:'approved',mode:row.mode,expiresAt:expires}});
    }
    await env.DB.prepare("UPDATE support_sessions SET status='declined',ended_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    await env.DB.prepare('DELETE FROM support_frames WHERE session_id=?').bind(id).run();
    await audit(env,'remote_support_declined',{actorType:'user',actorUserId:user.id,targetUserId:user.id});
    return json({support:null});
  }
  if(path==='/api/support/signal'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const data=await body(request),id=Number(data.id),offer=data.offer;
    const row=await env.DB.prepare("SELECT s.id FROM support_sessions s JOIN support_signals g ON g.session_id=s.id WHERE s.id=? AND s.user_id=? AND s.status='approved' AND g.mode='screen' AND datetime(s.expires_at)>datetime('now')").bind(id,user.id).first();
    if(!row)return json({error:'Aktif ekran desteği bulunamadı.'},404);
    if(!offer||typeof offer!=='object')return json({error:'Geçersiz ekran paylaşım teklifi.'},400);
    await env.DB.prepare("UPDATE support_signals SET offer_json=?,answer_json=NULL,updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(JSON.stringify(offer).slice(0,200000),id).run();
    await audit(env,'screen_share_offer',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:String(id)});
    return json({ok:true});
  }
  if(path==='/api/support/frame'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const data=await body(request),id=Number(data.id),frame=String(data.frame||'');
    if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(frame)||frame.length>450000)return json({error:'Geçersiz ekran karesi.'},400);
    const row=await env.DB.prepare("SELECT s.id FROM support_sessions s JOIN support_signals g ON g.session_id=s.id WHERE s.id=? AND s.user_id=? AND s.status='approved' AND g.mode='screen' AND datetime(s.expires_at)>datetime('now')").bind(id,user.id).first();
    if(!row)return json({error:'Aktif ekran desteği bulunamadı.'},404);
    await env.DB.prepare(`INSERT INTO support_frames(session_id,user_id,frame_data,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET frame_data=excluded.frame_data,user_id=excluded.user_id,updated_at=CURRENT_TIMESTAMP`).bind(id,user.id,frame).run();
    return json({ok:true});
  }
  if(path==='/api/support/end'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const data=await body(request),id=Number(data.id);
    await env.DB.prepare("UPDATE support_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='approved'").bind(id,user.id).run();
    await env.DB.prepare('DELETE FROM support_frames WHERE session_id=? AND user_id=?').bind(id,user.id).run();
    await audit(env,'remote_support_ended_by_user',{actorType:'user',actorUserId:user.id,targetUserId:user.id});
    return json({ok:true});
  }
  const adminSupportMatch=path.match(/^\/api\/admin\/users\/(\d+)\/support$/);
  if(adminSupportMatch&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminSupportMatch[1]),target=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    const row=await env.DB.prepare(`SELECT s.id,s.status,s.expires_at,s.created_at,s.approved_at,s.ended_at,COALESCE(g.mode,'settings') mode,g.offer_json,g.answer_json
      FROM support_sessions s LEFT JOIN support_signals g ON g.session_id=s.id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1`).bind(id).first();
    return json({support:row?{id:row.id,status:row.status,mode:row.mode,expiresAt:row.expires_at,createdAt:row.created_at,approvedAt:row.approved_at,endedAt:row.ended_at,offer:row.offer_json?JSON.parse(row.offer_json):null,answer:row.answer_json?JSON.parse(row.answer_json):null}:null});
  }
  if(adminSupportMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminSupportMatch[1]),data=await body(request),mode=data.mode==='screen'?'screen':'settings',target=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare("DELETE FROM support_frames WHERE user_id=?").bind(id).run();
    await env.DB.prepare("UPDATE support_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE user_id=? AND status IN ('pending','approved')").bind(id).run();
    const expires=new Date(Date.now()+15*60*1000).toISOString();
    const result=await env.DB.prepare("INSERT INTO support_sessions(user_id,status,expires_at) VALUES(?,'pending',?)").bind(id,expires).run();
    const supportId=Number(result.meta.last_row_id);
    await env.DB.prepare("INSERT INTO support_signals(session_id,mode) VALUES(?,?)").bind(supportId,mode).run();
    await audit(env,mode==='screen'?'screen_support_requested':'remote_support_requested',{actorType:'admin',targetUserId:id,detail:target.email});
    return json({support:{id:supportId,status:'pending',mode,expiresAt:expires}});
  }
  const adminSupportFrameMatch=path.match(/^\/api\/admin\/users\/(\d+)\/support\/frame$/);
  if(adminSupportFrameMatch&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminSupportFrameMatch[1]),sessionId=Number(url.searchParams.get('id')||0);
    const active=await env.DB.prepare("SELECT s.id FROM support_sessions s JOIN support_signals g ON g.session_id=s.id WHERE s.id=? AND s.user_id=? AND s.status='approved' AND g.mode='screen' AND datetime(s.expires_at)>datetime('now')").bind(sessionId,id).first();
    if(!active)return json({frame:null});
    const row=await env.DB.prepare("SELECT frame_data,updated_at FROM support_frames WHERE session_id=? AND user_id=? AND datetime(updated_at)>datetime('now','-15 seconds')").bind(sessionId,id).first();
    return json({frame:row?.frame_data||null,updatedAt:row?.updated_at||null});
  }
  const adminSupportSignalMatch=path.match(/^\/api\/admin\/users\/(\d+)\/support\/signal$/);
  if(adminSupportSignalMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminSupportSignalMatch[1]),data=await body(request),sessionId=Number(data.id),answer=data.answer;
    const row=await env.DB.prepare("SELECT s.id FROM support_sessions s JOIN support_signals g ON g.session_id=s.id WHERE s.id=? AND s.user_id=? AND s.status='approved' AND g.mode='screen' AND datetime(s.expires_at)>datetime('now')").bind(sessionId,id).first();
    if(!row)return json({error:'Aktif ekran desteği bulunamadı.'},404);
    if(!answer||typeof answer!=='object')return json({error:'Geçersiz ekran paylaşım yanıtı.'},400);
    await env.DB.prepare("UPDATE support_signals SET answer_json=?,updated_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(JSON.stringify(answer).slice(0,200000),sessionId).run();
    await audit(env,'screen_share_answer',{actorType:'admin',targetUserId:id,detail:String(sessionId)});
    return json({ok:true});
  }
  if(adminSupportMatch&&request.method==='DELETE'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminSupportMatch[1]);
    await env.DB.prepare("UPDATE support_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE user_id=? AND status IN ('pending','approved')").bind(id).run();
    await env.DB.prepare('DELETE FROM support_frames WHERE user_id=?').bind(id).run();
    await audit(env,'remote_support_ended_by_admin',{actorType:'admin',targetUserId:id});
    return json({ok:true});
  }
  if(path==='/api/admin/settings'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    return json({settings:await systemDefaults(env)});
  }
  if(path==='/api/admin/settings'&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const data=await body(request),settings=cleanSettings(data.settings);
    await env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('defaults',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(settings)).run();
    await audit(env,'system_defaults_changed',{actorType:'admin',detail:JSON.stringify(settings)});
    return json({settings});
  }
  if(path==='/api/settings/effective'&&request.method==='GET'){
    const user=await sessionUser(request,env),defaults=await systemDefaults(env);if(!user)return json({settings:defaults});
    const row=await env.DB.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').bind(user.id).first();
    if(!row?.settings_json)return json({settings:defaults});
    try{return json({settings:{...defaults,...cleanSettings(JSON.parse(row.settings_json))}})}catch{return json({settings:defaults})}
  }
  const corelToggleMatch=path.match(/^\/api\/admin\/users\/(\d+)\/transfer$/);
  if(corelToggleMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(corelToggleMatch[1]),data=await body(request);
    if(data.target!=='corel'||typeof data.enabled!=='boolean')return json({error:'Geçersiz aktarım yetkisi.'},400);
    const user=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();
    if(!user)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare('INSERT INTO user_corel_transfer_access (user_id,enabled,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP').bind(id,data.enabled?1:0).run();
    await audit(env,'corel_transfer_permission_changed',{actorType:'admin',targetUserId:id,detail:data.enabled?'enabled':'disabled'});
    return json({ok:true,corel:data.enabled});
  }
  const userSettingsMatch=path.match(/^\/api\/admin\/users\/(\d+)\/settings$/);
  if(userSettingsMatch&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(userSettingsMatch[1]),target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    const defaults=await systemDefaults(env),row=await env.DB.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').bind(id).first();
    if(!row?.settings_json)return json({settings:defaults,custom:false});
    try{return json({settings:{...defaults,...cleanSettings(JSON.parse(row.settings_json))},custom:true})}catch{return json({settings:defaults,custom:false})}
  }
  if(userSettingsMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(userSettingsMatch[1]),data=await body(request),settings=cleanSettings(data.settings),target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare('INSERT INTO user_settings(user_id,settings_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=CURRENT_TIMESTAMP').bind(id,JSON.stringify(settings)).run();
    await audit(env,'user_settings_changed',{actorType:'admin',targetUserId:id,detail:JSON.stringify(settings)});return json({settings,custom:true});
  }
  if(userSettingsMatch&&request.method==='DELETE'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(userSettingsMatch[1]);
    const target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare('DELETE FROM user_settings WHERE user_id=?').bind(id).run();
    await audit(env,'user_settings_reset',{actorType:'admin',targetUserId:id});
    return json({settings:await systemDefaults(env),custom:false});
  }
  const licenseMatch=path.match(/^\/api\/admin\/users\/(\d+)\/license$/);
  if(licenseMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(licenseMatch[1]),data=await body(request),target=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    if(data.days===null||data.days===''){
      await env.DB.prepare('DELETE FROM user_licenses WHERE user_id=?').bind(id).run();
      await audit(env,'license_changed',{actorType:'admin',targetUserId:id,detail:'Süresiz'});
      return json({ok:true,licenseStartedAt:null,licenseExpiresAt:null,licenseExpired:false});
    }
    const days=Math.trunc(Number(data.days));
    if(!Number.isFinite(days)||days<1||days>36500)return json({error:'Lisans süresi 1 ile 36500 gün arasında olmalıdır.'},400);
    const startedAt=new Date(),expiresAt=new Date(startedAt.getTime()+days*86400000);
    await env.DB.prepare(`INSERT INTO user_licenses(user_id,started_at,expires_at,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET started_at=excluded.started_at,expires_at=excluded.expires_at,updated_at=CURRENT_TIMESTAMP`)
      .bind(id,startedAt.toISOString(),expiresAt.toISOString()).run();
    await audit(env,'license_changed',{actorType:'admin',targetUserId:id,detail:`${days} gün · ${expiresAt.toISOString()}`});
    return json({ok:true,licenseStartedAt:startedAt.toISOString(),licenseExpiresAt:expiresAt.toISOString(),licenseExpired:false});
  }
  const testDxfMatch=path.match(/^\/api\/admin\/users\/(\d+)\/test-dxf$/);
  if(testDxfMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(testDxfMatch[1]),data=await body(request);
    if(typeof data.enabled!=='boolean')return json({error:'Geçersiz Test DXF yetki değeri.'},400);
    const enabled=data.enabled;
    const target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare(`INSERT INTO user_features(user_id,test_dxf_enabled,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET test_dxf_enabled=excluded.test_dxf_enabled,updated_at=CURRENT_TIMESTAMP`).bind(id,enabled?1:0).run();
    await audit(env,'test_dxf_changed',{actorType:'admin',targetUserId:id,detail:enabled?'Açık':'Kapalı'});
    return json({ok:true,enabled});
  }
    const unlimitedMatch=path.match(/^\/api\/admin\/users\/(\d+)\/unlimited$/);
  if(unlimitedMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(unlimitedMatch[1]),data=await body(request);
    if(typeof data.unlimited!=='boolean')return json({error:'Geçersiz sınırsız kullanım değeri.'},400);
    const unlimited=data.unlimited,target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare('UPDATE users SET unlimited=? WHERE id=?').bind(unlimited?1:0,id).run();await audit(env,'unlimited_changed',{actorType:'admin',targetUserId:id,detail:unlimited?'Açık':'Kapalı'});return json({ok:true,unlimited});
  }
  const resetMatch=path.match(/^\/api\/admin\/users\/(\d+)\/password-reset$/);
  if(resetMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(resetMatch[1]),target=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    if(!hasEmailSender(env))return json({error:'E-posta gönderim servisi yapılandırılmamış.'},503);
    const raw=randomToken(),expires=new Date(Date.now()+3600000).toISOString();
    await env.DB.prepare('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(raw),id,expires).run();
    const resetUrl=new URL(request.url).origin+'/?reset='+encodeURIComponent(raw);
    try{await sendAppEmail(env,{to:target.email,from:'noreply@serula.site',subject:'Serula Nesting - Şifre Sıfırlama',text:'Şifrenizi yenilemek için bu bağlantıyı 1 saat içinde açın: '+resetUrl});}
    catch{return json({error:'Şifre sıfırlama e-postası gönderilemedi. Daha sonra yeniden deneyin.'},503);}
    await audit(env,'password_reset_sent',{actorType:'admin',targetUserId:id,detail:target.email});
    return json({ok:true});
  }
  const m=path.match(/^\/api\/admin\/users\/(\d+)\/credits$/);
  if(m&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const data=await body(request),id=Number(m[1]),credits=data.credits;
    if(typeof credits!=='number'||!Number.isSafeInteger(credits)||credits<0||credits>100000)
      return json({error:'Hak sayısı 0 ile 100000 arasında tam sayı olmalıdır.'},400);
    const target=await env.DB.prepare('SELECT id,role FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare('UPDATE users SET nesting_credits=? WHERE id=?').bind(credits,id).run();
    await audit(env,'credits_changed',{actorType:'admin',targetUserId:id,detail:String(credits)});
    return json({ok:true});
  }
  return json({error:'Bulunamadı.'},404);
}

export default {
async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return handleApi(request,env);
  let decodedPath=url.pathname;try{decodedPath=decodeURIComponent(url.pathname)}catch{}
  if(decodedPath.startsWith('/examples/test klasoru dxf/')){
    await ensureSchema(env);
    const user=await sessionUser(request,env);
    const file=decodedPath.split('/').pop()||'';
    if(!user||!TEST_DXF_FILES.includes(file)||!await testDxfAllowed(user.id,env)){
      return new Response('Test DXF yetkisi kapalı.',{status:403,headers:{'cache-control':'no-store'}});
    }
  }
  const response=await env.ASSETS.fetch(request);
  const contentType=response.headers.get('content-type')||'';
  if(request.mode==='navigate'||contentType.includes('text/html')){
    const headers=new Headers(response.headers);
    headers.set('Cache-Control','no-store, no-cache, must-revalidate');
    headers.set('Pragma','no-cache');
    headers.set('Expires','0');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return response;
},
async scheduled(_event,env,ctx){
  ctx.waitUntil(cleanupExpiredHistory(env));
}
};
