import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {DESIGN_ZONES,cleanZoneStyles,type DesignZone,type ZoneStyle,type ZoneStyles} from './design-zone-styles';
import './DesignStudio.css';
import {DESIGN_COMPONENTS,canReorder} from './design-component-registry';
import {appearanceToPreviewTokens} from './design-appearance-adapter';
import {useAppearance} from '../appearance';

type Design = {background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;heading:string;hidden?:string[];order?:string[];positions?:Record<string,{x:number;y:number}>;workspaceOrder?:string[];zoneStyles?:ZoneStyles};
const initial:Design={background:'#121421',panel:'#242935',accent:'#5278ed',radius:12,spacing:16,fontSize:15,heading:'Serula çalışma alanı'};
type Device='desktop'|'tablet'|'mobile';
const samples=['Başlık','Ana panel','Birincil buton'] as const;
type Layer=typeof samples[number];
const isLayer=(value:string):value is Layer=>samples.some(item=>item===value);
const DRAFT_KEY='serula-design-studio-draft-v1';
function validDraft(value:unknown):value is Design{
  if(!value||typeof value!=='object')return false;
  const d=value as Partial<Design>;
  return ['background','panel','accent'].every(key=>typeof d[key as keyof Design]==='string'&&/^#[0-9a-f]{6}$/i.test(d[key as keyof Design] as string))
    &&typeof d.heading==='string'&&d.heading.length<=80
    &&(d.order===undefined||(Array.isArray(d.order)&&d.order.length===samples.length&&new Set(d.order).size===samples.length&&d.order[d.order.length-1]==='Birincil buton'&&d.order.every((name:unknown)=>typeof name==='string'&&isLayer(name))))
    &&(d.positions===undefined||(typeof d.positions==='object'&&d.positions!==null&&!Array.isArray(d.positions)&&Object.keys(d.positions).every(key=>isLayer(key)&&typeof d.positions?.[key]?.x==='number'&&Number.isInteger(d.positions[key].x)&&d.positions[key].x>=0&&d.positions[key].x<=80&&typeof d.positions[key].y==='number'&&Number.isInteger(d.positions[key].y)&&d.positions[key].y>=0&&d.positions[key].y<=80)))
    &&(d.workspaceOrder===undefined||(Array.isArray(d.workspaceOrder)&&d.workspaceOrder.length===3&&new Set(d.workspaceOrder).size===3&&['parts','canvas','material'].every(item=>d.workspaceOrder!.includes(item))))
    &&(d.zoneStyles===undefined||(typeof d.zoneStyles==='object'&&d.zoneStyles!==null&&!Array.isArray(d.zoneStyles)&&Object.keys(d.zoneStyles).every(key=>DESIGN_ZONES.some(id=>id===key)&&Object.keys(d.zoneStyles?.[key as DesignZone]??{}).every(field=>['background','color','radius','spacing','fontSize','shadow'].includes(field))&&JSON.stringify(cleanZoneStyles({[key]:d.zoneStyles?.[key as DesignZone]}))!=='{}')))
    &&(d.hidden===undefined||(Array.isArray(d.hidden)&&d.hidden.length<=samples.length&&d.hidden.every((name:unknown)=>typeof name==='string'&&isLayer(name))))
    &&([['radius',0,32],['spacing',8,40],['fontSize',12,22]] as const).every(([key,min,max])=>typeof d[key]==='number'&&Number.isFinite(d[key])&&d[key]>=min&&d[key]<=max);
}
function loadDraft():Design{
  try{const raw=localStorage.getItem(DRAFT_KEY);if(!raw)return initial;const data:unknown=JSON.parse(raw);return validDraft(data)?data:initial;}
  catch{return initial;}
}

export default function DesignStudio({onClose}:{onClose:()=>void}){
  const {appearance,loaded:appearanceLoaded}=useAppearance();
  const [history,setHistory]=useState<Design[]>(()=>[loadDraft()]);
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<(typeof samples)[number]>('Ana panel');
  const [device,setDevice]=useState<Device>('desktop');
  const [realPreview,setRealPreview]=useState(true);
  const [selectedZone,setSelectedZone]=useState<DesignZone>('canvas');
  const [selectedDetail,setSelectedDetail]=useState('');
  const [sidebarTab,setSidebarTab]=useState<'layers'|'history'>('layers');
  const [showPublish,setShowPublish]=useState(false);
  const frameRef=useRef<HTMLIFrameElement|null>(null);
  const [locked,setLocked]=useState<Layer[]>([]);
  const [dragging,setDragging]=useState<Layer|null>(null);
  const [placing,setPlacing]=useState<Layer|null>(null);
  const [workspaceDragging,setWorkspaceDragging]=useState<string|null>(null);
  const [saved,setSaved]=useState(false);
  const [storageError,setStorageError]=useState('');
  const [importText,setImportText]=useState('');
  const [importOpen,setImportOpen]=useState(false);
  const [remoteVersions,setRemoteVersions]=useState<{id:number;created_at:string}[]>([]);
  const [serverBusy,setServerBusy]=useState(false);
  const [serverMessage,setServerMessage]=useState('');
  const [publications,setPublications]=useState<{id:number;action:string;source_revision:number|null;created_at:string}[]>([]);
  const [releaseId,setReleaseId]=useState('');
  const [rollbackId,setRollbackId]=useState('');
  const refreshPublications=async()=>{
    const response=await fetch('/api/admin/design/publications',{credentials:'same-origin'});
    if(!response.ok)throw Error('Yayın geçmişi alınamadı.');
    const data=await response.json() as {publications?:typeof publications};
    setPublications(data.publications??[]);
  };
  const changePublication=async(kind:'publish'|'rollback')=>{
    const id=Number(kind==='publish'?releaseId:rollbackId);
    if(!Number.isSafeInteger(id)||id<=0){setServerMessage('Önce geçerli bir sürüm seç.');return;}
    const text=kind==='publish'?'YAYINLA':'GERI AL';
    if(!window.confirm(kind==='publish'?'Bu sürümü yayınlamak istediğinden emin misin?':'Seçilen eski yayına geri dönmek istediğinden emin misin?'))return;
    const confirmation=window.prompt('İşlemi onaylamak için '+text+' yaz:');
    if(confirmation!==text){setServerMessage('Yayın işlemi iptal edildi.');return;}
    setServerBusy(true);setServerMessage('');
    try{
      const response=await fetch('/api/admin/design/'+kind,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(kind==='publish'?{versionId:id,confirmation}:{publicationId:id,confirmation})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error??'Yayın işlemi başarısız.');
      await refreshPublications();
      setServerMessage(kind==='publish'?'Yayın kaydı güncellendi. Bu kod dağıtıldığında yeni görünüm uygulamaya yansır.':'Yayın kaydı eski sürüme döndürüldü.');
    }catch(error){setServerMessage(error instanceof Error?error.message:'Yayın işlemi başarısız.');}
    finally{setServerBusy(false);}
  };
  const refreshVersions=async()=>{
    const response=await fetch('/api/admin/design/versions',{credentials:'same-origin'});
    if(!response.ok)throw Error('Sürümler yüklenemedi.');
    const data=await response.json() as {versions?:{id:number;created_at:string}[]};
    setRemoteVersions(data.versions??[]);
  };
  const loadServerDraft=async()=>{
    setServerBusy(true);setServerMessage('');
    try{
      const response=await fetch('/api/admin/design/draft',{credentials:'same-origin',cache:'no-store'});
      const data=await response.json() as {draft?:{design?:unknown}|null;error?:string};
      if(!response.ok)throw Error(data.error??'Sunucu taslağı okunamadı.');
      if(!data.draft){setServerMessage('Sunucuda henüz kayıtlı taslak yok.');return;}
      if(!validDraft(data.draft.design))throw Error('Sunucu taslağı geçersiz.');
      apply(data.draft.design);
      setServerMessage('Sunucu taslağı önizlemeye yüklendi; canlı görünüm değişmedi.');
    }catch(error){setServerMessage(error instanceof Error?error.message:'Taslak yüklenemedi.');}
    finally{setServerBusy(false);}
  };
  const saveServerDraft=async()=>{
    setServerBusy(true);setServerMessage('');
    try{
      const response=await fetch('/api/admin/design/draft',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({format:'serula-design-v1',design})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error??'Taslak kaydedilemedi.');
      await refreshVersions();
      setServerMessage('Sunucu taslağı kaydedildi; canlıya uygulanmadı.');
    }catch(error){setServerMessage(error instanceof Error?error.message:'Kayıt başarısız.');}
    finally{setServerBusy(false);}
  };
  const restoreServerVersion=async(id:number)=>{
    if(!window.confirm('Seçili sürüm yeni taslak olarak geri yüklensin mi?'))return;
    setServerBusy(true);setServerMessage('');
    try{
      const response=await fetch('/api/admin/design/restore',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({versionId:id})});
      const data=await response.json() as {draft?:{design?:unknown};error?:string};
      if(!response.ok||!validDraft(data.draft?.design))throw Error(data.error??'Geri yükleme başarısız.');
      apply(data.draft.design);
      await refreshVersions();setServerMessage('Sürüm taslağa geri yüklendi. Canlı site değişmedi.');
    }catch(error){setServerMessage(error instanceof Error?error.message:'Geri yükleme başarısız.');}
    finally{setServerBusy(false);}
  };
  useEffect(()=>{void refreshVersions().catch(()=>{});void refreshPublications().catch(()=>{});},[]);
  const exportJson=()=>{
    const payload=JSON.stringify({format:'serula-design-v1',design},null,2);
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;anchor.download='serula-design-draft.json';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importJson=()=>{
    try{
      if(importText.length>10000)throw Error('Dosya çok büyük.');
      const value:unknown=JSON.parse(importText);
      if(!value||typeof value!=='object'||(value as {format?:unknown}).format!=='serula-design-v1')throw Error('Tanınmayan tasarım biçimi.');
      const candidate=(value as {design?:unknown}).design;
      if(!validDraft(candidate))throw Error('Tasarım alanları geçersiz.');
      apply(candidate);
      setImportOpen(false);setImportText('');setStorageError('');
    }catch(e){setStorageError(e instanceof Error?e.message:'Tasarım içe aktarılamadı.');}
  };
  const saveDraft=()=>{
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(design));setSaved(true);setStorageError('');}
    catch{setSaved(false);setStorageError('Tarayıcı taslağı kaydedemedi.');}
  };
  const design=history[index];
  useEffect(()=>{
    if(!realPreview)return;
    try{localStorage.setItem('serula-design-studio-live-preview-v1',JSON.stringify(design));}
    catch{setStorageError('Gerçek ekran önizlemesi için tarayıcı depolaması kullanılamadı.');}
  },[design,realPreview]);
  const stateRef=useRef({history,index});
  stateRef.current={history,index};
  const apply=(patch:Partial<Design>)=>{
    const state=stateRef.current;
    const next={...state.history[state.index],...patch};
    if(JSON.stringify(next)===JSON.stringify(state.history[state.index]))return;
    const updated=[...state.history.slice(0,state.index+1),next].slice(-80);
    stateRef.current={history:updated,index:updated.length-1};
    setHistory(updated);setIndex(updated.length-1);setSaved(false);
  };
  const layerOrder=(design.order??[...samples]) as Layer[];
  const workspaceOrder=design.workspaceOrder??['parts','canvas','material'];
  const reorderWorkspace=(source:string,target:string)=>{
    if(source===target||!workspaceOrder.includes(source)||!workspaceOrder.includes(target))return;
    const from=workspaceOrder.indexOf(source),to=workspaceOrder.indexOf(target);
    const next=workspaceOrder.filter(item=>item!==source);
    next.splice(next.indexOf(target)+(from<to?1:0),0,source);
    apply({workspaceOrder:next});
  };
  const shiftWorkspace=(source:string,direction:number)=>{
    const target=workspaceOrder[workspaceOrder.indexOf(source)+direction];
    if(target)reorderWorkspace(source,target);
  };
  const setPosition=(layer:Layer,x:number,y:number)=>apply({positions:{...design.positions,[layer]:{x:Math.max(0,Math.min(80,Math.round(x))),y:Math.max(0,Math.min(80,Math.round(y)))}}});
  const dropPosition=(event:import('react').DragEvent<HTMLDivElement>)=>{
    event.preventDefault();
    if(!placing)return;
    const rect=event.currentTarget.getBoundingClientRect();
    if(rect.width&&rect.height)setPosition(placing,(event.clientX-rect.left)/rect.width*80,(event.clientY-rect.top)/rect.height*80);
    setPlacing(null);
  };
  const moveLayer=(source:Layer,target:Layer)=>{
    if(!canReorder(source==='Başlık'?'heading':source==='Ana panel'?'panel':'button',target==='Başlık'?'heading':target==='Ana panel'?'panel':'button')||locked.includes(source))return;
    const sourceIndex=layerOrder.indexOf(source),targetIndex=layerOrder.indexOf(target);
    const reordered=layerOrder.filter(item=>item!==source);
    reordered.splice(reordered.indexOf(target)+(sourceIndex<targetIndex?1:0),0,source);
    apply({order:reordered});
  };
  const shiftLayer=(layer:Layer,delta:number)=>{
    const target=layerOrder[layerOrder.indexOf(layer)+delta];
    if(target&&layer!=='Birincil buton'&&target!=='Birincil buton')moveLayer(layer,target);
  };
  const toggleVisibility=(layer:Layer)=>apply({hidden:design.hidden?.includes(layer)?(design.hidden??[]).filter(name=>name!==layer):[...(design.hidden??[]),layer]});
  const toggleLock=(layer:Layer)=>setLocked(current=>current.includes(layer)?current.filter(name=>name!==layer):[...current,layer]);
  const undo=()=>{setSaved(false);setIndex(v=>Math.max(0,v-1));};
  const redo=()=>{setSaved(false);setIndex(v=>Math.min(history.length-1,v+1));};
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||!['z','y'].includes(event.key.toLowerCase()))return;
      if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,[contenteditable="true"]'))return;
      event.preventDefault();
      if(event.key.toLowerCase()==='y'||event.shiftKey)redo();else undo();
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[history.length]);
  const zoneStyle=design.zoneStyles?.[selectedZone]??{};
  const changeZoneStyle=(key:keyof ZoneStyle,value:string|number)=>{
    apply({zoneStyles:{...design.zoneStyles,[selectedZone]:{...zoneStyle,[key]:value}}});
  };
  const resetZone=()=>{
    const copy={...design.zoneStyles};delete copy[selectedZone];
    apply({zoneStyles:copy});
  };
  const selectZone=(zone:DesignZone,detail='')=>{
    setSelectedZone(zone);setSelectedDetail(detail);
    try{
      const doc=frameRef.current?.contentDocument;
      doc?.querySelectorAll('[data-design-zone]').forEach(node=>(node as HTMLElement).style.removeProperty('outline'));
      doc?.querySelector('[data-design-zone="'+zone+'"]')?.setAttribute('data-design-active','true');
      if(doc){
        doc.querySelectorAll('[data-design-active]').forEach(node=>{if(node.getAttribute('data-design-zone')!==zone)node.removeAttribute('data-design-active');});
        (doc.querySelector('[data-design-zone="'+zone+'"]') as HTMLElement|null)?.style.setProperty('outline','3px solid #5b7cfa','important');
      }
    }catch{/* Ignore missing preview frame. */}
  };
  const selectAtPoint=(event:MouseEvent<HTMLDivElement>)=>{
    const iframe=frameRef.current;if(!iframe)return;
    try{
      const doc=iframe.contentDocument;if(!doc)return;
      const bounds=iframe.getBoundingClientRect();
      const hit=doc.elementFromPoint(event.clientX-bounds.left,event.clientY-bounds.top);
      const root=hit?.closest('[data-design-zone]');
      const id=root?.getAttribute('data-design-zone');
      if(id&&DESIGN_ZONES.some(zone=>zone===id)){
        const detail=hit instanceof HTMLElement&&hit.closest('button')?(hit.closest('button')?.textContent??'').trim().slice(0,50):'';
        selectZone(id as DesignZone,detail);
      }
    }catch{setStorageError('Önizleme alanı seçilemedi.');}
  };
  const zoneNames:Record<DesignZone,string>={header:'Üst menü',parts:'Parça paneli',canvas:'Çalışma alanı',material:'Malzeme ve ayarlar',actions:'Alt işlem çubuğu'};
  const shownZoneOrder:DesignZone[]=['header',...(workspaceOrder as DesignZone[]),'actions'];
  const reset=()=>{
    if(window.confirm('Yalnızca bu editördeki yayınlanmamış denemeler sıfırlansın mı?')){
      setHistory([initial]);setIndex(0);setSaved(false);
      try{localStorage.removeItem(DRAFT_KEY);setStorageError('');}catch{setStorageError('Tarayıcıdaki kayıt silinemedi.');}
    }
  };
  return <section className="design-studio design-editor-v2" aria-label="Serula görsel tasarım editörü">
    <header className="editor-topbar">
      <div className="editor-brand"><div className="editor-brand-mark">S</div><div><strong>Görsel Düzenleyici</strong><small>Serula Nesting / Tasarım alanı</small></div><span className="editor-draft-label">TASLAK</span></div>
      <div className="editor-toolbar-actions">
        <button type="button" onClick={undo} disabled={index===0} title="Geri al (Ctrl+Z)" aria-label="Geri al"><span aria-hidden="true">↶</span> Geri al</button>
        <button type="button" onClick={redo} disabled={index===history.length-1} title="Yinele (Ctrl+Y)" aria-label="Yinele">↷</button>
        <span className="editor-toolbar-divider"/>
        <button type="button" onClick={saveDraft}>Taslağı kaydet</button>
        <button type="button" disabled={serverBusy} onClick={()=>void saveServerDraft()}>Sunucuya kaydet</button>
        <button type="button" className="editor-publish-button" onClick={()=>setShowPublish(v=>!v)} aria-expanded={showPublish}>Yayınla <span aria-hidden="true">▾</span></button>
        <button type="button" onClick={onClose} title="Yönetim ekranına dön">Kapat ×</button>
      </div>
    </header>
    {showPublish&&<section className="editor-publish-panel" aria-label="Yayınla ve geri al">
      <div><strong>Yayın ve geri dönüş</strong><p>Taslağı önce sunucuya kaydet. Yayınlama ayrı bir onay gerektirir. Nesting işlemleri değişmez.</p></div>
      <label>Yayınlanacak sürüm<select value={releaseId} onChange={e=>setReleaseId(e.target.value)}><option value="">Sürüm seç</option>{remoteVersions.map(v=><option key={v.id} value={v.id}>#{v.id} · {v.created_at}</option>)}</select></label>
      <button type="button" disabled={serverBusy||!releaseId} onClick={()=>void changePublication('publish')}>Onayla ve yayınla</button>
      <label>Geri dönülecek yayın<select value={rollbackId} onChange={e=>setRollbackId(e.target.value)}><option value="">Yayın seç</option>{publications.map(v=><option key={v.id} value={v.id}>#{v.id} · {v.created_at}</option>)}</select></label>
      <button type="button" disabled={serverBusy||!rollbackId} onClick={()=>void changePublication('rollback')}>Önceki yayına dön</button>
    </section>}
    {(storageError||serverMessage||saved)&&<div className="editor-notice" role="status">{storageError||serverMessage||(saved?'Tarayıcı taslağı kaydedildi.':'')}</div>}
    <div className="editor-main">
      <aside className="editor-sidebar" aria-label="Sayfalar ve katmanlar">
        <div className="editor-sidebar-tabs" role="group" aria-label="Sol panel görünümü">
          <button type="button" aria-pressed={sidebarTab==='layers'} onClick={()=>setSidebarTab('layers')}>Katmanlar</button>
          <button type="button" aria-pressed={sidebarTab==='history'} onClick={()=>setSidebarTab('history')}>Geçmiş</button>
        </div>
        {sidebarTab==='layers'?<div className="editor-layer-area">
          <div className="editor-section-label">SAYFALAR</div>
          <div className="editor-page-selected"><span aria-hidden="true">▣</span><strong>Nesting Studio</strong><small>Canlı ekran</small></div>
          <div className="editor-section-label editor-layer-title">BİLEŞEN AĞACI <span>{shownZoneOrder.length}</span></div>
          <p className="editor-layer-help">Bir katmana tıkla veya ekrandan seç. Orta üç paneli sürükleyerek sırala.</p>
          <div className="editor-layer-tree">
            {shownZoneOrder.map((id,index)=><div key={id} className={'editor-layer'+(selectedZone===id?' is-selected':'')} draggable={['parts','canvas','material'].includes(id)}
              onDragStart={event=>{if(!['parts','canvas','material'].includes(id)){event.preventDefault();return;}setWorkspaceDragging(id);event.dataTransfer.setData('text/plain',id);}}
              onDragOver={event=>{if(workspaceDragging&&['parts','canvas','material'].includes(id))event.preventDefault();}}
              onDrop={event=>{event.preventDefault();if(workspaceDragging&&['parts','canvas','material'].includes(id))reorderWorkspace(workspaceDragging,id);setWorkspaceDragging(null);}}
              onDragEnd={()=>setWorkspaceDragging(null)}>
              <button type="button" className="editor-layer-select" onClick={()=>selectZone(id)} aria-pressed={selectedZone===id}><span className="editor-layer-icon">{id==='canvas'?'▧':id==='header'?'☰':id==='actions'?'▱':'▤'}</span>{zoneNames[id]}</button>
              {['parts','canvas','material'].includes(id)&&<div className="editor-layer-order">
                <button type="button" aria-label={zoneNames[id]+' sola taşı'} disabled={workspaceOrder.indexOf(id)===0} onClick={()=>shiftWorkspace(id,-1)}>‹</button>
                <button type="button" aria-label={zoneNames[id]+' sağa taşı'} disabled={workspaceOrder.indexOf(id)===2} onClick={()=>shiftWorkspace(id,1)}>›</button>
              </div>}
            </div>)}
          </div>
          <div className="editor-layer-bottom"><button type="button" onClick={()=>apply({workspaceOrder:['parts','canvas','material']})}>↺ Panel sırasını sıfırla</button></div>
        </div>:<div className="editor-history">
          <div className="editor-section-label">SUNUCU SÜRÜMLERİ</div>
          <button type="button" disabled={serverBusy} onClick={()=>void refreshVersions().catch(()=>setServerMessage('Sürüm geçmişi alınamadı.'))}>Sürümleri yenile ↻</button>
          {remoteVersions.length===0?<p>Henüz kayıtlı sürüm yok.</p>:remoteVersions.map(v=><div className="editor-history-entry" key={v.id}><div><strong>#{v.id}</strong><small>{v.created_at}</small></div><button type="button" disabled={serverBusy} onClick={()=>void restoreServerVersion(v.id)}>Taslağa al</button></div>)}
          <div className="editor-section-label">DOSYA İŞLEMLERİ</div>
          <button type="button" onClick={exportJson}>JSON dışa aktar</button><button type="button" onClick={()=>setImportOpen(v=>!v)}>JSON içe aktar</button>
          <button type="button" onClick={reset}>Kaydedilmemiş taslağı sıfırla</button>
        </div>}
      </aside>
      <main className="editor-stage-area">
        <div className="editor-stage-toolbar">
          <div className="editor-crumb"><span>Nesting Studio</span><span aria-hidden="true">›</span><strong>{zoneNames[selectedZone]}</strong></div>
          <div className="editor-viewport-controls" role="group" aria-label="Ekran boyutu">
            {(['desktop','tablet','mobile'] as const).map(item=><button type="button" key={item} aria-pressed={device===item} onClick={()=>setDevice(item)}>{({desktop:'▭ Masaüstü',tablet:'▯ Tablet',mobile:'▮ Mobil'} as const)[item]}</button>)}
          </div>
          <div className="editor-stage-percent">{device==='desktop'?'100%':device==='tablet'?'768 px':'390 px'}</div>
        </div>
        <div className="editor-stage-scroller">
          <div className={'editor-live-surface editor-live-'+device}>
            <div className="editor-frame-top"><span/><span/><span/><span className="editor-frame-url">serula.site / studio</span></div>
            <div className="editor-iframe-wrap">
              <iframe ref={frameRef} title="Gerçek Serula Nesting ekranı" src={import.meta.env.BASE_URL+'?design-preview=1'} tabIndex={-1} loading="eager"/>
              <div className="editor-click-shield" role="button" tabIndex={0} aria-label="Önizlemeden bir öğe seç" onClick={selectAtPoint} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectZone('canvas');}}}/>
            </div>
          </div>
        </div>
        <div className="editor-stage-footer"><span><span className="editor-live-dot"/> Gerçek Serula ekranı · Güvenli seçim modu</span><span>Ekrana tıkla → sağdan düzenle. Canlı site değişmez.</span></div>
      </main>
      <aside className="editor-inspector" aria-label="Seçili öğe özellikleri">
        <div className="editor-inspector-head"><small>ÖZELLİKLER</small><strong>{zoneNames[selectedZone]}</strong><span>{selectedDetail?'Seçilen kontrol: '+selectedDetail:'Gerçek uygulama bileşeni'}</span></div>
        <div className="editor-inspector-scroll">
          <div className="editor-property-group"><div className="editor-property-title">Görünüm <span>◫</span></div>
            <label className="editor-color-field"><span>Arka plan rengi</span><span className="editor-color-control"><input aria-label="Seçili öğe arka plan rengi" type="color" value={zoneStyle.background??design.panel} onChange={e=>changeZoneStyle('background',e.target.value)}/><code>{zoneStyle.background??design.panel}</code></span></label>
            <label className="editor-color-field"><span>Yazı rengi</span><span className="editor-color-control"><input aria-label="Seçili öğe yazı rengi" type="color" value={zoneStyle.color??'#222a36'} onChange={e=>changeZoneStyle('color',e.target.value)}/><code>{zoneStyle.color??'#222a36'}</code></span></label>
          </div>
          <div className="editor-property-group"><div className="editor-property-title">Boyut ve boşluk <span>▦</span></div>
            <label className="editor-slider-label"><span>İç boşluk</span><output>{zoneStyle.spacing??design.spacing} px</output><input aria-label="Seçili öğe iç boşluk" type="range" min="0" max="48" value={zoneStyle.spacing??design.spacing} onChange={e=>changeZoneStyle('spacing',Number(e.target.value))}/></label>
            <label className="editor-slider-label"><span>Köşe yuvarlaklığı</span><output>{zoneStyle.radius??design.radius} px</output><input aria-label="Seçili öğe köşe yarıçapı" type="range" min="0" max="32" value={zoneStyle.radius??design.radius} onChange={e=>changeZoneStyle('radius',Number(e.target.value))}/></label>
          </div>
          <div className="editor-property-group"><div className="editor-property-title">Tipografi <span>𝘼</span></div>
            <label className="editor-slider-label"><span>Yazı boyutu</span><output>{zoneStyle.fontSize??design.fontSize} px</output><input aria-label="Seçili öğe yazı boyutu" type="range" min="11" max="24" value={zoneStyle.fontSize??design.fontSize} onChange={e=>changeZoneStyle('fontSize',Number(e.target.value))}/></label>
          </div>
          <div className="editor-property-group"><div className="editor-property-title">Efektler <span>◈</span></div>
            <label className="editor-slider-label"><span>Gölge yoğunluğu</span><output>{zoneStyle.shadow??0}</output><input aria-label="Seçili öğe gölge" type="range" min="0" max="32" value={zoneStyle.shadow??0} onChange={e=>changeZoneStyle('shadow',Number(e.target.value))}/></label>
          </div>
          <div className="editor-property-group"><div className="editor-property-title">Genel tema</div>
            <label className="editor-color-field"><span>Sayfa arka planı</span><span className="editor-color-control"><input type="color" aria-label="Sayfa arka planı" value={design.background} onChange={e=>apply({background:e.target.value})}/><code>{design.background}</code></span></label>
            <label className="editor-color-field"><span>Vurgu rengi</span><span className="editor-color-control"><input type="color" aria-label="Vurgu rengi" value={design.accent} onChange={e=>apply({accent:e.target.value})}/><code>{design.accent}</code></span></label>
          </div>
          <button type="button" className="editor-reset-props" onClick={resetZone}>↺ Seçili bileşenin ayarlarını sıfırla</button>
        </div>
        <div className="editor-inspector-footer"><button type="button" disabled={!appearanceLoaded} onClick={()=>apply(appearanceToPreviewTokens(appearance))}>Serula renklerini içe al</button></div>
      </aside>
    </div>
    {importOpen&&<div className="editor-import-overlay"><div className="editor-import-dialog" role="dialog" aria-modal="true" aria-label="Tasarım JSON içe aktar"><h3>JSON içe aktar</h3><p>Yalnızca doğrulanmış Serula tasarım dosyaları kabul edilir.</p><textarea aria-label="Tasarım JSON içeriği" rows={7} maxLength={10000} value={importText} onChange={e=>setImportText(e.target.value)}/><div><button type="button" onClick={()=>setImportOpen(false)}>Vazgeç</button><button type="button" onClick={importJson}>Doğrula ve taslağa uygula</button></div></div></div>}
  </section>;
}
