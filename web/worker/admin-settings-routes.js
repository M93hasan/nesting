/**
 * Administrator settings, per-user licensing, permissions, passwords and
 * explicit credit adjustments. Same admin gate, audit and D1 operations.
 */
export async function handleAdminSettingsRoutes(request,env,path,url,{
  adminSessionValid,json,systemDefaults,body,cleanSettings,audit,sessionUser,
  hasEmailSender,randomToken,sha256,sendAppEmail,
}) {
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
  return undefined;
}
