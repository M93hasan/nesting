import {useEffect,useRef,useState} from 'react';
import './DesignStudio.css';
import {DESIGN_COMPONENTS,canReorder} from './design-component-registry';
import {appearanceToPreviewTokens} from './design-appearance-adapter';
import {useAppearance} from '../appearance';

type Design = {background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;heading:string;hidden?:string[];order?:string[];positions?:Record<string,{x:number;y:number}>};
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
  const [realPreview,setRealPreview]=useState(false);
  const [locked,setLocked]=useState<Layer[]>([]);
  const [dragging,setDragging]=useState<Layer|null>(null);
  const [placing,setPlacing]=useState<Layer|null>(null);
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
  const reset=()=>{
    if(window.confirm('Yalnızca bu editördeki yayınlanmamış denemeler sıfırlansın mı?')){
      setHistory([initial]);setIndex(0);setSaved(false);
      try{localStorage.removeItem(DRAFT_KEY);setStorageError('');}catch{setStorageError('Tarayıcıdaki kayıt silinemedi.');}
    }
  };
  return <section className="design-studio" aria-label="Tasarım editörü">
    <header className="design-studio-toolbar">
      <div><strong>Serula Design Studio</strong><small>Yerel tasarım denemesi · Canlı site etkilenmez</small></div>
      <div className="design-studio-actions">
        <button type="button" onClick={undo} disabled={index===0} aria-label="Geri al">↶ Ctrl+Z</button>
        <button type="button" onClick={redo} disabled={index===history.length-1} aria-label="Yinele">↷</button>
        <button type="button" disabled={!appearanceLoaded} onClick={()=>apply(appearanceToPreviewTokens(appearance))}>Mevcut Serula renklerini al</button>
        <button type="button" onClick={saveDraft}>Taslağı tarayıcıya kaydet</button>
        <button type="button" disabled={serverBusy} onClick={()=>void saveServerDraft()}>Sunucuya taslak kaydet</button>
        <button type="button" disabled={serverBusy} onClick={()=>void loadServerDraft()}>Sunucu taslağını aç</button>
        <button type="button" onClick={exportJson}>JSON dışa aktar</button>
        <button type="button" onClick={()=>setImportOpen(v=>!v)}>JSON içe aktar</button>
        <button type="button" onClick={reset}>Taslağı sıfırla</button>
        <button type="button" onClick={onClose}>Görünüme dön</button>
      </div>
    </header>
    <p className="design-studio-warning" role="status">Bu prototip mevcut Serula renklerini salt okunur biçimde içe alabilir; yalnızca örnek bileşenleri düzenler. Taslağı bu tarayıcıya kaydedebilirsin; başka cihazlara aktarılmaz ve canlı siteye yayınlanmaz. {saved?'Taslak tarayıcıya kaydedildi.':''}{storageError}</p>
    {serverMessage&&<p role="status" className="design-studio-warning">{serverMessage}</p>}
    <details className="design-studio-import"><summary>Sunucu sürüm geçmişi ({remoteVersions.length})</summary>
      <button type="button" disabled={serverBusy} onClick={()=>void refreshVersions().catch(()=>setServerMessage('Sürümler yüklenemedi.'))}>Yenile</button>
      {remoteVersions.map(version=><div key={version.id}><span>#{version.id} · {version.created_at}</span><button type="button" disabled={serverBusy} onClick={()=>void restoreServerVersion(version.id)}>Taslağa geri yükle</button></div>)}
    </details>
    <details className="design-studio-import"><summary>Güvenli yayın ve geri alma (yalnızca yönetici)</summary>
      <p>Yalnızca kayıtlı ve doğrulanmış bir tasarım sürümü yayınlanabilir. İşlem sunucuda kayıt altına alınır; deploy yapmaz.</p>
      <label>Yayınlanacak taslak sürümü <select value={releaseId} onChange={e=>setReleaseId(e.target.value)}><option value="">Sürüm seç</option>{remoteVersions.map(version=><option key={version.id} value={version.id}>#{version.id} — {version.created_at}</option>)}</select></label>
      <button type="button" disabled={serverBusy||!releaseId} onClick={()=>void changePublication('publish')}>Seçilen sürümü yayınla</button>
      <label>Geri dönülecek yayın <select value={rollbackId} onChange={e=>setRollbackId(e.target.value)}><option value="">Yayın seç</option>{publications.map(pub=><option key={pub.id} value={pub.id}>#{pub.id} — {pub.action} — {pub.created_at}</option>)}</select></label>
      <button type="button" disabled={serverBusy||!rollbackId} onClick={()=>void changePublication('rollback')}>Eski yayına geri dön</button>
      <button type="button" disabled={serverBusy} onClick={()=>void refreshPublications().catch(()=>setServerMessage('Yayın geçmişi alınamadı.'))}>Yayın listesini yenile</button>
    </details>
    {importOpen&&<div className="design-studio-import">
      <label htmlFor="design-json-import">Tasarım JSON içeriğini yapıştır</label>
      <textarea id="design-json-import" rows={5} maxLength={10000} value={importText} onChange={event=>setImportText(event.target.value)}/>
      <button type="button" onClick={importJson}>Doğrula ve taslağa uygula</button>
    </div>}
    <div className="design-studio-workspace">
      <aside className="design-studio-pane" aria-label="Katmanlar">
        <h3>Katmanlar</h3><p>Başlık ve paneli sürükleyerek ya da oklarla sırala. Buton panelin alt öğesidir.</p><small>{DESIGN_COMPONENTS.length} izinli bileşen tanımlı; gerçek ekran önizlemesinde yalnızca izinli görsel özellikler denenir.</small>
        {layerOrder.map(item=><div className="design-layer-row" key={item} draggable={item!=='Birincil buton'&&!locked.includes(item)}
          onDragStart={event=>{if(item==='Birincil buton'||locked.includes(item)){event.preventDefault();return;}setDragging(item);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',item);}}
          onDragOver={event=>{if(dragging){event.preventDefault();event.dataTransfer.dropEffect='move';}}}
          onDrop={event=>{event.preventDefault();if(dragging)moveLayer(dragging,item);setDragging(null);}}
          onDragEnd={()=>setDragging(null)}> 
          <button type="button" aria-pressed={selected===item} className={selected===item?'design-selected':''} onClick={()=>setSelected(item)}>{item}</button>
          <button type="button" aria-label={item+' yukarı taşı'} disabled={item==='Birincil buton'||layerOrder.indexOf(item)===0||locked.includes(item)} onClick={()=>shiftLayer(item,-1)}>↑</button>
          <button type="button" aria-label={item+' aşağı taşı'} disabled={item==='Birincil buton'||layerOrder.indexOf(item)>=layerOrder.length-2||locked.includes(item)} onClick={()=>shiftLayer(item,1)}>↓</button>
          <button type="button" aria-label={item+' görünürlüğünü değiştir'} aria-pressed={!(design.hidden??[]).includes(item)} title={(design.hidden??[]).includes(item)?'Göster':'Gizle'} onClick={()=>toggleVisibility(item)}>{(design.hidden??[]).includes(item)?'◌':'◉'}</button>
          <button type="button" aria-label={item+' kilidini değiştir'} aria-pressed={locked.includes(item)} title={locked.includes(item)?'Kilidi aç':'Kilitle'} onClick={()=>toggleLock(item)}>{locked.includes(item)?'🔒':'🔓'}</button>
        </div>)}
      </aside>
      <div className="design-studio-center">
        <div className="design-device-switch" role="group" aria-label="Önizleme türü">
          <button type="button" aria-pressed={!realPreview} onClick={()=>setRealPreview(false)}>Örnek ekran</button>
          <button type="button" aria-pressed={realPreview} onClick={()=>setRealPreview(true)}>Gerçek Nesting ekranı</button>
        </div>
        <div className="design-device-switch" role="group" aria-label="Cihaz önizleme">
          {(['desktop','tablet','mobile'] as const).map(item=><button type="button" key={item} aria-pressed={device===item} onClick={()=>setDevice(item)}>{({desktop:'Masaüstü',tablet:'Tablet',mobile:'Mobil'} as const)[item]}</button>)}
        </div>
        <div className="design-device-switch"><button type="button" onClick={()=>apply({positions:{}})}>Konumları sıfırla</button></div>
        {realPreview?<div className={'design-real-frame design-preview-'+device}>
          <p>Gerçek Nesting uygulamasının yalnızca görünüm önizlemesi. Ekran etkileşimi kilitlidir; henüz uygulamanın tüm kontrolleri düzenlenemez.</p>
          <iframe title="Gerçek Serula Nesting tasarım önizlemesi" src={import.meta.env.BASE_URL+'?design-preview=1'} tabIndex={-1}/>
        </div>:<div className={'design-preview design-preview-'+device} style={{background:design.background,color:'#fff',fontSize:design.fontSize}}>
          <div className="design-preview-content" style={{position:'relative',minHeight:310}} onDragOver={event=>{if(placing)event.preventDefault();}} onDrop={dropPosition}>
          {layerOrder.filter(layer=>layer!=='Birincil buton').map(layer=>layer==='Başlık'?(!(design.hidden??[]).includes('Başlık')&&<h2 key={layer} draggable={!locked.includes('Başlık')} onDragStart={event=>{setPlacing('Başlık');event.dataTransfer.setData('text/plain','Başlık');}} onDragEnd={()=>setPlacing(null)} style={{position:'absolute',left:(design.positions?.['Başlık']?.x??0)+'%',top:(design.positions?.['Başlık']?.y??0)+'%',maxWidth:'80%'}} className={selected==='Başlık'?'design-preview-selected':''} onClick={()=>{if(!locked.includes('Başlık'))setSelected('Başlık');}}>{design.heading}</h2>):(!(design.hidden??[]).includes('Ana panel')&&<div key={layer} draggable={!locked.includes('Ana panel')} onDragStart={event=>{setPlacing('Ana panel');event.dataTransfer.setData('text/plain','Ana panel');}} onDragEnd={()=>setPlacing(null)} style={{position:'absolute',left:(design.positions?.['Ana panel']?.x??0)+'%',top:(design.positions?.['Ana panel']?.y??25)+'%',width:'min(75%,400px)',background:design.panel,borderRadius:design.radius,padding:design.spacing}} className={selected==='Ana panel'?'design-preview-panel design-preview-selected':'design-preview-panel'} onClick={()=>{if(!locked.includes('Ana panel'))setSelected('Ana panel');}}  >
            <strong>Örnek çalışma paneli</strong>
            <p>Bu alan yalnızca tasarım önizlemesidir. Gerçek hesaplamalar ve kullanıcı verileri değişmez.</p>
            {!(design.hidden??[]).includes('Birincil buton')&&<button type="button" className={selected==='Birincil buton'?'design-preview-selected':''} onClick={event=>{event.stopPropagation();if(!locked.includes('Birincil buton'))setSelected('Birincil buton');}} style={{background:design.accent,borderRadius:Math.min(design.radius,20),color:'#fff',border:0,padding:'10px 16px'}}>Örnek buton</button>}
          </div>))}
          </div>
        </div>}
      </div>
      <aside className="design-studio-pane design-studio-properties" aria-label="Özellikler">
        <h3>Özellikler</h3>
        <p>Seçili öğe: <strong>{selected}</strong></p>
        <p>Örnek tuvalde başlık ve panel sürüklenebilir. Gerçek ekran önizlemesi salt okunurdur.</p>
        <label>Yatay konum: {design.positions?.[selected]?.x??0}% <input type="range" min="0" max="80" disabled={selected==='Birincil buton'} value={design.positions?.[selected]?.x??0} onChange={e=>setPosition(selected,Number(e.target.value),design.positions?.[selected]?.y??0)}/></label>
        <label>Dikey konum: {design.positions?.[selected]?.y??0}% <input type="range" min="0" max="80" disabled={selected==='Birincil buton'} value={design.positions?.[selected]?.y??0} onChange={e=>setPosition(selected,design.positions?.[selected]?.x??0,Number(e.target.value))}/></label>
        {locked.includes(selected)&&<p role="status">Bu katman kilitli. Düzenlemek için kilidi aç.</p>}
        <fieldset disabled={locked.includes(selected)}>
        <label>Arka plan <input type="color" value={design.background} onChange={e=>apply({background:e.target.value})}/></label>
        <label>Panel rengi <input type="color" value={design.panel} onChange={e=>apply({panel:e.target.value})}/></label>
        <label>Vurgu rengi <input type="color" value={design.accent} onChange={e=>apply({accent:e.target.value})}/></label>
        <label>Köşe yuvarlama: {design.radius}px <input type="range" min="0" max="32" value={design.radius} onChange={e=>apply({radius:Number(e.target.value)})}/></label>
        <label>İç boşluk: {design.spacing}px <input type="range" min="8" max="40" value={design.spacing} onChange={e=>apply({spacing:Number(e.target.value)})}/></label>
        <label>Yazı boyutu: {design.fontSize}px <input type="range" min="12" max="22" value={design.fontSize} onChange={e=>apply({fontSize:Number(e.target.value)})}/></label>
        <label>Başlık <input type="text" maxLength={80} value={design.heading} onChange={e=>apply({heading:e.target.value})}/></label>
        </fieldset>
      </aside>
    </div>
  </section>;
}
