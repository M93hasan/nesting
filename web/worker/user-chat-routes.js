/** Authenticated chat and disabled charge-free nesting HTTP endpoint. */
export async function handleUserChatRoutes(request,env,path,{
  json,sessionUser,touchPresence,body,
}) {
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
  return undefined;
}
