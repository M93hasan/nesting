const GOOGLE_CLIENT_ID='249559754500-36grgmm2jucf2159d41efqdcqut02lj6.apps.googleusercontent.com';
const SESSION_DAYS=30;
const ADMIN_LOGIN_EMAIL='m93hasan@icloud.com';
// Build marker: 0.0.53

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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
  ]);
}
async function sessionUser(request,env){
  const raw=cookieToken(request);if(!raw)return null;
  const row=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND datetime(s.expires_at)>datetime('now')`).bind(await sha256(raw)).first();
  return row||null;
}
async function makeSession(userId,env){
  const raw=randomToken(),expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)').bind(userId,await sha256(raw),expires).run();
  return raw;
}
function publicUser(u){return {id:u.id,email:u.email,name:u.name||'',role:u.role,credits:Number(u.nesting_credits||0),unlimited:!!u.unlimited}}
function sameOrigin(request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
async function body(request){try{return await request.json()}catch{return {}}}
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordOk=p=>typeof p==='string'&&p.length>=8&&p.length<=200;
function googleLoginPage(){return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Serula - Google ile giriş</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f5f6f8;color:#1f2937}.card{width:min(92vw,380px);background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.08);text-align:center}.logo{width:72px;height:72px;margin-bottom:12px}.google{display:flex;justify-content:center;margin:22px 0}.error{color:#b91c1c;min-height:22px}.back{display:inline-block;margin-top:8px;color:#374151;text-decoration:none}</style>
<script src="https://accounts.google.com/gsi/client" async defer></script></head>
<body><main class="card"><img class="logo" src="/serula-logo.svg" alt=""><h1>Serula Nesting</h1><p>Google hesabınızla güvenli şekilde giriş yapın.</p><div id="google" class="google"></div><p id="error" class="error"></p><a class="back" href="/">Geri dön</a></main>
<script>
window.addEventListener('load',()=>{const error=document.getElementById('error');const start=()=>{if(!window.google?.accounts?.id){error.textContent='Google giriş servisi yüklenemedi.';return;}google.accounts.id.initialize({client_id:'249559754500-36grgmm2jucf2159d41efqdcqut02lj6.apps.googleusercontent.com',auto_select:false,itp_support:true,use_fedcm_for_button:false,ux_mode:'popup',callback:async r=>{try{error.textContent='Giriş yapılıyor…';const response=await fetch('/api/auth/google',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({credential:r.credential})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Google girişi başarısız.');location.replace('/');}catch(e){error.textContent=e instanceof Error?e.message:String(e);}}});google.accounts.id.renderButton(document.getElementById('google'),{theme:'outline',size:'large',text:'continue_with',shape:'pill',width:300});};if(window.google?.accounts?.id)start();else setTimeout(start,600);});
</script></body></html>`;}

