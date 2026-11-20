/**
 * Cloud project HTTP handlers.
 * Auth, D1 queries, byte limits, JSON wire format and auditing are preserved
 * verbatim from serula-worker.js. Helpers are supplied by the Worker runtime.
 */
export async function putCloudProject(request,env,{sessionUser,body,json,encodeExportChunks,audit}) {
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

export async function getCloudProject(request,env,url,{sessionUser,json,readCloudProjectText}) {
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
