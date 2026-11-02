import {useRef,useState} from 'react';
import {Puck,type Data} from '@puckeditor/core';
import {initialPuckPage,puckBuilderConfig,type BuilderBlocks,type BuilderRoot} from './PuckCanvasConfig';

const STORAGE_KEY='serula-puck-page-v1';
type Page=Data<BuilderBlocks,BuilderRoot>;
const isRecord=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const names=new Set(['Heading','Text','Button','Card','Flex','Grid','Space','PartsPanel','NestingCanvas','MaterialPanel','ActionBar']);

// The free-form Puck document is stored only in the browser; it is never
// submitted as the legacy serula-design-v1 Worker document.
export function parsePuckPage(value:unknown):Page|null{
  if(!isRecord(value)||!Array.isArray(value.content)||!isRecord(value.root)||!isRecord(value.root.props))return null;
  const props=value.root.props;
  if(typeof props.title!=='string'||props.title.length>120)return null;
  for(const k of ['background','panel','accent']){
    if(typeof props[k]!=='string'||!/^#[a-f0-9]{6}$/i.test(props[k]))return null;
  }
  let blocks=0;
  const valid=(item:unknown,depth:number):boolean=>{
    if(depth>6||!isRecord(item)||typeof item.type!=='string'||!names.has(item.type)||!isRecord(item.props))return false;
    if(++blocks>80||typeof item.props.id!=='string'||item.props.id.length>160)return false;
    if(Object.values(item.props).some(v=>typeof v==='string'&&v.length>3000))return false;
    if(item.type==='Flex'||item.type==='Grid'){
      const children=item.props.items;
      return Array.isArray(children)&&children.every(child=>valid(child,depth+1));
    }
    return true;
  };
  if(!value.content.every(x=>valid(x,0)))return null;
  return value as Page;
}

function loadPage():Page{
  try{
    const stored=localStorage.getItem(STORAGE_KEY);
    if(stored&&stored.length<250_000)return parsePuckPage(JSON.parse(stored))??initialPuckPage;
  }catch{/* Restricted storage or invalid JSON: use the built-in template. */}
  return initialPuckPage;
}

export default function PuckDesignStudio({onClose}:{onClose:()=>void}){
  const [page,setPage]=useState<Page>(loadPage);
  const [generation,setGeneration]=useState(0);
  const [mode,setMode]=useState<'edit'|'preview'>('edit');
  const [device,setDevice]=useState<'desktop'|'tablet'|'mobile'>('desktop');
  const [message,setMessage]=useState('');
  const latest=useRef<Page>(page);
  const fileInput=useRef<HTMLInputElement>(null);
  const setDraft=(doc:Page,feedback=false)=>{
    const checked=parsePuckPage(doc);
    if(!checked){setMessage('Tasarım belgesi doğrulanamadı; mevcut taslak korundu.');return;}
    try{
      const serialized=JSON.stringify(checked);
      if(serialized.length>250_000)throw Error('Tasarım 250 KB sınırını geçti.');
      localStorage.setItem(STORAGE_KEY,serialized);
      latest.current=checked;
      if(feedback)setMessage('Puck taslağı bu tarayıcıya kaydedildi. Canlı Nesting ekranı değiştirilmedi.');
    }catch(e){setMessage(e instanceof Error?e.message:'Tarayıcı taslağı kaydedemedi.');}
  };
  const importPage=async(file:File)=>{
    try{
      if(file.size>250_000)throw Error('Dosya 250 KB sınırını aşıyor.');
      const parsed=parsePuckPage(JSON.parse(await file.text()));
      if(!parsed)throw Error('Dosya geçerli bir Puck tasarımı değil.');
      setPage(parsed);setGeneration(n=>n+1);setDraft(parsed,true);
    }catch(e){setMessage(e instanceof Error?e.message:'Dosya açılamadı.');}
  };
  const exportPage=()=>{
    const blob=new Blob([JSON.stringify(latest.current,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;anchor.download='serula-puck-tasarim.json';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const reset=()=>{
    if(!window.confirm('Bu tarayıcıdaki Puck düzenini varsayılana sıfırlamak istiyor musun?'))return;
    const fresh=JSON.parse(JSON.stringify(initialPuckPage)) as Page;
    setPage(fresh);setGeneration(v=>v+1);setDraft(fresh,true);
  };
  const viewportWidth=device==='mobile'?390:device==='tablet'?768:1440;
  return <section className="puck-studio" aria-label="Puck görsel tasarım editörü">
    <header className="puck-studio-topbar">
      <div><strong>Puck Tasarım Editörü</strong><small>Gerçek Puck bileşen paleti · sürükle-bırak · katmanlar · özellikler</small></div>
      <nav aria-label="Tasarım görünümü">
        <button type="button" aria-pressed={mode==='edit'} onClick={()=>setMode('edit')}>Bileşen editörü</button>
        <button type="button" aria-pressed={mode==='preview'} onClick={()=>setMode('preview')}>Gerçek Nesting ekranı</button>
        <button type="button" onClick={exportPage}>JSON indir</button>
        <button type="button" onClick={()=>fileInput.current?.click()}>JSON aç</button>
        <button type="button" onClick={reset}>Sıfırla</button>
        <button type="button" onClick={onClose}>Kapat ✕</button>
        <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void importPage(file);e.currentTarget.value='';}}/>
      </nav>
    </header>
    <div className="puck-studio-hint">
      <strong>Gerçek Puck düzenleyicisi:</strong> Soldan bir bileşen ekle, çalışma alanında sürükle, sağ panelde özelliklerini değiştir.
      <span> Taslak otomatik olarak yalnızca bu tarayıcıya kaydedilir; Nesting'in canlı ekranını değiştirmez.</span>
    </div>
    {message&&<div role="status" className="puck-studio-status">{message}</div>}
    <div className="puck-studio-editor" style={{display:mode==='edit'?'block':'none'}}>
      <Puck
        key={generation}
        config={puckBuilderConfig}
        data={page}
        iframe={{enabled:false}}
        headerTitle="Nesting Tasarım Taslağı"
        dictionary={{'header-publish':'Taslağı kaydet','outline-header-title':'Katmanlar'}}
        onChange={data=>{console.info('PUCK_DOC_CHANGE',JSON.stringify({length:data.content?.length,root:data.root?.props,types:data.content?.map(item=>item.type)}));setDraft(data)}}
        onPublish={async data=>setDraft(data,true)}
        viewports={[{width:1440,label:'Masaüstü'},{width:768,label:'Tablet'},{width:390,label:'Mobil'}]}
        height="100%"
      />
    </div>
    {mode==='preview'&&<section className="puck-studio-live">
      <div className="puck-studio-devices">
        <strong>Canlı Nesting uygulaması · salt okunur karşılaştırma</strong>
        {(['desktop','tablet','mobile'] as const).map(v=><button type="button" key={v} aria-pressed={device===v} onClick={()=>setDevice(v)}>{v==='desktop'?'Masaüstü':v==='tablet'?'Tablet':'Mobil'}</button>)}
      </div>
      <div className="puck-studio-live-scroll">
        <iframe title="Gerçek Nesting ekranı" src={import.meta.env.BASE_URL+'?design-preview=1'}
          style={{width:viewportWidth,height:780,maxWidth:'none',pointerEvents:'none'}}/>
      </div>
      <p>Bu sekme mevcut Nesting'i gösterir; Puck yerleşimi henüz uygulamanın çalışma ekranına yayınlanmaz.</p>
    </section>}
  </section>;
}
