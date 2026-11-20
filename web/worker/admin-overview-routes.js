/**
 * Admin user management, chat and audit reports.
 * All adminSessionValid guards and SQL are retained byte-for-byte.
 */
export async function handleAdminOverviewRoutes(request,env,path,url,{
  adminSessionValid,json,body,onlineSql,publicUser,audit,
}) {
  if(path==='/api/admin/users'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    // Keep this UI compatible before and after the OTP activation PR ships.
    const otpTable=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_verifications'").first();
    const verifiedColumn=otpTable
      ?'CASE WHEN EXISTS(SELECT 1 FROM email_verifications v WHERE v.user_id=u.id) THEN 0 ELSE 1 END'
      :'1';
    const rows=await env.DB.prepare(`SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,u.google_id,u.created_at,u.last_login_at,
      ${verifiedColumn} email_verified,
      COALESCE(f.test_dxf_enabled,0) test_dxf_enabled,COALESCE(ct.enabled,1) corel_enabled,p.last_seen,l.started_at license_started_at,l.expires_at license_expires_at,
      CASE WHEN ${onlineSql} THEN 1 ELSE 0 END online
      FROM users u
      LEFT JOIN user_features f ON f.user_id=u.id
      LEFT JOIN user_corel_transfer_access ct ON ct.user_id=u.id
      LEFT JOIN user_presence p ON p.user_id=u.id
      LEFT JOIN user_licenses l ON l.user_id=u.id
      ORDER BY u.created_at DESC LIMIT 500`).all();
    const online=await env.DB.prepare("SELECT COUNT(*) n FROM user_presence WHERE datetime(last_seen)>=datetime('now','-15 seconds')").first();
    return json({onlineCount:Number(online?.n||0),users:rows.results.map(u=>({...publicUser(u),testDxfEnabled:!!u.test_dxf_enabled,corelTransferEnabled:!!u.corel_enabled,authProvider:u.google_id?'google':'email',emailVerified:!!u.email_verified,createdAt:u.created_at,lastLoginAt:u.last_login_at,lastSeen:u.last_seen||null,online:!!u.online}))});
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
      env.DB.prepare('DELETE FROM transfer_tickets WHERE user_id=?').bind(id),
      env.DB.prepare('DELETE FROM user_corel_transfer_access WHERE user_id=?').bind(id),
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
  if(path==='/api/admin/history'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const days=Number(url.searchParams.get('days')||30);
    if(![7,30].includes(days))return json({error:'Geçersiz geçmiş aralığı.'},400);
    const rows=await env.DB.prepare(`SELECT h.id,h.user_id,u.email,u.name,h.project_name,h.source_file_name,h.used_credit,h.created_at
      FROM nesting_history h JOIN users u ON u.id=h.user_id
      WHERE datetime(h.created_at)>=datetime('now',?)
      ORDER BY h.id DESC LIMIT 500`).bind('-'+days+' days').all();
    return json({days,items:rows.results.map(row=>({
      id:row.id,userId:row.user_id,email:row.email,name:row.name||'',
      projectName:row.project_name||'',sourceFileName:row.source_file_name||'',
      usedCredit:Number(row.used_credit||0),createdAt:row.created_at
    }))});
  }
  if(path==='/api/admin/logs'&&request.method==='GET'){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    const rows=await env.DB.prepare(`SELECT l.id,l.actor_type,l.action,l.detail,l.success,l.created_at,au.email actor_email,tu.email target_email
      FROM audit_logs l LEFT JOIN users au ON au.id=l.actor_user_id LEFT JOIN users tu ON tu.id=l.target_user_id
      WHERE datetime(l.created_at)>=datetime('now','-10 days')
      ORDER BY l.id DESC LIMIT 250`).all();
    return json({retentionDays:10,logs:rows.results.map(r=>({id:r.id,actorType:r.actor_type,actorEmail:r.actor_email||'',targetEmail:r.target_email||'',action:r.action,detail:r.detail||'',success:!!r.success,createdAt:r.created_at}))});
  }
  return undefined;
}
