import {describe,it,expect} from 'vitest';
import worker from './serula-worker.js';

class MemoryD1{
  settings=new Map();revisions=[];publications=[];audit=[];
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){const results=[];for(const stmt of statements)results.push(await stmt.run());return results;}
}
class Statement{
  values=[];
  constructor(db,sql){this.db=db;this.sql=sql;}
  bind(...values){this.values=values;return this;}
  async first(){
    const s=this.sql,db=this.db;
    if(s.includes('SELECT token_hash FROM admin_sessions'))return {token_hash:'test-session'};
    if(s.includes('SELECT value_json FROM system_settings')){
      const key=s.includes('design_published_v1')?'design_published_v1':'design_draft_v1';
      return db.settings.has(key)?{value_json:db.settings.get(key)}:null;
    }
    if(s.includes('SELECT document_json FROM design_revision_store'))return db.revisions.find(x=>x.id===this.values[0])??null;
    if(s.includes('SELECT document_json FROM design_publication_log'))return db.publications.find(x=>x.id===this.values[0])??null;
    return null;
  }
  async all(){
    if(this.sql.includes('FROM design_revision_store'))return {results:dbSort(this.db.revisions).map(({id,created_at})=>({id,created_at}))};
    if(this.sql.includes('FROM design_publication_log'))return {results:dbSort(this.db.publications).map(({id,created_at,action,source_revision})=>({id,created_at,action,source_revision}))};
    return {results:[]};
  }
  async run(){
    const s=this.sql,db=this.db;
    if(s.startsWith('INSERT INTO design_revision_store')){
      db.revisions.push({id:db.revisions.length+1,document_json:this.values[0],created_at:'2026-11-02'});
    }else if(s.startsWith('INSERT INTO design_publication_log')){
      const action=s.includes("'before_publish'")?'before_publish':s.includes("'rollback'")?'rollback':'publish';
      db.publications.push({id:db.publications.length+1,document_json:this.values[0],source_revision:action==='publish'?this.values[1]:null,action,created_at:'2026-11-02'});
    }else if(s.startsWith('INSERT INTO system_settings')){
      const key=s.includes('design_published_v1')?'design_published_v1':'design_draft_v1';
      db.settings.set(key,this.values[0]);
    }else if(s.startsWith('DELETE FROM system_settings')&&s.includes('design_published_v1')){
      db.settings.delete('design_published_v1');
    }else if(s.startsWith('INSERT INTO audit_logs')){
      db.audit.push(this.values);
    }
    return {success:true,meta:{changes:1}};
  }
}
function dbSort(items){return [...items].reverse().slice(0,30);}
const design={background:'#121421',panel:'#242935',accent:'#5278ed',radius:12,spacing:16,fontSize:15,heading:'Test',positions:{'Ana panel':{x:25,y:30}}};
const payload=(d=design)=>({format:'serula-design-v1',design:d});
async function request(db,path,{method='GET',body,admin=true,origin=true}={}){
  const url='https://studio.example'+path;
  const headers={};
  if(admin)headers.cookie='serula_admin_session=test-session';
  if(origin)headers.origin='https://studio.example';
  const response=await worker.fetch(new Request(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB:db});
  return {status:response.status,data:await response.json()};
}
describe('design worker route integration with isolated D1 emulator',()=>{
  it('requires an admin session and same origin for mutations',async()=>{
    const db=new MemoryD1();
    expect((await request(db,'/api/admin/design/versions',{admin:false})).status).toBe(403);
    expect((await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:1,confirmation:'YAYINLA'},admin:false})).status).toBe(403);
    const foreign=new Request('https://studio.example/api/admin/design/draft',{method:'POST',headers:{origin:'https://evil.example',cookie:'serula_admin_session=test-session'},body:JSON.stringify(payload())});
    expect((await worker.fetch(foreign,{DB:db})).status).toBe(403);
    expect(db.revisions).toHaveLength(0);
  });
  it('validates drafts, publishes a selected revision and rolls back to baseline',async()=>{
    const db=new MemoryD1();
    expect((await request(db,'/api/design/published',{admin:false})).data.published).toBe(null);
    expect((await request(db,'/api/admin/design/draft',{method:'POST',body:payload({...design,background:'url(bad)'})})).status).toBe(400);
    expect((await request(db,'/api/admin/design/draft',{method:'POST',body:payload()})).status).toBe(200);
    expect((await request(db,'/api/admin/design/versions')).data.versions).toHaveLength(1);
    expect((await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:1,confirmation:'wrong'}})).status).toBe(400);
    expect((await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:1,confirmation:'YAYINLA'}})).status).toBe(200);
    expect((await request(db,'/api/design/published',{admin:false})).data.published.design).toEqual(design);
    const history=(await request(db,'/api/admin/design/publications')).data.publications;
    const baseline=history.find(x=>x.action==='before_publish');
    expect(baseline).toBeTruthy();
    expect((await request(db,'/api/admin/design/rollback',{method:'POST',body:{publicationId:baseline.id,confirmation:'GERI AL'}})).status).toBe(200);
    expect((await request(db,'/api/design/published',{admin:false})).data.published).toBe(null);
  });
  it('publishes and rolls back an entire component-rich layout without changing earlier revisions',async()=>{
    const db=new MemoryD1();
    const layout={...design,blocks:[
      {id:'widget-heading0123',kind:'heading',region:'canvas',text:'Üretim duyurusu',fontSize:24,x:65,y:-20,devices:['desktop','mobile']},
      {id:'widget-button0123',kind:'button',region:'material',text:'İletişim',href:'/contact',borderColor:'#123456',borderWidth:2,animation:'fade'}
    ],zoneStyles:{header:{background:'#224466'},projectBar:{offsetX:45}}};
    const saved=await request(db,'/api/admin/design/draft',{method:'POST',body:payload(layout)});
    expect(saved.status).toBe(200);
    expect(saved.data.draft.design.blocks).toHaveLength(2);
    const denied=await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:1,confirmation:'YAYINLA'},admin:false});
    expect(denied.status).toBe(403);
    expect((await request(db,'/api/design/published',{admin:false})).data.published).toBe(null);
    const published=await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:1,confirmation:'YAYINLA'}});
    expect(published.status).toBe(200);
    const live=(await request(db,'/api/design/published',{admin:false})).data.published;
    expect(live.design.blocks).toEqual(layout.blocks);
    expect(live.design.zoneStyles).toEqual(layout.zoneStyles);
    const base=(await request(db,'/api/admin/design/publications')).data.publications.find(row=>row.action==='before_publish');
    expect(base?.id).toBeGreaterThan(0);
    expect((await request(db,'/api/admin/design/rollback',{method:'POST',body:{publicationId:base.id,confirmation:'incorrect'}})).status).toBe(400);
    expect((await request(db,'/api/design/published',{admin:false})).data.published.design.blocks).toHaveLength(2);
    expect((await request(db,'/api/admin/design/rollback',{method:'POST',body:{publicationId:base.id,confirmation:'GERI AL'}})).status).toBe(200);
    expect((await request(db,'/api/design/published',{admin:false})).data.published).toBe(null);
    expect(db.revisions).toHaveLength(1);
    expect(db.revisions[0].document_json).toBe(JSON.stringify(saved.data.draft));
  });
  it('restores an earlier published version and retains immutable history',async()=>{
    const db=new MemoryD1(),updated={...design,background:'#778899'};
    await request(db,'/api/admin/design/draft',{method:'POST',body:payload()});
    await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:1,confirmation:'YAYINLA'}});
    await request(db,'/api/admin/design/draft',{method:'POST',body:payload(updated)});
    await request(db,'/api/admin/design/publish',{method:'POST',body:{versionId:2,confirmation:'YAYINLA'}});
    expect((await request(db,'/api/design/published')).data.published.design.background).toBe('#778899');
    const first=db.publications.find(x=>x.action==='publish'&&x.source_revision===1);
    expect((await request(db,'/api/admin/design/rollback',{method:'POST',body:{publicationId:first.id,confirmation:'GERI AL'}})).status).toBe(200);
    expect((await request(db,'/api/design/published')).data.published.design.background).toBe('#121421');
    expect(db.revisions).toHaveLength(2);
    expect(db.publications.at(-1).action).toBe('rollback');
  });
});
