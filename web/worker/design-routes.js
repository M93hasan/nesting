/** Admin design drafts and public design publishing; original SQL and confirmations kept. */
export async function handleDesignRoutes(request,env,path,{
  json,parseDesignPayload,adminSessionValid,body,audit,
}) {
  if(path==='/api/design/published'&&request.method==='GET'){
    const row=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='design_published_v1'").first();
    let published=null;
    try{if(row)published=parseDesignPayload(JSON.parse(row.value_json));}catch{}
    return json({published});
  }
  // Design drafts and immutable revisions are isolated from the live appearance setting.
  if(path.startsWith('/api/admin/design/')){
    if(!await adminSessionValid(request,env))return json({error:'Yetkisiz.'},403);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_revision_store (id INTEGER PRIMARY KEY AUTOINCREMENT, document_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    const setting=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='design_draft_v1'").first();
    const current=setting?JSON.parse(setting.value_json):null;
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS design_publication_log (id INTEGER PRIMARY KEY AUTOINCREMENT, document_json TEXT, action TEXT NOT NULL, source_revision INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    if(path==='/api/admin/design/publications'&&request.method==='GET'){
      const rows=await env.DB.prepare('SELECT id,action,source_revision,created_at FROM design_publication_log ORDER BY id DESC LIMIT 30').all();
      return json({publications:rows.results??[]});
    }
    if(path==='/api/admin/design/publish'&&request.method==='POST'){
      const data=await body(request);
      if(data?.confirmation!=='YAYINLA'||!Number.isSafeInteger(data?.versionId)||data.versionId<=0)return json({error:'Sürüm ve yayın onayı gerekli.'},400);
      const row=await env.DB.prepare('SELECT document_json FROM design_revision_store WHERE id=?').bind(data.versionId).first();
      if(!row)return json({error:'Sürüm bulunamadı.'},404);
      let document;try{document=parseDesignPayload(JSON.parse(row.document_json));}catch{return json({error:'Sürüm geçersiz.'},400);}
      const encoded=JSON.stringify(document);
      // Preserve the prior published state (including the default/no-design state) before switching.
      const previous=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='design_published_v1'").first();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO design_publication_log(document_json,action) VALUES(?,'before_publish')").bind(previous?.value_json??null),
        env.DB.prepare("INSERT INTO design_publication_log(document_json,action,source_revision) VALUES(?,'publish',?)").bind(encoded,data.versionId),
        env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_published_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(encoded)
      ]);
      await audit(env,'design_published',{actorType:'admin',detail:String(data.versionId)});
      return json({published:document});
    }
    if(path==='/api/admin/design/rollback'&&request.method==='POST'){
      const data=await body(request);
      if(data?.confirmation!=='GERI AL'||!Number.isSafeInteger(data?.publicationId)||data.publicationId<=0)return json({error:'Geri alma onayı gerekli.'},400);
      const row=await env.DB.prepare('SELECT document_json FROM design_publication_log WHERE id=?').bind(data.publicationId).first();
      if(!row)return json({error:'Yayın bulunamadı.'},404);
      let document=null;
      try{if(row.document_json)document=parseDesignPayload(JSON.parse(row.document_json));}catch{return json({error:'Kayıtlı yayın geçersiz.'},400);}
      await env.DB.batch([
        env.DB.prepare("INSERT INTO design_publication_log(document_json,action) VALUES(?,'rollback')").bind(document?JSON.stringify(document):null),
        document?env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_published_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(document)):env.DB.prepare("DELETE FROM system_settings WHERE key='design_published_v1'")
      ]);
      await audit(env,'design_rolled_back',{actorType:'admin',detail:String(data.publicationId)});
      return json({published:document});
    }
    if(path==='/api/admin/design/draft'&&request.method==='GET')return json({draft:current});
    if(path==='/api/admin/design/versions'&&request.method==='GET'){
      const rows=await env.DB.prepare('SELECT id,created_at FROM design_revision_store ORDER BY id DESC LIMIT 30').all();
      return json({versions:rows.results??[]});
    }
    const versionPath=path.startsWith('/api/admin/design/versions/')?path.slice('/api/admin/design/versions/'.length):'';
    const match=/^[0-9]+$/.test(versionPath)?[path,versionPath]:null;
    if(match&&request.method==='GET'){
      const row=await env.DB.prepare('SELECT document_json FROM design_revision_store WHERE id=?').bind(Number(match[1])).first();
      return row?json({document:JSON.parse(row.document_json)}):json({error:'Sürüm bulunamadı.'},404);
    }
    if(path==='/api/admin/design/draft'&&request.method==='POST'){
      const raw=await request.text();
      if(raw.length>70000)return json({error:'Tasarım fazla büyük.'},413);
      let document;try{document=parseDesignPayload(JSON.parse(raw));}catch(error){return json({error:error.message},400);}
      const encoded=JSON.stringify(document);
      await env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_draft_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(encoded).run();
      const revision=await env.DB.prepare('INSERT INTO design_revision_store(document_json) VALUES(?)').bind(encoded).run();
      const revisionId=revision?.meta?.last_row_id;
      await audit(env,'design_draft_saved',{actorType:'admin',detail:'Draft revision recorded'});
      return json({draft:document,revisionId:Number.isSafeInteger(revisionId)&&revisionId>0?revisionId:null});
    }
    if(path==='/api/admin/design/restore'&&request.method==='POST'){
      const data=await body(request),id=data?.versionId;
      if(!Number.isSafeInteger(id)||id<=0)return json({error:'Geçersiz sürüm.'},400);
      const row=await env.DB.prepare('SELECT document_json FROM design_revision_store WHERE id=?').bind(id).first();
      if(!row)return json({error:'Sürüm bulunamadı.'},404);
      let document;try{document=parseDesignPayload(JSON.parse(row.document_json));}catch{return json({error:'Sürüm geçersiz.'},400);}
      const encoded=JSON.stringify(document);
      await env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('design_draft_v1',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(encoded).run();
      await env.DB.prepare('INSERT INTO design_revision_store(document_json) VALUES(?)').bind(encoded).run();
      await audit(env,'design_draft_restored',{actorType:'admin',detail:String(id)});
      return json({draft:document});
    }
    return json({error:'İşlem desteklenmiyor.'},405);
  }
  return undefined;
}
