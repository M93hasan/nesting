/**
 * User and administrator remote support sessions, permission checks,
 * screen signaling, frames, expiry and auditing.
 * No session lifetime or D1 behavior is changed.
 */
export async function handleSupportRoutes(request,env,path,url,{
  json,sessionUser,touchPresence,body,audit,adminSessionValid,
}) {
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
  return undefined;
}
