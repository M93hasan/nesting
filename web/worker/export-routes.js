/**
 * Paid DXF exports, user export history, file download and deletion.
 * SQL, D1 trigger billing, authorization, size limits and status codes are
 * preserved from the original Cloudflare Worker handlers.
 */
export async function handleExportRoutes(request,env,path,url,{
  json,sessionUser,licenseExpired,body,encodeExportChunks,audit,publicUser,readExportText,
}) {
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
    // A random safe integer lets every insert share the same ID in one D1
    // transaction. The database trigger checks/debits credits and writes history.
    const bytes=crypto.getRandomValues(new Uint32Array(2));
    const exportId=(bytes[0]&0x1fffff)*4294967296+bytes[1]||1;
    try{
      await env.DB.batch([
        env.DB.prepare('INSERT INTO export_files(id,user_id,project_name,source_file_name,file_name,dxf_text,project_json,byte_size) VALUES(?,?,?,?,?,?,?,?)')
          .bind(exportId,user.id,projectName,sourceFileName,fileName,'',null,encodedDxf.byteSize),
        ...encodedDxf.chunks.map((chunk,index)=>env.DB.prepare('INSERT INTO export_file_chunks(export_id,kind,chunk_index,data) VALUES(?,?,?,?)').bind(exportId,'dxf',index,chunk)),
        ...encodedProject.chunks.map((chunk,index)=>env.DB.prepare('INSERT INTO export_file_chunks(export_id,kind,chunk_index,data) VALUES(?,?,?,?)').bind(exportId,'project',index,chunk))
      ]);
    }catch(error){
      if(String(error).includes('serula_no_credits'))return json({error:'Nesting hakkınız kalmadı. Admin yeni hak verebilir.'},402);
      await audit(env,'export_save_failed',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:fileName,success:false});
      return json({error:'DXF buluta kaydedilemedi. Hak düşülmedi. Lütfen yeniden deneyin.'},500);
    }
    const fresh=await env.DB.prepare('SELECT u.id,u.email,u.name,u.role,u.nesting_credits,u.unlimited,l.started_at license_started_at,l.expires_at license_expires_at FROM users u LEFT JOIN user_licenses l ON l.user_id=u.id WHERE u.id=?').bind(user.id).first();
    await audit(env,'export_saved',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:fileName});
    return json({ok:true,exportId,user:publicUser(fresh)});
  }
  if(path==='/api/exports'&&request.method==='GET'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Geçmişi görmek için giriş yapmalısınız.'},401);
    const rows=await env.DB.prepare(`SELECT id,project_name,source_file_name,file_name,byte_size,created_at
      FROM export_files WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 200`).bind(user.id).all();
    return json({items:rows.results.map(row=>({id:Number(row.id),projectName:row.project_name||'',sourceFileName:row.source_file_name||'',fileName:row.file_name||'',byteSize:Number(row.byte_size||0),createdAt:row.created_at}))});
  }
  if(path==='/api/history'&&request.method==='DELETE'){
    const user=await sessionUser(request,env);if(!user)return json({error:'Geçmişi silmek için giriş yapmalısınız.'},401);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM export_file_chunks WHERE export_id IN (SELECT id FROM export_files WHERE user_id=?)').bind(user.id),
      env.DB.prepare('DELETE FROM export_files WHERE user_id=?').bind(user.id),
      env.DB.prepare('DELETE FROM cloud_project_chunks WHERE user_id=?').bind(user.id),
      env.DB.prepare('DELETE FROM cloud_projects WHERE user_id=?').bind(user.id)
    ]);
    await audit(env,'history_deleted',{actorType:'user',actorUserId:user.id,targetUserId:user.id,detail:'All cloud autosave and DXF export history'});
    return json({ok:true});
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
  return undefined;
}
