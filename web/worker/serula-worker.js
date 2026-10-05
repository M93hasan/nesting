import packageInfo from '../package.json';
const GOOGLE_CLIENT_ID='249559754500-36grgmm2jucf2159d41efqdcqut02lj6.apps.googleusercontent.com';
const SESSION_DAYS=30;
const ADMIN_LOGIN_EMAIL='m93hasan@icloud.com';
const APP_VERSION=String(packageInfo.version);

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const b64=bytes=>btoa(String.fromCharCode(...bytes));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function sha256(text){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))))}
async function hashPassword(password,salt=crypto.getRandomValues(new Uint8Array(16)),iterations=210000){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return `pbkdf2_sha256$${iterations}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}
async function verifyPassword(password,stored){
  try{
    const parts=String(stored||'').trim().split(String.fromCharCode(36));
    const kind=parts[0],it=parts[1],saltB64=parts[2],digestB64=parts[3];
    const iterations=Number(it);
    if(kind!=='pbkdf2_sha256'||!Number.isInteger(iterations)||iterations<1||!saltB64||!digestB64)return false;
    const salt=unb64(saltB64),expected=unb64(digestB64);
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password)),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,expected.length*8);
    const actual=new Uint8Array(bits);
    if(actual.length!==expected.length)return false;
    let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];
    return diff===0;
  }catch{return false}
}
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
    WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now')`).bind(await sha256(raw)).first();
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
  }
  await audit(env,'login',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:'Google ile giriş'});
  return {user};
}

