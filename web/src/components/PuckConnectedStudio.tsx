import {useRef,useState} from 'react';
import {Puck} from '@puckeditor/core';
import {
  connectedPuckConfig,initialConnectedPage,parseConnectedPage,toNestingDesign,
  type ConnectedPage
} from './PuckNestingConnection';

const STORAGE_KEY='serula-puck-real-nesting-v1';
const PREVIEW_KEY='serula-design-studio-live-preview-v1';
function load():ConnectedPage{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw&&raw.length<250_000)return parseConnectedPage(JSON.parse(raw))??initialConnectedPage;}
  catch{/* Invalid or unavailable local storage: start with safe default. */}
  return initialConnectedPage;
}
function refreshRealPreview(){
  for(const frame of document.querySelectorAll<HTMLIFrameElement>('iframe[title="Gerçek Nesting canlı önizleme"]'))
    frame.contentWindow?.postMessage('serula-design-preview-refresh',window.location.origin);
}
export default function PuckConnectedStudio({onClose}:{onClose:()=>void}){
  const [page,setPage]=useState(load);
  const latest=useRef(page);
  const [generation,setGeneration]=useState(0);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState<number|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const saveBrowser=(value:ConnectedPage,show=false):boolean=>{
    const valid=parseConnectedPage(value);
    if(!valid){setNotice('Gerçek Nesting bölgeleri zorunludur: bölgeyi silmeyin veya çoğaltmayın.');return false;}
    try{
      const serialized=JSON.stringify(valid);
      if(serialized.length>250_000)throw Error('Tasarım boyut sınırını aştı.');
      localStorage.setItem(STORAGE_KEY,serialized);
      localStorage.setItem(PREVIEW_KEY,JSON.stringify(toNestingDesign(valid)));
      latest.current=valid;
      refreshRealPreview();
      if(show)setNotice('Gerçek Nesting önizlemesi güncellendi; değişiklikler henüz canlıya yayınlanmadı.');
      return true;
    }catch(e){setNotice(e instanceof Error?e.message:'Tarayıcı taslağı kaydedemedi.');return false;}
  };
  // Puck's data is not executable markup; only the allowlisted visual zones
  // are converted into the versioned Nesting server format.
  const saveServer=async(value:ConnectedPage)=>{
    if(!saveBrowser(value))return;
    setBusy(true);setNotice('');
    try{
      const design=toNestingDesign(value);
      const response=await fetch('/api/admin/design/draft',{
        method:'POST',credentials:'same-origin',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({format:'serula-design-v1',design})
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error??'Sunucu taslağı kaydedilemedi.');
      const revisions=await fetch('/api/admin/design/versions',{credentials:'same-origin',cache:'no-store'});
      const result=await revisions.json() as {versions?:{id:number}[];error?:string};
      if(!revisions.ok)throw Error(result.error??'Kaydedilen sürüm doğrulanamadı.');
      setRevision(result.versions?.[0]?.id??null);
      setNotice('Nesting taslağı güvenli biçimde sunucuya kaydedildi. Canlı ekran henüz değişmedi.');
    }catch(e){setRevision(null);setNotice(e instanceof Error?e.message:'Taslak kaydı başarısız.');}
    finally{setBusy(false);}
  };
  const publish=async()=>{
    if(!revision||busy){setNotice('Önce bu taslağı sunucuya kaydet.');return;}
    if(!window.confirm('Bu düzen bütün kullanıcıların gerçek Nesting ekranına uygulanacak. Devam edilsin mi?'))return;
    if(window.prompt('Canlı yayın için YAYINLA yaz:')!=='YAYINLA'){setNotice('Yayın iptal edildi.');return;}
    setBusy(true);
    try{
      const response=await fetch('/api/admin/design/publish',{
        method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
        body:JSON.stringify({versionId:revision,confirmation:'YAYINLA'})
      });
      const result=await response.json() as {error?:string};
      if(!response.ok)throw Error(result.error??'Canlı yayın başarısız.');
      setRevision(null);
      setNotice('Yayın kaydedildi. Normal Nesting ekranı yeni tasarımı bir sonraki açılışında veya odaklanmada yükler.');
    }catch(e){setNotice(e instanceof Error?e.message:'Canlı yayın başarısız.');}
    finally{setBusy(false);}
  };
  const reset=()=>{
    if(!window.confirm('Gerçek Nesting taslak düzeni varsayılana sıfırlansın mı? Yayınlanmış sürüm değişmez.'))return;
    const copy=JSON.parse(JSON.stringify(initialConnectedPage)) as ConnectedPage;
    setPage(copy);setGeneration(n=>n+1);setRevision(null);saveBrowser(copy,true);
  };
  const exportJson=()=>{
    const value=JSON.stringify(latest.current,null,2),url=URL.createObjectURL(new Blob([value],{type:'application/json'}));
    const a=document.createElement('a');a.download='nesting-puck-connected.json';a.href=url;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importJson=async(file:File)=>{
    try{
      if(file.size>250_000)throw Error('Dosya boyutu 250 KB sınırını aşıyor.');
      const parsed=parseConnectedPage(JSON.parse(await file.text()));
      if(!parsed)throw Error('Geçerli bir Nesting bölge belgesi değil.');
      setPage(parsed);setGeneration(n=>n+1);setRevision(null);saveBrowser(parsed,true);
    }catch(e){setNotice(e instanceof Error?e.message:'JSON yüklenemedi.');}
  };
  return <section className="puck-studio puck-connected-studio" aria-label="Gerçek Nesting Puck editörü">
    <div className="puck-studio-desktop-required">Bu editör yalnızca geniş ekranlı PC tarayıcılarında kullanılabilir.</div>
    <div className="puck-studio-desktop-content">
      <header className="puck-studio-topbar">
        <div><strong>Gerçek Nesting · Puck</strong><small>8 gerçek görünüm bölgesi bağlı · sunucu taslakları · canlı önizleme</small></div>
        <nav>
          <button type="button" disabled={busy} onClick={()=>void saveServer(latest.current)}>Sunucu taslağına kaydet</button>
          <button type="button" disabled={busy||revision===null} onClick={()=>void publish()}>Canlıya yayınla</button>
          <button type="button" onClick={exportJson}>JSON indir</button>
          <button type="button" onClick={()=>fileInput.current?.click()}>JSON aç</button>
          <button type="button" onClick={reset}>Sıfırla</button>
          <button type="button" onClick={onClose}>Kapat ✕</button>
          <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void importJson(file);e.currentTarget.value='';}}/>
        </nav>
      </header>
      <div className="puck-studio-hint">
        <strong>Gerçek Nesting bağlantısı:</strong> Bileşene tıklayıp sağdaki Puck özellik panelinden düzenle.
        <span> Ortada orijinal Nesting uygulaması bulunur. Değişiklikler önce gerçek ekranda önizlenir; yalnızca onaydan sonra yayınlanır.</span>
      </div>
      {notice&&<div className="puck-studio-status" role="status">{notice}</div>}
      <div className="puck-studio-editor">
        <Puck key={generation}
          config={connectedPuckConfig}
          data={page}
          iframe={{enabled:false}}
          viewports={[{width:1440,label:'PC'}]}
          headerTitle="Gerçek Nesting görünümü"
          dictionary={{'header-publish':'Sunucu taslağına kaydet','outline-header-title':'Gerçek paneller'}}
          onChange={value=>{if(saveBrowser(value)){setRevision(null);}}}
          onPublish={async value=>saveServer(value)}
          height="100%"
        />
      </div>
    </div>
  </section>;
}
