import {useEffect,useRef,useState,type MouseEvent,type PointerEvent as ReactPointerEvent} from 'react';
import {DESIGN_ZONES,cleanZoneStyles,renderZoneCss,type DesignZone,type ZoneStyle,type ZoneStyles} from './design-zone-styles';
import {BLOCK_KINDS,BLOCK_REGIONS,BLOCK_DEVICES,cleanBlocks,defaultBlock,isSafeImageSource,type BlockKind,type BlockRegion,type DesignBlock} from './design-blocks';
import './DesignStudio.css';
import {DESIGN_COMPONENTS,canReorder} from './design-component-registry';
import {appearanceToPreviewTokens} from './design-appearance-adapter';
import {useAppearance} from '../appearance';

type Design = {background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;heading:string;hidden?:string[];order?:string[];positions?:Record<string,{x:number;y:number}>;workspaceOrder?:string[];zoneStyles?:ZoneStyles;blocks?:DesignBlock[]};
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
    &&(d.zoneStyles===undefined||(typeof d.zoneStyles==='object'&&d.zoneStyles!==null&&!Array.isArray(d.zoneStyles)&&Object.keys(d.zoneStyles).every(key=>DESIGN_ZONES.some(id=>id===key)&&Object.keys(d.zoneStyles?.[key as DesignZone]??{}).every(field=>['background','color','radius','spacing','fontSize','shadow','text','offsetX','offsetY'].includes(field))&&JSON.stringify(cleanZoneStyles({[key]:d.zoneStyles?.[key as DesignZone]}))!=='{}')))
    &&(d.blocks===undefined||(Array.isArray(d.blocks)&&d.blocks.length<=100&&cleanBlocks(d.blocks).length===d.blocks.length))
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
  const [sidebarTab,setSidebarTab]=useState<'layers'|'elements'|'history'>('layers');
  const [selectedBlockId,setSelectedBlockId]=useState<string|null>(null);
  const [showPublish,setShowPublish]=useState(false);
  const frameRef=useRef<HTMLIFrameElement|null>(null);
  const buttonDragRef=useRef<{zone:DesignZone;pointerId:number;startX:number;startY:number;x:number;y:number}|null>(null);
  const customDragRef=useRef<{id:string;pointerId:number;startX:number;startY:number;x:number;y:number}|null>(null);
  const didDragRef=useRef(false);
  const [frameSize,setFrameSize]=useState({width:1100,height:680});
  const [zoom,setZoom]=useState(80);
  const [leftOpen,setLeftOpen]=useState(true);
  const [rightOpen,setRightOpen]=useState(true);
  const deviceWidth=device==='desktop'?1440:device==='tablet'?768:390;
  const previewScale=zoom/100;
  useEffect(()=>{
    const el=frameRef.current?.parentElement;if(!el)return;
    const update=()=>setFrameSize({width:el.clientWidth,height:el.clientHeight});
    update();const observer=new ResizeObserver(update);observer.observe(el);
    return()=>observer.disconnect();
  },[device]);
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
      setServerMessage(kind==='publish'?'Seçilen sürüm canlı görünüme yayınlandı. Açık Nesting sekmeleri yenilendiğinde görünür.':'Önceki yayın geri yüklendi. Açık Nesting sekmeleri yenilendiğinde görünür.');
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
      // Newly created immutable revision is the version the user just saved.
      const versions=await fetch('/api/admin/design/versions',{credentials:'same-origin',cache:'no-store'});
      if(versions.ok){
        const data=await versions.json() as {versions?:{id:number}[]};
        const newest=data.versions?.[0]?.id;
        if(Number.isSafeInteger(newest)&&newest&&newest>0)setReleaseId(String(newest));
      }
      setServerMessage('Sunucu taslağı yeni sürüm olarak kaydedildi. Yayınlanacak sürüm seçildi; canlı site henüz değişmedi.');
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
      if(importText.length>70000)throw Error('Dosya çok büyük.');
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
  const syncFramePreview=()=>{
    try{
      const doc=frameRef.current?.contentDocument;if(!doc)return;
      let stylesheet=doc.querySelector<HTMLStyleElement>('style[data-serula-design-editor]');
      if(!stylesheet){stylesheet=doc.createElement('style');stylesheet.setAttribute('data-serula-design-editor','true');doc.head.appendChild(stylesheet);}
      stylesheet.textContent=renderZoneCss(design.zoneStyles);
      // Update only allowlisted labels. No HTML insertion or button handler changes.
      const safe=cleanZoneStyles(design.zoneStyles);
      const headings:Partial<Record<DesignZone,string>>={
        header:'.app .tagline',canvas:'.app .studio-canvas-heading h1',
        parts:'.app #parts-settings .panel-title h2',material:'.app .material-panel .panel-title h2',
        runButton:'.app .run-button.reference-launch span',
        corelButton:'.app .corel-transfer-button span',
        downloadButton:'.app .export-actions .download-button:not(.corel-transfer-button) span'
      };
      for(const id of DESIGN_ZONES){
        const label=safe[id]?.text,selector=headings[id];
        if(label===undefined||!selector)continue;
        const target=doc.querySelector<HTMLElement>(selector);if(!target)continue;
        if(id==='parts'&&target.firstChild?.nodeType===Node.TEXT_NODE)target.firstChild.textContent=label+' ';
        else target.textContent=label;
      }
    }catch{/* Preview styling never affects project state. */}
  };
  useEffect(()=>{if(realPreview)syncFramePreview();},[design,realPreview]);

  useEffect(()=>{
    if(!realPreview)return;
    try{localStorage.setItem('serula-design-studio-live-preview-v1',JSON.stringify(design));frameRef.current?.contentWindow?.postMessage('serula-design-preview-refresh',window.location.origin);}
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
  const blocks=cleanBlocks(design.blocks);
  const selectedBlock=blocks.find(b=>b.id===selectedBlockId);
  const selectBlock=(id:string)=>{
    setSelectedBlockId(id);setSelectedDetail('');
    try{
      const doc=frameRef.current?.contentDocument;
      doc?.querySelectorAll('[data-design-block-id]').forEach(el=>(el as HTMLElement).style.removeProperty('outline'));
      doc?.querySelector('[data-design-block-id="'+id+'"]')?.setAttribute('data-design-active-block','true');
      (doc?.querySelector('[data-design-block-id="'+id+'"]') as HTMLElement|null)?.style.setProperty('outline','3px solid #4d63ed');
    }catch{}
  };
  const modifyBlock=(patch:Partial<DesignBlock>)=>{
    if(!selectedBlockId)return;
    apply({blocks:blocks.map(b=>b.id===selectedBlockId?{...b,...patch}:b)});
  };
  const addBlock=(kind:BlockKind,targetRegion?:BlockRegion)=>{
    if(blocks.length>=100){setStorageError('Bir tasarımda en fazla 100 ek bileşen kullanılabilir.');return;}
    const id='widget-'+crypto.randomUUID();
    const region=targetRegion??(BLOCK_REGIONS.includes(selectedZone as BlockRegion)?selectedZone as BlockRegion:'canvas');
    apply({blocks:[...blocks,defaultBlock(kind,region,id)]});
    setSelectedBlockId(id);setSidebarTab('layers');
  };
  const removeBlock=()=>{
    if(!selectedBlockId)return;
    apply({blocks:blocks.filter(b=>b.id!==selectedBlockId)});setSelectedBlockId(null);
  };
  const duplicateBlock=()=>{
    if(!selectedBlock||blocks.length>=100)return;
    const id='widget-'+crypto.randomUUID();
    const copy={...selectedBlock,id,x:Math.min(300,(selectedBlock.x??0)+16),y:Math.min(300,(selectedBlock.y??0)+16)};
    const i=blocks.findIndex(b=>b.id===selectedBlockId);
    const next=[...blocks];next.splice(i+1,0,copy);
    apply({blocks:next});setSelectedBlockId(id);
  };
  const reorderBlock=(source:string,target:string)=>{
    if(source===target)return;
    const from=blocks.findIndex(b=>b.id===source),to=blocks.findIndex(b=>b.id===target);
    if(from<0||to<0)return;
    const next=blocks.filter(b=>b.id!==source);
    next.splice(from<to?to:to,0,blocks[from]);
    apply({blocks:next});
  };
  const shiftBlock=(delta:number)=>{
    if(!selectedBlockId)return;
    const i=blocks.findIndex(b=>b.id===selectedBlockId),to=i+delta;
    if(i<0||to<0||to>=blocks.length)return;
    const next=[...blocks];[next[i],next[to]]=[next[to],next[i]];
    apply({blocks:next});
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
      if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      const ctrl=event.ctrlKey||event.metaKey;
      if(selectedBlock&&(!ctrl&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))){
        event.preventDefault();
        const delta=event.shiftKey?10:1;
        const x=Math.max(-300,Math.min(300,(selectedBlock.x??0)+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0)));
        const y=Math.max(-300,Math.min(300,(selectedBlock.y??0)+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)));
        modifyBlock({x,y});return;
      }
      if(selectedBlock&&ctrl&&event.key.toLowerCase()==='d'){event.preventDefault();duplicateBlock();return;}
      if(selectedBlock&&!ctrl&&(['Delete','Backspace'].includes(event.key))){event.preventDefault();removeBlock();return;}
      if(!ctrl||!['z','y'].includes(event.key.toLowerCase()))return;
      event.preventDefault();
      if(event.key.toLowerCase()==='y'||event.shiftKey)redo();else undo();
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[history.length,selectedBlockId,design,index]);
  const zoneStyle=design.zoneStyles?.[selectedZone]??{};
  const changeZoneStyle=(key:keyof ZoneStyle,value:string|number)=>{
    apply({zoneStyles:{...design.zoneStyles,[selectedZone]:{...zoneStyle,[key]:value}}});
  };
  const resetZone=()=>{
    const copy={...design.zoneStyles};delete copy[selectedZone];
    apply({zoneStyles:copy});
  };
  const selectZone=(zone:DesignZone,detail='')=>{
    setSelectedBlockId(null);
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
  const blockHit=(clientX:number,clientY:number)=>{
    const frame=frameRef.current,doc=frame?.contentDocument;if(!frame||!doc)return null;
    const rect=frame.getBoundingClientRect();
    return doc.elementFromPoint((clientX-rect.left)/previewScale,(clientY-rect.top)/previewScale);
  };
  const selectAtPoint=(event:MouseEvent<HTMLDivElement>)=>{
    const iframe=frameRef.current;if(!iframe)return;
    try{
      const doc=iframe.contentDocument;if(!doc)return;
      const bounds=iframe.getBoundingClientRect();
      const hit=doc.elementFromPoint((event.clientX-bounds.left)/previewScale,(event.clientY-bounds.top)/previewScale);
      const block=hit?.closest('[data-design-block-id]');
      const blockId=block?.getAttribute('data-design-block-id');
      if(blockId&&blocks.some(item=>item.id===blockId)){selectBlock(blockId);return;}
      const root=hit?.closest('[data-design-zone]');
      const id=root?.getAttribute('data-design-zone');
      if(id&&DESIGN_ZONES.some(zone=>zone===id)){
        const detail=hit instanceof HTMLElement&&hit.closest('button')?(hit.closest('button')?.textContent??'').trim().slice(0,50):'';
        selectZone(id as DesignZone,detail);
      }
    }catch{setStorageError('Önizleme alanı seçilemedi.');}
  };
  const draggableZones:DesignZone[]=[...DESIGN_ZONES];
  const movementLimit=(id:DesignZone)=>['runButton','corelButton','downloadButton'].includes(id)?80:160;
  const boundedOffset=(n:number,id:DesignZone)=>Math.max(-movementLimit(id),Math.min(movementLimit(id),Math.round(n)));
  const hitZone=(event:ReactPointerEvent<HTMLDivElement>):DesignZone|null=>{
    const iframe=frameRef.current,doc=iframe?.contentDocument;
    if(!iframe||!doc)return null;
    const rect=iframe.getBoundingClientRect();
    const target=doc.elementFromPoint((event.clientX-rect.left)/previewScale,(event.clientY-rect.top)/previewScale);
    const id=target?.closest('[data-design-zone]')?.getAttribute('data-design-zone');
    return id&&DESIGN_ZONES.some(key=>key===id)?id as DesignZone:null;
  };
  const pointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;
    const blockId=blockHit(event.clientX,event.clientY)?.closest('[data-design-block-id]')?.getAttribute('data-design-block-id');
    const custom=blocks.find(b=>b.id===blockId);
    if(custom){
      selectBlock(custom.id);
      customDragRef.current={id:custom.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:custom.x??0,y:custom.y??0};
      didDragRef.current=false;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const id=hitZone(event);
    if(!id)return;
    selectZone(id);
    if(!draggableZones.includes(id))return;
    const current=design.zoneStyles?.[id]??{};
    buttonDragRef.current={zone:id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:current.offsetX??0,y:current.offsetY??0};
    didDragRef.current=false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const custom=customDragRef.current;
    if(custom&&custom.pointerId===event.pointerId){
      const x=Math.max(-300,Math.min(300,Math.round(custom.x+(event.clientX-custom.startX)/previewScale)));
      const y=Math.max(-300,Math.min(300,Math.round(custom.y+(event.clientY-custom.startY)/previewScale)));
      if(x!==custom.x||y!==custom.y)didDragRef.current=true;
      frameRef.current?.contentDocument?.querySelector<HTMLElement>('[data-design-block-id="'+custom.id+'"]')?.style.setProperty('transform','translate('+x+'px,'+y+'px)');
      return;
    }
    const dragging=buttonDragRef.current;
    if(!dragging||dragging.pointerId!==event.pointerId)return;
    const x=boundedOffset(dragging.x+(event.clientX-dragging.startX)/previewScale,dragging.zone);
    const y=boundedOffset(dragging.y+(event.clientY-dragging.startY)/previewScale,dragging.zone);
    if(x!==dragging.x||y!==dragging.y)didDragRef.current=true;
    const target=frameRef.current?.contentDocument?.querySelector<HTMLElement>('[data-design-zone="'+dragging.zone+'"]');
    target?.style.setProperty('transform','translate('+x+'px,'+y+'px)','important');
  };
  const pointerUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const custom=customDragRef.current;
    if(custom&&custom.pointerId===event.pointerId){
      const x=Math.max(-300,Math.min(300,Math.round(custom.x+(event.clientX-custom.startX)/previewScale)));
      const y=Math.max(-300,Math.min(300,Math.round(custom.y+(event.clientY-custom.startY)/previewScale)));
      frameRef.current?.contentDocument?.querySelector<HTMLElement>('[data-design-block-id="'+custom.id+'"]')?.style.removeProperty('transform');
      customDragRef.current=null;
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
      const zone=blockHit(event.clientX,event.clientY)?.closest('[data-design-zone]')?.getAttribute('data-design-zone');
      const destination=zone&&BLOCK_REGIONS.includes(zone as BlockRegion)?zone as BlockRegion:undefined;
      const source=blocks.find(b=>b.id===custom.id);
      if((x!==custom.x||y!==custom.y)&&source){
        const other=destination&&destination!==source.region;
        apply({blocks:blocks.map(b=>b.id===custom.id?{...b,region:other?destination:b.region,x:other?0:x,y:other?0:y}:b)});
      }
      return;
    }
    const dragging=buttonDragRef.current;
    if(!dragging||dragging.pointerId!==event.pointerId)return;
    const x=boundedOffset(dragging.x+(event.clientX-dragging.startX)/previewScale,dragging.zone);
    const y=boundedOffset(dragging.y+(event.clientY-dragging.startY)/previewScale,dragging.zone);
    frameRef.current?.contentDocument?.querySelector<HTMLElement>('[data-design-zone="'+dragging.zone+'"]')?.style.removeProperty('transform');
    buttonDragRef.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(x!==dragging.x||y!==dragging.y){
      apply({zoneStyles:{...design.zoneStyles,[dragging.zone]:{...design.zoneStyles?.[dragging.zone],offsetX:x,offsetY:y}}});
    }
  };
  const pointerCancel=()=>{
    const custom=customDragRef.current;
    if(custom)frameRef.current?.contentDocument?.querySelector<HTMLElement>('[data-design-block-id="'+custom.id+'"]')?.style.removeProperty('transform');
    customDragRef.current=null;
    const dragging=buttonDragRef.current;
    if(dragging)frameRef.current?.contentDocument?.querySelector<HTMLElement>('[data-design-zone="'+dragging.zone+'"]')?.style.removeProperty('transform');
    buttonDragRef.current=null;
  };
  const zoneNames:Record<DesignZone,string>={header:'Üst menü',parts:'Parça paneli',canvas:'Çalışma alanı',material:'Malzeme ve ayarlar',actions:'Alt işlem çubuğu',runButton:'Yerleştir butonu',corelButton:'CorelDRAW butonu',downloadButton:'DXF indir butonu',brand:'Marka alanı',projectBar:'Proje menüsü',partsList:'Parça listesi',canvasHeading:'Çalışma başlığı',rotationSettings:'Dönüş ayarları',materialSettings:'Malzeme ayarları',runControls:'Yerleştirme işlemleri',exportActions:'Dışa aktarma alanı',projectStatus:'Kayıt durumu',partsTitle:'Parça paneli başlığı'};
  const shownZoneOrder:DesignZone[]=['header',...(workspaceOrder as DesignZone[]),'actions','runButton','corelButton','downloadButton','brand','projectBar','partsList','canvasHeading','rotationSettings','materialSettings','runControls','exportActions','projectStatus','partsTitle'];
  const reset=()=>{
    if(!window.confirm('Kaydedilmemiş değişiklikler silinsin ve son kaydedilen taslak geri yüklensin mi?'))return;
    const lastSaved=loadDraft();
    setHistory([lastSaved]);setIndex(0);setSaved(true);
    setSelectedBlockId(null);
    setStorageError('');
  };
  return <section className="design-studio design-editor-v2" aria-label="Serula görsel tasarım editörü">
    <header className="editor-topbar">
      <div className="editor-brand"><div className="editor-brand-mark">S</div><div><strong>Görsel Düzenleyici</strong><small>Serula Nesting / Tasarım alanı</small></div><span className="editor-draft-label">TASLAK</span><button type="button" className="editor-pane-toggle" aria-label={leftOpen?'Katman panelini gizle':'Katman panelini göster'} onClick={()=>setLeftOpen(v=>!v)}>☰</button><button type="button" className="editor-pane-toggle" aria-label={rightOpen?'Özellik panelini gizle':'Özellik panelini göster'} onClick={()=>setRightOpen(v=>!v)}>▤</button></div>
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
    <div className={"editor-main"+(leftOpen?"":" editor-hide-left")+(rightOpen?"":" editor-hide-right")}>
      <aside className="editor-sidebar" aria-label="Sayfalar ve katmanlar">
        <div className="editor-sidebar-tabs" role="group" aria-label="Sol panel görünümü">
          <button type="button" aria-pressed={sidebarTab==='layers'} onClick={()=>setSidebarTab('layers')}>Katmanlar</button>
          <button type="button" aria-pressed={sidebarTab==='elements'} onClick={()=>setSidebarTab('elements')}>Ekle</button>
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
              <button type="button" className="editor-layer-select" aria-label={zoneNames[id]} onClick={()=>selectZone(id)} aria-pressed={selectedZone===id}><span className="editor-layer-icon">{id==='canvas'?'▧':id==='header'?'☰':id==='actions'?'▱':'▤'}</span>{zoneNames[id]}</button>
              {['parts','canvas','material'].includes(id)&&<div className="editor-layer-order">
                <button type="button" aria-label={zoneNames[id]+' sola taşı'} disabled={workspaceOrder.indexOf(id)===0} onClick={()=>shiftWorkspace(id,-1)}>‹</button>
                <button type="button" aria-label={zoneNames[id]+' sağa taşı'} disabled={workspaceOrder.indexOf(id)===2} onClick={()=>shiftWorkspace(id,1)}>›</button>
              </div>}
            </div>)}
          </div>
          <div className="editor-section-label editor-layer-title">EKLENEN ÖĞELER <span>{blocks.length}</span></div>
          <div className="editor-layer-tree">
            {blocks.map(block=><div key={block.id} draggable
              onDragStart={event=>{event.dataTransfer.setData('application/x-serula-layer',block.id);event.dataTransfer.effectAllowed='move';}}
              onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-serula-layer'))event.preventDefault();}}
              onDrop={event=>{event.preventDefault();const id=event.dataTransfer.getData('application/x-serula-layer');if(id)reorderBlock(id,block.id);}}
              className={'editor-layer'+(selectedBlockId===block.id?' is-selected':'')}>
              <button type="button" className="editor-layer-select" onClick={()=>selectBlock(block.id)} aria-label={'Öğe: '+block.text}>{block.kind==='button'?'▣':block.kind==='image'?'▧':'T'} {block.text||'Ayraç'}</button>
              <button type="button" aria-label={block.text+' görünürlüğünü değiştir'} onClick={()=>{apply({blocks:blocks.map(b=>b.id===block.id?{...b,hidden:!b.hidden}:b)});}}>{block.hidden?'◌':'◉'}</button>
            </div>)}
          </div>
                    <div className="editor-layer-bottom"><button type="button" onClick={()=>apply({workspaceOrder:['parts','canvas','material']})}>↺ Panel sırasını sıfırla</button></div>
        </div>:sidebarTab==='elements'?<div className="editor-history editor-elements-palette">
          <div className="editor-section-label">BİLEŞEN EKLE</div>
          <p>Önce bir panel seç, ardından yeni öğeyi ekle. Öğeler gerçek Nesting ekranına yerleşir; işlevsel kontroller korunur.</p>
          <label>Bölüm
            <select value={BLOCK_REGIONS.includes(selectedZone as BlockRegion)?selectedZone:'canvas'} onChange={e=>selectZone(e.target.value as DesignZone)}>
              {BLOCK_REGIONS.map(id=><option key={id} value={id}>{({header:'Üst menü',parts:'Parçalar',canvas:'Çalışma alanı',material:'Malzeme',actions:'Alt çubuk'} as Record<BlockRegion,string>)[id]}</option>)}
            </select>
          </label>
          {BLOCK_KINDS.map(kind=><button key={kind} type="button" className="editor-add-block" draggable onDragStart={event=>{event.dataTransfer.setData('application/x-serula-block',kind);event.dataTransfer.effectAllowed='copy';}} onClick={()=>addBlock(kind)}>+ {({text:'Metin',heading:'Başlık',button:'Bağlantı butonu',image:'Görsel',divider:'Ayraç'} as Record<BlockKind,string>)[kind]}</button>)}
          <small>Öğe ekleyince katman listesinde görünür. Mevcut Nesting butonlarının çalışma biçimi değiştirilmez.</small>
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
            {(['desktop','tablet','mobile'] as const).map(item=><button type="button" key={item} aria-label={({desktop:"Masaüstü",tablet:"Tablet",mobile:"Mobil"} as const)[item]} aria-pressed={device===item} onClick={()=>setDevice(item)}>{({desktop:'▭ Masaüstü',tablet:'▯ Tablet',mobile:'▮ Mobil'} as const)[item]}</button>)}
          </div>
          <div className="editor-stage-percent"><button type="button" aria-label="Önizlemeyi küçült" disabled={zoom<=30} onClick={()=>setZoom(v=>Math.max(30,v-10))}>−</button><span>{Math.round(previewScale*100)+'% · '+deviceWidth+' px'}</span><button type="button" aria-label="Önizlemeyi büyüt" disabled={zoom>=200} onClick={()=>setZoom(v=>Math.min(200,v+10))}>+</button><button type="button" onClick={()=>{const scroller=frameRef.current?.closest('.editor-stage-area')?.querySelector('.editor-stage-scroller');const width=scroller?.clientWidth??760;setZoom(Math.max(30,Math.min(100,Math.floor((width-48)/deviceWidth*100))));}}>Sığdır</button></div>
        </div>
        <div className="editor-stage-scroller">
          <div className={'editor-live-surface editor-live-'+device} style={{width:Math.ceil(deviceWidth*previewScale),minWidth:Math.ceil(deviceWidth*previewScale),maxWidth:'none',height:760,flex:'none'}}>
            <div className="editor-frame-top"><span/><span/><span/><span className="editor-frame-url">serula.site / studio</span></div>
            <div className="editor-iframe-wrap">
              <iframe ref={frameRef} title="Gerçek Serula Nesting ekranı" src={import.meta.env.BASE_URL+'?design-preview=1'} tabIndex={-1} loading="eager" onLoad={()=>syncFramePreview()} style={{width:deviceWidth,height:Math.ceil(Math.max(680,frameSize.height/previewScale)),transform:'scale('+previewScale+')',transformOrigin:'top left'}}/>
              <div className="editor-click-shield" role="button" tabIndex={0} aria-label="Önizlemeden bir öğe seç"
                onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-serula-block'))event.preventDefault();}}
                onDrop={event=>{event.preventDefault();const kind=event.dataTransfer.getData('application/x-serula-block');if(!BLOCK_KINDS.includes(kind as BlockKind))return;const target=blockHit(event.clientX,event.clientY)?.closest('[data-design-zone]')?.getAttribute('data-design-zone');addBlock(kind as BlockKind,target&&BLOCK_REGIONS.includes(target as BlockRegion)?target as BlockRegion:'canvas');}}
                onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onClick={event=>{if(didDragRef.current){didDragRef.current=false;return;}selectAtPoint(event);}} onWheel={event=>{try{frameRef.current?.contentWindow?.scrollBy(0,event.deltaY/previewScale);}catch{}}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectZone('canvas');}}}/>
            </div>
          </div>
        </div>
        <div className="editor-stage-footer"><span><span className="editor-live-dot"/> Gerçek Serula ekranı · Güvenli seçim modu</span><span>Butonları ekranda sürükle veya sağdaki X/Y ayarlarını kullan. Canlı site değişmez.</span></div>
      </main>
      <aside className="editor-inspector" aria-label="Seçili öğe özellikleri">
        <div className="editor-inspector-head"><small>ÖZELLİKLER</small><strong>{selectedBlock?selectedBlock.text||'Ayraç':zoneNames[selectedZone]}</strong><span>{selectedBlock?'Eklenen '+selectedBlock.kind+' bileşeni':selectedDetail?'Seçilen kontrol: '+selectedDetail:'Gerçek uygulama bileşeni'}</span></div>
        <div className="editor-inspector-scroll">
          {selectedBlock?<div className="editor-block-inspector">
            <div className="editor-property-group"><div className="editor-property-title">Öğe içeriği</div>
              {selectedBlock.kind!=='divider'&&<label className="editor-text-field">Metin / açıklama<input aria-label="Bileşen metni" type="text" maxLength={160} value={selectedBlock.text} onChange={e=>modifyBlock({text:e.target.value})}/></label>}
              <label className="editor-text-field">Yerleşeceği bölüm<select aria-label="Bileşen bölgesi" value={selectedBlock.region} onChange={e=>modifyBlock({region:e.target.value as BlockRegion,x:0,y:0})}>{BLOCK_REGIONS.map(region=><option key={region} value={region}>{region}</option>)}</select></label>
              {selectedBlock.kind==='button'&&<label className="editor-text-field">Bağlantı adresi (site içi)<input aria-label="Buton bağlantısı" type="text" value={selectedBlock.href??'/'} maxLength={80} onChange={e=>modifyBlock({href:e.target.value})}/></label>}
              {selectedBlock.kind==='image'&&<>
                <label className="editor-text-field">Hazır görsel<select aria-label="Bileşen görseli" value={['/serula-logo.svg','/corel-button-logo.svg'].includes(selectedBlock.src??'')?selectedBlock.src:'/serula-logo.svg'} onChange={e=>modifyBlock({src:e.target.value})}><option value="/serula-logo.svg">Serula logosu</option><option value="/corel-button-logo.svg">CorelDRAW logosu</option></select></label>
                <label className="editor-text-field">Görsel adresi (HTTPS veya site içi)<input key={selectedBlock.id+'-image'} aria-label="Özel görsel adresi" type="url" maxLength={300} defaultValue={selectedBlock.src??'/serula-logo.svg'} onBlur={e=>{const value=e.target.value.trim();if(isSafeImageSource(value)){modifyBlock({src:value});setStorageError('');}else setStorageError('Görsel adresi geçersiz. HTTPS PNG/JPG/WebP veya site içi görsel yolu kullan.');}}/></label>
              </>}
            </div>
            <div className="editor-property-group"><div className="editor-property-title">Görünüm</div>
              <label className="editor-color-field">Yazı rengi<input aria-label="Bileşen yazı rengi" type="color" value={selectedBlock.color??'#24354f'} onChange={e=>modifyBlock({color:e.target.value})}/></label>
              <label className="editor-color-field">Arka plan<input aria-label="Bileşen arka planı" type="color" value={selectedBlock.background??'#ffffff'} onChange={e=>modifyBlock({background:e.target.value})}/></label>
              {([['fontSize','Yazı boyutu',10,36],['padding','Boşluk',0,48],['radius','Köşe',0,40],['width','Genişlik',40,650],['opacity','Saydamlık',0,100]] as const).map(([key,label,min,max])=><label key={key} className="editor-slider-label"><span>{label}</span><output>{selectedBlock[key]??(key==='opacity'?100:key==='width'?200:key==='fontSize'?14:8)}</output><input aria-label={'Bileşen '+label} type="range" min={min} max={max} value={selectedBlock[key]??(key==='opacity'?100:key==='width'?200:key==='fontSize'?14:8)} onChange={e=>modifyBlock({[key]:Number(e.target.value)})}/></label>)}
              <label className="editor-slider-label"><span>Kenarlık kalınlığı</span><output>{selectedBlock.borderWidth??0}px</output><input aria-label="Bileşen kenarlık kalınlığı" type="range" min="0" max="8" value={selectedBlock.borderWidth??0} onChange={e=>modifyBlock({borderWidth:Number(e.target.value)})}/></label>
              <label className="editor-color-field">Kenarlık rengi<input aria-label="Bileşen kenarlık rengi" type="color" value={selectedBlock.borderColor??'#d7deea'} onChange={e=>modifyBlock({borderColor:e.target.value})}/></label>
              <label className="editor-text-field">Yazı tipi<select aria-label="Bileşen yazı tipi" value={selectedBlock.fontFamily??'system'} onChange={e=>modifyBlock({fontFamily:e.target.value as DesignBlock['fontFamily']})}><option value="system">Sistem</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label>
              <label className="editor-text-field">Animasyon<select aria-label="Bileşen animasyonu" value={selectedBlock.animation??'none'} onChange={e=>modifyBlock({animation:e.target.value as DesignBlock['animation']})}><option value="none">Yok</option><option value="fade">Yumuşak giriş</option><option value="slide">Açılarak giriş</option></select></label>
              <label className="editor-text-field">Hizalama<select aria-label="Bileşen hizalama" value={selectedBlock.align??'left'} onChange={e=>modifyBlock({align:e.target.value as DesignBlock['align']})}><option value="left">Sol</option><option value="center">Orta</option><option value="right">Sağ</option></select></label>
            </div>
            <div className="editor-property-group"><div className="editor-property-title">Konum · sürükle-bırak</div>
              {([['x','Yatay konum'],['y','Dikey konum']] as const).map(([key,label])=><label key={key} className="editor-slider-label"><span>{label}</span><output>{selectedBlock[key]??0} px</output><input aria-label={'Bileşen '+label} type="range" min="-300" max="300" value={selectedBlock[key]??0} onChange={e=>modifyBlock({[key]:Number(e.target.value)})}/></label>)}
              <button type="button" onClick={()=>modifyBlock({x:0,y:0})}>Konumu sıfırla</button>
            </div>
            <div className="editor-property-group"><div className="editor-property-title">Responsive görünürlük</div>
              {BLOCK_DEVICES.map(dev=><label key={dev} className="editor-device-toggle"><input type="checkbox" aria-label={'Bileşen '+dev+' göster'} checked={(selectedBlock.devices??[...BLOCK_DEVICES]).includes(dev)} onChange={e=>{const original=selectedBlock.devices??[...BLOCK_DEVICES];const next=e.target.checked?[...original,dev]:original.filter(v=>v!==dev);if(next.length)modifyBlock({devices:next});}}/>{dev}</label>)}
              <label className="editor-device-toggle"><input type="checkbox" aria-label="Bileşeni gizle" checked={!!selectedBlock.hidden} onChange={e=>modifyBlock({hidden:e.target.checked})}/>Gizle</label>
            </div>
            <div className="editor-block-actions">
              <button type="button" onClick={()=>shiftBlock(-1)}>↑ Üste taşı</button><button type="button" onClick={()=>shiftBlock(1)}>↓ Alta taşı</button>
              <button type="button" onClick={duplicateBlock}>Çoğalt</button>
              <button type="button" className="editor-delete" onClick={removeBlock}>Sil</button>
            </div>
          </div>:<>
          <div className="editor-property-group"><div className="editor-property-title">Görünüm <span>◫</span></div>
            <label className="editor-color-field"><span>Arka plan rengi</span><span className="editor-color-control"><input aria-label="Seçili öğe arka plan rengi" type="color" value={zoneStyle.background??design.panel} onChange={e=>changeZoneStyle('background',e.target.value)}/><code>{zoneStyle.background??design.panel}</code></span></label>
            <label className="editor-color-field"><span>Yazı rengi</span><span className="editor-color-control"><input aria-label="Seçili öğe yazı rengi" type="color" value={zoneStyle.color??'#222a36'} onChange={e=>changeZoneStyle('color',e.target.value)}/><code>{zoneStyle.color??'#222a36'}</code></span></label>
          </div>
          {draggableZones.includes(selectedZone)&&<div className="editor-property-group">
            <div className="editor-property-title">Öğe konumu <span>↔</span></div>
            <p className="editor-position-hint">Önizleme ekranında seçili öğeyi sürükle. Konum değişiklikleri kayda ve geri alma geçmişine dahil edilir.</p>
            <label className="editor-slider-label"><span>Yatay (X)</span><output>{zoneStyle.offsetX??0} px</output><input type="range" min={-movementLimit(selectedZone)} max={movementLimit(selectedZone)} aria-label={['runButton','corelButton','downloadButton'].includes(selectedZone)?'Seçili buton yatay konumu':'Seçili öğe yatay konumu'} value={zoneStyle.offsetX??0} onChange={e=>changeZoneStyle('offsetX',Number(e.target.value))}/></label>
            <label className="editor-slider-label"><span>Dikey (Y)</span><output>{zoneStyle.offsetY??0} px</output><input type="range" min={-movementLimit(selectedZone)} max={movementLimit(selectedZone)} aria-label={['runButton','corelButton','downloadButton'].includes(selectedZone)?'Seçili buton dikey konumu':'Seçili öğe dikey konumu'} value={zoneStyle.offsetY??0} onChange={e=>changeZoneStyle('offsetY',Number(e.target.value))}/></label>
            <button type="button" onClick={()=>apply({zoneStyles:{...design.zoneStyles,[selectedZone]:{...zoneStyle,offsetX:0,offsetY:0}}})}>Buton konumunu sıfırla</button>
          </div>}
          <div className="editor-property-group"><div className="editor-property-title">Boyut ve boşluk <span>▦</span></div>
            <label className="editor-slider-label"><span>İç boşluk</span><output>{zoneStyle.spacing??design.spacing} px</output><input aria-label="Seçili öğe iç boşluk" type="range" min="0" max="48" value={zoneStyle.spacing??design.spacing} onChange={e=>changeZoneStyle('spacing',Number(e.target.value))}/></label>
            <label className="editor-slider-label"><span>Köşe yuvarlaklığı</span><output>{zoneStyle.radius??design.radius} px</output><input aria-label="Seçili öğe köşe yarıçapı" type="range" min="0" max="32" value={zoneStyle.radius??design.radius} onChange={e=>changeZoneStyle('radius',Number(e.target.value))}/></label>
          </div>
          <div className="editor-property-group"><div className="editor-property-title">Tipografi <span>𝘼</span></div>
            {['header','parts','canvas','material','runButton','corelButton','downloadButton'].includes(selectedZone)&&<label className="editor-text-field">Bölüm başlığı / metni<input type="text" aria-label="Seçili bölüm başlığı" maxLength={80} value={zoneStyle.text??''} placeholder={zoneNames[selectedZone]} onChange={e=>changeZoneStyle('text',e.target.value)}/></label>}

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
          </>}
        </div>
        <div className="editor-inspector-footer"><button type="button" disabled={!appearanceLoaded} onClick={()=>apply(appearanceToPreviewTokens(appearance))}>Serula renklerini içe al</button></div>
      </aside>
    </div>
    {importOpen&&<div className="editor-import-overlay"><div className="editor-import-dialog" role="dialog" aria-modal="true" aria-label="Tasarım JSON içe aktar"><h3>JSON içe aktar</h3><p>Yalnızca doğrulanmış Serula tasarım dosyaları kabul edilir.</p><textarea aria-label="Tasarım JSON içeriği" rows={7} maxLength={70000} value={importText} onChange={e=>setImportText(e.target.value)}/><div><button type="button" onClick={()=>setImportOpen(false)}>Vazgeç</button><button type="button" onClick={importJson}>Doğrula ve taslağa uygula</button></div></div></div>}
  </section>;
}
