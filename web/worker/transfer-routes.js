/**
 * Authenticated local transfer and test-DXF endpoints.
 * Original authorization checks, expiry windows, SQL and responses preserved.
 * Inject Worker runtime dependencies rather than coupling to global state.
 */
export async function handleTransferRoutes(request,env,path,{
  json,sessionUser,licenseExpired,corelAllowed,body,randomToken,
  sha256,audit,testDxfAllowed,TEST_DXF_FILES,
}) {
  if(path==='/api/transfer/access'&&request.method==='GET'){
    const user=await sessionUser(request,env);
    if(!user||licenseExpired(user))return json({corel:false,rdworks:false});
    return json({corel:await corelAllowed(user.id,env),rdworks:false});
  }
  if(path==='/api/transfer/ticket'&&request.method==='POST'){
    const user=await sessionUser(request,env);
    if(!user||licenseExpired(user))return json({error:'Giriş ve geçerli lisans gerekli.'},403);
    const data=await body(request),target=data.target;
    if(target!=='corel')return json({error:'RDWorks otomatik aktarımı desteklenmiyor.'},403);
    if(!await corelAllowed(user.id,env))return json({error:'Bu aktarım yetkisi yönetici tarafından kapatılmış.'},403);
    const ticket=randomToken(),expiresAt=new Date(Date.now()+120000).toISOString();
    await env.DB.prepare("DELETE FROM transfer_tickets WHERE datetime(expires_at)<datetime('now','-1 day')").run();
    await env.DB.prepare("INSERT INTO transfer_tickets(token_hash,user_id,target,expires_at) VALUES(?,?,?,?)").bind(await sha256(ticket),user.id,target,expiresAt).run();
    return json({ticket,expiresAt});
  }
  if(path==='/api/transfer/redeem'&&request.method==='POST'){
    const data=await body(request),ticket=String(data.ticket||''),target=data.target;
    if(!/^[a-f0-9]{64}$/.test(ticket)||target!=='corel')return json({ok:false},403);
    const found=await env.DB.prepare('SELECT user_id,target,redeemed_at,expires_at FROM transfer_tickets WHERE token_hash=?').bind(await sha256(ticket)).first();
    if(!found||found.target!==target||found.redeemed_at||Date.parse(String(found.expires_at))<=Date.now())return json({ok:false},403);
    const user=await env.DB.prepare('SELECT u.id,u.role,l.expires_at license_expires_at FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?').bind(found.user_id).first();
    if(!user||licenseExpired(user))return json({ok:false},403);
    if(!await corelAllowed(user.id,env))return json({ok:false},403);
    const redeemed=await env.DB.prepare("UPDATE transfer_tickets SET redeemed_at=CURRENT_TIMESTAMP WHERE token_hash=? AND redeemed_at IS NULL AND datetime(expires_at)>datetime('now')").bind(await sha256(ticket)).run();
    if(!redeemed.meta.changes)return json({ok:false},403);
    await audit(env,'local_transfer_authorized',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:target});
    return json({ok:true});
  }
  if(path==='/api/test-dxf'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({allowed:false},401);
    const allowed=await testDxfAllowed(user.id,env);
    return allowed?json({allowed:true,files:TEST_DXF_FILES}):json({allowed:false},403);
  }
    return undefined;
}