async function handleApi(request,env){
  await ensureSchema(env);
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/auth/google-start'&&request.method==='GET'){
    return new Response(googleLoginPage(),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
  }
  if(request.method!=='GET'&&!sameOrigin(request))return json({error:'Geçersiz istek.'},403);

  if(path==='/api/auth/me'&&request.method==='GET'){
    const user=await sessionUser(request,env);return user?json({user:publicUser(user)}):json({user:null},401);
  }
  if(path==='/api/auth/register'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),name=String(data.name||'').trim().slice(0,120),password=String(data.password||'');
    if(!validEmail(email)||!passwordOk(password))return json({error:'Geçerli e-posta ve en az 8 karakter parola gerekli.'},400);
    if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return json({error:'Bu e-posta zaten kayıtlı.'},409);
    const result=await env.DB.prepare(`INSERT INTO users(email,name,password_hash,role,nesting_credits,unlimited,last_login_at)
      VALUES(?,?,?,'user',5,0,CURRENT_TIMESTAMP)`).bind(email,name,await hashPassword(password)).run();
    const user=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited FROM users WHERE id=?').bind(result.meta.last_row_id).first();
    return json({user:publicUser(user)},201,{'set-cookie':cookie(await makeSession(user.id,env))});
  }
  if(path==='/api/auth/admin-me'&&request.method==='GET'){
    return await adminSessionValid(request,env)?json({user:{id:0,email:'',name:'Admin',role:'admin',credits:0,unlimited:true}}):json({user:null},401);
  }
  if(path==='/api/auth/admin-login'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
    if(email!==ADMIN_LOGIN_EMAIL||!password)return json({error:'E-posta veya parola hatalı.'},401);
    let valid=false;
    const admin=await env.DB.prepare("SELECT password_hash FROM users WHERE lower(email)=? AND role='admin' LIMIT 1").bind(email).first();
    if(admin?.password_hash)valid=await verifyPassword(password,admin.password_hash);
    if(!valid&&env.ADMIN_PASSWORD)valid=await secureEqual(password,env.ADMIN_PASSWORD);
    if(!valid)return json({error:'E-posta veya parola hatalı.'},401);
    return json({user:{id:0,email:ADMIN_LOGIN_EMAIL,name:'Admin',role:'admin',credits:0,unlimited:true}},200,{'set-cookie':adminCookie(await makeAdminSession(env))});
  }
    if(path==='/api/auth/login'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
    const user=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited,password_hash FROM users WHERE email=?').bind(email).first();
    if(!user||!await verifyPassword(password,user.password_hash))return json({error:'E-posta veya parola hatalı.'},401);
    await env.DB.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').bind(user.id).run();
    return json({user:publicUser(user)},200,{'set-cookie':cookie(await makeSession(user.id,env))});
  }
  if(path==='/api/auth/google'&&request.method==='POST'){
    const data=await body(request),credential=String(data.credential||'');
    const verify=credential&&await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential));
    if(!verify||!verify.ok)return json({error:'Google doğrulaması başarısız.'},401);
    const claims=await verify.json(),email=String(claims.email||'').toLowerCase();
    if(claims.aud!==GOOGLE_CLIENT_ID||claims.email_verified!=='true'||!validEmail(email))return json({error:'Google hesabı doğrulanamadı.'},401);
    let user=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited FROM users WHERE email=?').bind(email).first();
    if(!user){
      const result=await env.DB.prepare(`INSERT INTO users(email,name,google_id,role,nesting_credits,unlimited,last_login_at)
        VALUES(?,?,?,'user',5,0,CURRENT_TIMESTAMP)`).bind(email,String(claims.name||'').slice(0,120),String(claims.sub||'')).run();
      user=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited FROM users WHERE id=?').bind(result.meta.last_row_id).first();
    }else await env.DB.prepare('UPDATE users SET google_id=COALESCE(google_id,?),last_login_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(claims.sub||''),user.id).run();
    return json({user:publicUser(user)},200,{'set-cookie':cookie(await makeSession(user.id,env))});
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){
    const raw=cookieToken(request);if(raw)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(raw)).run();
    return json({ok:true},200,{'set-cookie':cookie('',0)});
  }
  if(path==='/api/nesting/start'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Nesting için giriş yapmalısınız.'},401);
    if(!user.unlimited){
      const updated=await env.DB.prepare('UPDATE users SET nesting_credits=nesting_credits-1 WHERE id=? AND nesting_credits>0').bind(user.id).run();
      if(!updated.meta.changes)return json({error:'Nesting hakkınız kalmadı.'},402);
    }
    const data=await body(request);
    await env.DB.prepare('INSERT INTO nesting_history(user_id,project_name,source_file_name,used_credit) VALUES(?,?,?,?)')
      .bind(user.id,String(data.projectName||'').slice(0,200),String(data.sourceFileName||'').slice(0,255),user.unlimited?0:1).run();
    const fresh=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited FROM users WHERE id=?').bind(user.id).first();
    return json({ok:true,user:publicUser(fresh)});
  }
  if(path==='/api/export/authorize'&&request.method==='POST'){
    const user=await sessionUser(request,env);if(!user)return json({error:'DXF indirmek için giriş yapmalısınız.'},401);
    if(!user.unlimited){
      const updated=await env.DB.prepare('UPDATE users SET nesting_credits=nesting_credits-1 WHERE id=? AND nesting_credits>0').bind(user.id).run();
      if(!updated.meta.changes)return json({error:'Nesting hakkınız kalmadı. Admin yeni hak verebilir.'},402);
    }
    const data=await body(request);
    await env.DB.prepare('INSERT INTO nesting_history(user_id,project_name,source_file_name,used_credit) VALUES(?,?,?,?)')
      .bind(user.id,String(data.projectName||'').slice(0,200),String(data.sourceFileName||'').slice(0,255),user.unlimited?0:1).run();
    const fresh=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited FROM users WHERE id=?').bind(user.id).first();
    return json({ok:true,user:publicUser(fresh)});
  }
  if(path==='/api/admin/users'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const rows=await env.DB.prepare('SELECT id,email,name,role,nesting_credits,unlimited,created_at,last_login_at FROM users ORDER BY created_at DESC LIMIT 500').all();
    return json({users:rows.results.map(u=>({...publicUser(u),createdAt:u.created_at,lastLoginAt:u.last_login_at}))});
  }
  const m=path.match(/^\/api\/admin\/users\/(\d+)\/credits$/);
  if(m&&request.method==='POST'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const data=await body(request),id=Number(m[1]),credits=Math.max(0,Math.min(100000,Math.trunc(Number(data.credits)||0)));
    const target=await env.DB.prepare('SELECT id,role FROM users WHERE id=?').bind(id).first();
    if(!target)return json({error:'Kullanıcı bulunamadı.'},404);
    if(target.role==='admin'){
      await env.DB.prepare('UPDATE users SET nesting_credits=?,unlimited=1 WHERE id=?').bind(credits,id).run();
    }else{
      await env.DB.prepare('UPDATE users SET nesting_credits=?,unlimited=0 WHERE id=?').bind(credits,id).run();
    }
    return json({ok:true});
  }
  return json({error:'Bulunamadı.'},404);
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return handleApi(request,env);
  return env.ASSETS.fetch(request);
}};
