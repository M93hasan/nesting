/**
 * Authentication, admin sign-in and language preferences endpoints.
 * Logic intentionally copied without changes; DB and crypto helpers stay in
 * the canonical runtime and are dependency-injected for staged isolation.
 */
export async function handleAccountRoutes(request,env,path,{
  sessionUser,touchPresence,json,publicUser,body,cleanLocale,validEmail,passwordOk,
  hasEmailSender,hashPassword,sendVerificationCode,audit,verifyPassword,
  confirmVerificationCode,cookie,makeSession,adminSessionValid,ADMIN_LOGIN_EMAIL,
  secureEqual,adminCookie,makeAdminSession,googleUserFromCredential,sha256,cookieToken,
}) {
  if(path==='/api/auth/me'&&request.method==='GET'){
    const user=await sessionUser(request,env);
    if(!user)return json({user:null},401);
    await touchPresence(env,user.id);
    return json({user:publicUser(user)});
  }
  if(path==='/api/auth/register'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),name=String(data.name||'').trim().slice(0,120),password=String(data.password||''),locale=cleanLocale(data.locale);
    if(!validEmail(email)||!passwordOk(password))return json({error:'Geçerli e-posta ve en az 8 karakter parola gerekli.'},400);
    if(!hasEmailSender(env))return json({error:'E-posta doğrulama servisi hazır değil. Kayıt şu an yapılamıyor.'},503);
    if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return json({error:'Bu e-posta zaten kayıtlı.'},409);
    const result=await env.DB.prepare("INSERT INTO users(email,name,password_hash,role,nesting_credits,unlimited) VALUES(?,?,?,'user',5,0)")
      .bind(email,name,await hashPassword(password)).run();
    const userId=Number(result.meta.last_row_id);
    await env.DB.prepare("INSERT INTO user_preferences(user_id,locale,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET locale=excluded.locale,updated_at=CURRENT_TIMESTAMP")
      .bind(userId,locale).run();
    const issued=await sendVerificationCode(env,{id:userId,email},{initial:true});
    if(issued.error)return json({error:issued.error},issued.status);
    await audit(env,'verification_sent',{targetUserId:userId,detail:'New password registration'});
    // Never create an authenticated session before the emailed code is confirmed.
    return json(issued,202);
  }
  if(path==='/api/auth/resend-verification'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
    const user=validEmail(email)?await env.DB.prepare('SELECT id,email,password_hash FROM users WHERE email=?').bind(email).first():null;
    if(!user||!await verifyPassword(password,user.password_hash))return json({error:'E-posta veya parola hatalı.'},401);
    const pending=await env.DB.prepare('SELECT user_id FROM email_verifications WHERE user_id=?').bind(user.id).first();
    if(!pending)return json({error:'E-posta adresi zaten doğrulanmış.'},400);
    const issued=await sendVerificationCode(env,user);
    if(issued.error)return json({error:issued.error},issued.status);
    await audit(env,'verification_resent',{actorType:'user',actorUserId:user.id,targetUserId:user.id});
    return json(issued);
  }
  if(path==='/api/auth/verify-email'&&request.method==='POST'){
    const data=await body(request),email=String(data.email||'').trim().toLowerCase(),challenge=String(data.challenge||''),code=String(data.code||'');
    const verified=await confirmVerificationCode(env,email,challenge,code);
    if(verified.error)return json({error:verified.error},verified.status);
    const user=await env.DB.prepare("SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?")
      .bind(verified.user.id).first();
    await audit(env,'email_verified',{actorType:'user',actorUserId:user.id,targetUserId:user.id});
    return json({user:publicUser(user)},200,{'set-cookie':cookie(await makeSession(user.id,env))});
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
    const pending=await env.DB.prepare('SELECT user_id FROM email_verifications WHERE user_id=?').bind(user.id).first();
    if(pending){
      const issued=await sendVerificationCode(env,user);
      return json(issued,issued.status||202);
    }
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
  return undefined;
}