async function handleApi(request,env){
  await ensureSchema(env);
  const url=new URL(request.url),path=url.pathname;


  if(path==='/api/auth/google-config'&&request.method==='GET')return json({clientId:GOOGLE_CLIENT_ID});
  if(request.method!=='GET'&&!sameOrigin(request))return json({error:'Geçersiz istek.'},403);

  if(path==='/api/version'&&request.method==='GET')return json({version:APP_VERSION});
  if(path==='/api/test-dxf'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({allowed:false},401);
    const allowed=await testDxfAllowed(user.id,env);
    return allowed?json({allowed:true,files:TEST_DXF_FILES}):json({allowed:false},403);
  }
    if(path==='/api/auth/me'&&request.method==='GET'){
    const user=await sessionUser(request,env);
    if(!user)return json({user:null},401);
    await touchPresence(env,user.id);
    return json({user:publicUser(user)});
  }
  if(path==='/api/auth/register'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),name=String(data.name||'').trim().slice(0,120),password=String(data.password||''),locale=cleanLocale(data.locale);
    if(!validEmail(email)||!passwordOk(password))return json({error:'Geçerli e-posta ve en az 8 karakter parola gerekli.'},400);
    if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return json({error:'Bu e-posta zaten kayıtlı.'},409);
    const result=await env.DB.prepare(`INSERT INTO users(email,name,password_hash,role,nesting_credits,unlimited,last_login_at)
      VALUES(?,?,?,'user',5,0,CURRENT_TIMESTAMP)`).bind(email,name,await hashPassword(password)).run();
    const userId=Number(result.meta.last_row_id);
    await env.DB.prepare(`INSERT INTO user_preferences(user_id,locale,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET locale=excluded.locale,updated_at=CURRENT_TIMESTAMP`).bind(userId,locale).run();
    const user=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at
      FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?`).bind(userId).first();
    return json({user:publicUser(user)},201,{'set-cookie':cookie(await makeSession(user.id,env))});
  }
  if(path==='/api/auth/admin-me'&&request.method==='GET'){
    return await adminSessionValid(request,env)?json({user:{id:0,email:'',name:'Admin',role:'admin',credits:0,unlimited:true}}):json({user:null},401);
  }
  if(path==='/api/auth/admin-login'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
    if(!validEmail(email)||!password)return json({error:'E-posta veya parola hatalı.'},401);
    let valid=false;
    const admin=await env.DB.prepare("SELECT id,email,name,password_hash FROM users WHERE lower(email)=? AND role='admin' LIMIT 1").bind(email).first();
    if(admin?.password_hash)valid=await verifyPassword(password,admin.password_hash);
    if(!valid&&email===ADMIN_LOGIN_EMAIL&&env.ADMIN_PASSWORD)valid=await secureEqual(password,env.ADMIN_PASSWORD);
    if(!valid)return json({error:'E-posta veya parola hatalı. Admin hesabının role=admin olduğundan ve parolasının tanımlı olduğundan emin olun.'},401);
    return json({user:{id:Number(admin?.id||0),email:admin?.email||ADMIN_LOGIN_EMAIL,name:admin?.name||'Admin',role:'admin',credits:0,unlimited:true}},200,{'set-cookie':adminCookie(await makeAdminSession(env))});
  }
    if(path==='/api/auth/login'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
    const user=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,u.password_hash,
      l.started_at license_started_at,l.expires_at license_expires_at
      FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.email=?`).bind(email).first();
    if(!user||!await verifyPassword(password,user.password_hash)){await audit(env,'login_failed',{actorType:'user',detail:email,success:false});return json({error:'E-posta veya parola hatalı.'},401);}
    await env.DB.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').bind(user.id).run();
    await audit(env,'login',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:'E-posta ile giriş'});
    return json({user:publicUser(user)},200,{'set-cookie':cookie(await makeSession(user.id,env))});
  }
  if(path==='/api/auth/google'&&request.method==='POST'){
    const data=await body(request),credential=String(data.credential||''),result=await googleUserFromCredential(credential,env,data.locale);
    if(result.error)return json({error:result.error},result.status);
    return json({user:publicUser(result.user)},200,{'set-cookie':cookie(await makeSession(result.user.id,env))});
  }
  if(path==='/api/auth/reset-password'&&request.method==='POST'){
    const data=await body(request),token=String(data.token||''),newPassword=String(data.password||'');
    if(!token||!passwordOk(newPassword))return json({error:'Geçerli bağlantı ve en az 8 karakter parola gerekli.'},400);
    const tokenHash=await sha256(token);
    const reset=await env.DB.prepare("SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND datetime(expires_at)>datetime('now')").bind(tokenHash).first();
    if(!reset)return json({error:'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.'},400);
    await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(newPassword),reset.user_id).run();
    await env.DB.prepare('UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?').bind(tokenHash).run();
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(reset.user_id).run();
    await audit(env,'password_changed',{actorType:'user',actorUserId:reset.user_id,targetUserId:reset.user_id});
    return json({ok:true});
  }
  if(path==='/api/preferences'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({locale:null},401);
    const row=await env.DB.prepare('SELECT locale FROM user_preferences WHERE user_id=?').bind(user.id).first();
    return json({locale:row?.locale||'tr'});
  }
  if(path==='/api/preferences'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const data=await body(request),locale=String(data.locale||'');
    if(!['tr','en','ar','fa'].includes(locale))return json({error:'Geçersiz dil.'},400);
    await env.DB.prepare(`INSERT INTO user_preferences(user_id,locale,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET locale=excluded.locale,updated_at=CURRENT_TIMESTAMP`).bind(user.id,locale).run();
    await audit(env,'language_changed',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:locale});
    return json({ok:true,locale});
  }
    if(path==='/api/auth/logout'&&request.method==='POST'){
    const current=await sessionUser(request,env),raw=cookieToken(request);if(raw)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(raw)).run();
    if(current)await audit(env,'logout',{actorType:'user',actorUserId:current.id,targetUserId:current.id});
    return json({ok:true},200,{'set-cookie':cookie('',0)});
  }
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
    const user=await sessionUser(request,env);if(!user)return json({error:'Nesting için giriş yapmalısınız.'},401);
    if(licenseExpired(user))return json({error:'Lisans süreniz doldu. Devam etmek için yöneticinizden lisans süresini uzatmasını isteyin.'},403);
    if(!user.unlimited){
      const updated=await env.DB.prepare('UPDATE users SET nesting_credits=nesting_credits-1 WHERE id=? AND nesting_credits>0').bind(user.id).run();
      if(!updated.meta.changes)return json({error:'Nesting hakkınız kalmadı.'},402);
    }
    const data=await body(request);
    await env.DB.prepare('INSERT INTO nesting_history(user_id,project_name,source_file_name,used_credit) VALUES(?,?,?,?)')
      .bind(user.id,String(data.projectName||'').slice(0,200),String(data.sourceFileName||'').slice(0,255),user.unlimited?0:1).run();
    const fresh=await env.DB.prepare('SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?').bind(user.id).first();
    await audit(env,'nesting_start',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:String(data.projectName||'')});
    return json({ok:true,user:publicUser(fresh)});
  }
  if(path==='/api/project/autosave'&&request.method==='PUT'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Bulut kayıt için giriş yapmalısınız.'},401);
    const data=await body(request),projectJson=typeof data.projectJson==='string'?data.projectJson:'';
    const projectName=String(data.projectName||'').trim().slice(0,200);
    if(!projectJson.trim())return json({error:'Proje kaydı boş olamaz.'},400);
    const encoded=encodeExportChunks(projectJson);
    if(encoded.byteSize>12*1024*1024)return json({error:'Proje bulut kaydı için 12 MiB sınırını aşıyor.'},413);
    const statements=[
      env.DB.prepare('DELETE FROM cloud_project_chunks WHERE user_id=?').bind(user.id),
      env.DB.prepare(`INSERT INTO cloud_projects(user_id,label,project_name,byte_size,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET label=excluded.label,project_name=excluded.project_name,byte_size=excluded.byte_size,updated_at=CURRENT_TIMESTAMP`)
        .bind(user.id,'Serula Nesting En Temiz Hali',projectName,encoded.byteSize),
      ...encoded.chunks.map((chunk,index)=>env.DB.prepare('INSERT INTO cloud_project_chunks(user_id,chunk_index,data) VALUES(?,?,?)').bind(user.id,index,chunk))
    ];
    try{await env.DB.batch(statements)}
    catch(error){await audit(env,'cloud_autosave_failed',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:projectName,success:false});return json({error:'Bulut kaydı tamamlanamadı.'},500)}
    return json({ok:true,label:'Serula Nesting En Temiz Hali'});
  }
  if(path==='/api/project/autosave'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Bulut kaydı görmek için giriş yapmalısınız.'},401);
    const row=await env.DB.prepare('SELECT label,project_name,byte_size,updated_at FROM cloud_projects WHERE user_id=?').bind(user.id).first();
    if(!row)return json({item:null});
    if(url.searchParams.get('content')==='1'){
      const project=await readCloudProjectText(env,user.id);
      if(!project)return json({error:'Bulut proje verisi bulunamadı.'},404);
      return new Response(project,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
    }
    return json({item:{label:row.label||'Serula Nesting En Temiz Hali',projectName:row.project_name||'',byteSize:Number(row.byte_size||0),updatedAt:row.updated_at}});
  }
  if(path==='/api/export/authorize'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'DXF indirmek için giriş yapmalısınız.'},401);
    if(licenseExpired(user))return json({error:'Lisans süreniz doldu. DXF indirmek için yöneticinizden lisans süresini uzatmasını isteyin.'},403);
    const data=await body(request);
    const projectName=String(data.projectName||'').trim().slice(0,200);
    const sourceFileName=String(data.sourceFileName||'').trim().slice(0,255);
    const dxf=typeof data.dxf==='string'?data.dxf:'';
    const projectJson=typeof data.projectJson==='string'?data.projectJson:'';
    let fileName=String(data.fileName||sourceFileName||'serula-export.dxf').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,240)||'serula-export.dxf';
    if(!/\.dxf$/i.test(fileName))fileName+='.dxf';
    if(!dxf.trim())return json({error:'Buluta kaydedilecek DXF verisi boş.'},400);
    const encodedDxf=encodeExportChunks(dxf),encodedProject=encodeExportChunks(projectJson);
    if(encodedDxf.byteSize>10*1024*1024)return json({error:'DXF dosyası bulut kaydı için 10 MiB sınırını aşıyor.'},413);
    if(encodedProject.byteSize>12*1024*1024)return json({error:'Proje kaydı bulut için 12 MiB sınırını aşıyor.'},413);
    let charged=false,historyId=0,exportId=0;
    try{
      if(!user.unlimited){
        const updated=await env.DB.prepare('UPDATE users SET nesting_credits=nesting_credits-1 WHERE id=? AND nesting_credits>0').bind(user.id).run();
        if(!updated.meta.changes)return json({error:'Nesting hakkınız kalmadı. Admin yeni hak verebilir.'},402);
        charged=true;
      }
      const history=await env.DB.prepare('INSERT INTO nesting_history(user_id,project_name,source_file_name,used_credit) VALUES(?,?,?,?)')
        .bind(user.id,projectName,sourceFileName,user.unlimited?0:1).run();
      historyId=Number(history.meta.last_row_id);
      const saved=await env.DB.prepare('INSERT INTO export_files(user_id,project_name,source_file_name,file_name,dxf_text,project_json,byte_size) VALUES(?,?,?,?,?,?,?)')
        .bind(user.id,projectName,sourceFileName,fileName,'',null,encodedDxf.byteSize).run();
      exportId=Number(saved.meta.last_row_id);
      const statements=[
        ...encodedDxf.chunks.map((chunk,index)=>env.DB.prepare('INSERT INTO export_file_chunks(export_id,kind,chunk_index,data) VALUES(?,?,?,?)').bind(exportId,'dxf',index,chunk)),
        ...encodedProject.chunks.map((chunk,index)=>env.DB.prepare('INSERT INTO export_file_chunks(export_id,kind,chunk_index,data) VALUES(?,?,?,?)').bind(exportId,'project',index,chunk))
      ];
      if(statements.length)await env.DB.batch(statements);
    }catch(error){
      try{if(exportId)await env.DB.prepare('DELETE FROM export_files WHERE id=? AND user_id=?').bind(exportId,user.id).run()}catch{}
      try{if(historyId)await env.DB.prepare('DELETE FROM nesting_history WHERE id=? AND user_id=?').bind(historyId,user.id).run()}catch{}
      try{if(charged)await env.DB.prepare('UPDATE users SET nesting_credits=nesting_credits+1 WHERE id=?').bind(user.id).run()}catch{}
      await audit(env,'export_save_failed',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:fileName,success:false});
      return json({error:'DXF buluta kaydedilemedi. Lütfen yeniden deneyin.'},500);
    }
    const fresh=await env.DB.prepare('SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?').bind(user.id).first();
    await audit(env,'export_saved',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:fileName});
    return json({ok:true,exportId,user:publicUser(fresh)});
  }
  if(path==='/api/exports'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Geçmişi görmek için giriş yapmalısınız.'},401);
    const rows=await env.DB.prepare(`SELECT id,project_name,source_file_name,file_name,byte_size,created_at
      FROM export_files WHERE user_id=? ORDER BY id DESC LIMIT 200`).bind(user.id).all();
    return json({items:rows.results.map(row=>({id:Number(row.id),projectName:row.project_name||'',sourceFileName:row.source_file_name||'',fileName:row.file_name||'',byteSize:Number(row.byte_size||0),createdAt:row.created_at}))});
  }
  const exportFileMatch=path.match(/^\/api\/exports\/(\d+)$/);
  if(exportFileMatch&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const id=Number(exportFileMatch[1]);
    const row=await env.DB.prepare('SELECT id,file_name,dxf_text,project_json FROM export_files WHERE id=? AND user_id=?').bind(id,user.id).first();
    if(!row)return json({error:'Kayıt bulunamadı.'},404);
    if(url.searchParams.get('kind')==='project'){
      const project=await readExportText(env,id,'project',row.project_json||'');
      if(!project)return json({error:'Bu kaydın proje verisi bulunmuyor.'},404);
      return new Response(project,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
    }
    const dxfText=await readExportText(env,id,'dxf',row.dxf_text||'');
    if(!dxfText)return json({error:'DXF verisi bulunamadı.'},404);
    const safeName=String(row.file_name||'serula-export.dxf').replace(/[\r\n"]/g,'_');
    return new Response(dxfText,{headers:{'content-type':'application/dxf; charset=utf-8','content-disposition':`attachment; filename="${safeName}"`,'cache-control':'private, no-store'}});
  }
  if(exportFileMatch&&request.method==='DELETE'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Giriş gerekli.'},401);
    const id=Number(exportFileMatch[1]);
    const row=await env.DB.prepare('SELECT id,file_name FROM export_files WHERE id=? AND user_id=?').bind(id,user.id).first();
    if(!row)return json({error:'Kayıt bulunamadı.'},404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM export_file_chunks WHERE export_id=?').bind(id),
      env.DB.prepare('DELETE FROM export_files WHERE id=? AND user_id=?').bind(id,user.id)
    ]);
    await audit(env,'export_deleted',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:String(row.file_name||id)});
    return json({ok:true});
  }
  if(path==='/api/admin/users'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const rows=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,u.google_id,u.created_at,u.last_login_at,
      COALESCE(f.test_dxf_enabled,0) test_dxf_enabled,p.last_seen,l.started_at license_started_at,l.expires_at license_expires_at,
      CASE WHEN ${onlineSql} THEN 1 ELSE 0 END online
      FROM users u
      LEFT JOIN user_features f ON f.user_id=u.id
      LEFT JOIN user_presence p ON p.user_id=u.id
      LEFT JOIN user_licenses l ON l.user_id=u.id
      ORDER BY u.created_at DESC LIMIT 500`).all();
    const online=await env.DB.prepare("SELECT COUNT(*) n FROM user_presence WHERE datetime(last_seen)>=datetime('now','-15 seconds')").first();
    return json({onlineCount:Number(online?.n||0),users:rows.results.map(u=>({...publicUser(u),testDxfEnabled:!!u.test_dxf_enabled,authProvider:u.google_id?'google':'email',createdAt:u.created_at,lastLoginAt:u.last_login_at,lastSeen:u.last_seen||null,online:!!u.online}))});
  }
  if(path==='/api/admin/chats'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const rows=await env.DB.prepare(`SELECT u.id,u.email,u.name,MAX(m.created_at) last_message_at,
      SUM(CASE WHEN m.sender='user' AND m.read_at IS NULL THEN 1 ELSE 0 END) unread,
      p.last_seen,CASE WHEN ${onlineSql} THEN 1 ELSE 0 END online
      FROM users u JOIN chat_messages m ON m.user_id=u.id LEFT JOIN user_presence p ON p.user_id=u.id
      GROUP BY u.id,u.email,u.name,p.last_seen ORDER BY MAX(m.id) DESC LIMIT 500`).all();
    const online=await env.DB.prepare("SELECT COUNT(*) n FROM user_presence WHERE datetime(last_seen)>=datetime('now','-15 seconds')").first();
    return json({onlineCount:Number(online?.n||0),conversations:rows.results.map(r=>({userId:r.id,email:r.email,name:r.name||'',lastMessageAt:r.last_message_at,unread:Number(r.unread||0),lastSeen:r.last_seen||null,online:!!r.online}))});
  }
  const adminChatMatch=path.match(/^\/api\/admin\/chats\/(\d+)$/);
  if(adminChatMatch&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminChatMatch[1]),target=await env.DB.prepare('SELECT id,email,name FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare("UPDATE chat_messages SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND sender='user' AND read_at IS NULL").bind(id).run();
    const rows=await env.DB.prepare("SELECT id,sender,body,created_at,read_at FROM chat_messages WHERE user_id=? ORDER BY id ASC LIMIT 300").bind(id).all();
    const presence=await env.DB.prepare("SELECT last_seen,CASE WHEN datetime(last_seen)>=datetime('now','-15 seconds') THEN 1 ELSE 0 END online FROM user_presence WHERE user_id=?").bind(id).first();
    return json({user:{id:target.id,email:target.email,name:target.name||'',online:!!presence?.online,lastSeen:presence?.last_seen||null},messages:rows.results.map(m=>({id:m.id,sender:m.sender,body:m.body,createdAt:m.created_at,readAt:m.read_at||null}))});
  }
  if(adminChatMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(adminChatMatch[1]),target=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    const data=await body(request),message=String(data.message||'').trim();
    if(!message)return json({error:'Mesaj boş olamaz.'},400);
    if(message.length>2000)return json({error:'Mesaj en fazla 2000 karakter olabilir.'},400);
    const result=await env.DB.prepare("INSERT INTO chat_messages(user_id,sender,body) VALUES(?,'admin',?)").bind(id,message).run();
    return json({ok:true,id:Number(result.meta.last_row_id)});
  }
  const deleteUserMatch=path.match(/^\/api\/admin\/users\/(\d+)$/);
  if(deleteUserMatch&&request.method==='DELETE'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(deleteUserMatch[1]),target=await env.DB.prepare('SELECT id,email,name,role FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM chat_messages WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM user_presence WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM support_frames WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM support_signals WHERE session_id IN (SELECT id FROM support_sessions WHERE user_id=?)').bind(id),
      env.DB.prepare('DELETE FROM support_sessions WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM user_features WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM user_preferences WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM user_licenses WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM user_settings WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM cloud_project_chunks WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM cloud_projects WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM export_file_chunks WHERE export_id IN (SELECT id FROM export_files WHERE user_id=?)').bind(id),
      env.DB.prepare('DELETE FROM export_files WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM nesting_history WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM audit_logs WHERE actor_user_id=? OR target_user_id=?').bind(id,id),
      env.DB.prepare('DELETE FROM users WHERE id=?').bind(id)
    ]);
    await audit(env,'user_deleted',{actorType:'admin',detail:String(target.email||id)});
    return json({ok:true});
  }
  if(path==='/api/admin/health'&&request.method==='GET'){
    const auth=await adminSessionValid(request,env);if(!auth)return json({error:'Yetkisiz.'},403);
    let userStore=false;try{await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();userStore=true}catch{}
    return json({adminApi:true,auth:true,userStore});
  }
  if(path==='/api/admin/logs'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const rows=await env.DB.prepare(`SELECT l.id,l.actor_type,l.action,l.detail,l.success,l.created_at,au.email actor_email,tu.email target_email
      FROM audit_logs l LEFT JOIN users au ON au.id=l.actor_user_id LEFT JOIN users tu ON tu.id=l.target_user_id
      WHERE datetime(l.created_at)>=datetime('now','-10 days')
      ORDER BY l.id DESC LIMIT 250`).all();
    return json({retentionDays:10,logs:rows.results.map(r=>({id:r.id,actorType:r.actor_type,actorEmail:r.actor_email||'',targetEmail:r.target_email||'',action:r.action,detail:r.detail||'',success:!!r.success,createdAt:r.created_at}))});
  }
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
    const id=Number(userSettingsMatch[1]);await env.DB.prepare('DELETE FROM user_settings WHERE user_id=?').bind(id).run();await audit(env,'user_settings_reset',{actorType:'admin',targetUserId:id});return json({settings:await systemDefaults(env),custom:false});
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
    const id=Number(testDxfMatch[1]),data=await body(request),enabled=!!data.enabled;
    const target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare(`INSERT INTO user_features(user_id,test_dxf_enabled,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET test_dxf_enabled=excluded.test_dxf_enabled,updated_at=CURRENT_TIMESTAMP`).bind(id,enabled?1:0).run();
    await audit(env,'test_dxf_changed',{actorType:'admin',targetUserId:id,detail:enabled?'Açık':'Kapalı'});
    return json({ok:true,enabled});
  }
    const unlimitedMatch=path.match(/^\/api\/admin\/users\/(\d+)\/unlimited$/);
  if(unlimitedMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(unlimitedMatch[1]),data=await body(request),unlimited=!!data.unlimited,target=await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first();if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    await env.DB.prepare('UPDATE users SET unlimited=? WHERE id=?').bind(unlimited?1:0,id).run();await audit(env,'unlimited_changed',{actorType:'admin',targetUserId:id,detail:unlimited?'Açık':'Kapalı'});return json({ok:true,unlimited});
  }
  const resetMatch=path.match(/^\/api\/admin\/users\/(\d+)\/password-reset$/);
  if(resetMatch&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const id=Number(resetMatch[1]),target=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    if(!env.EMAIL)return json({error:'E-posta gönderim servisi yapılandırılmamış.'},503);
    const raw=randomToken(),expires=new Date(Date.now()+3600000).toISOString();
    await env.DB.prepare('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(raw),id,expires).run();
    const resetUrl=new URL(request.url).origin+'/?reset='+encodeURIComponent(raw);
    await env.EMAIL.send({to:target.email,from:'noreply@serula.site',subject:'Serula Nesting - Şifre Sıfırlama',text:'Şifrenizi yenilemek için bu bağlantıyı 1 saat içinde açın: '+resetUrl});
    await audit(env,'password_reset_sent',{actorType:'admin',targetUserId:id,detail:target.email});
    return json({ok:true});
  }
  const m=path.match(/^\/api\/admin\/users\/(\d+)\/credits$/);
  if(m&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const data=await body(request),id=Number(m[1]),credits=Math.max(0,Math.min(100000,Math.trunc(Number(data.credits)||0)));
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
