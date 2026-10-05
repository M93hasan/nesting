import {useEffect,useState} from 'react';
import {localeTag,useI18n} from '../i18n';
import Modal from './Modal';

type ExportItem={
  id:number;
  projectName:string;
  sourceFileName:string;
  fileName:string;
  byteSize:number;
  createdAt:string;
};
type CloudItem={
  label:string;
  projectName:string;
  byteSize:number;
  updatedAt:string;
};

function formatBytes(bytes:number){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
function formatDate(value:string,locale:string){
  const normalized=/Z$|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z';
  const date=new Date(normalized);
  return Number.isNaN(date.getTime())?value:date.toLocaleString(locale,{dateStyle:'short',timeStyle:'short'});
}
async function responseError(response:Response,fallback:string){
  const data=await response.json().catch(()=>({}));
  return String(data.error||fallback);
}
function saveBlob(name:string,blob:Blob){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ExportHistory({onClose,onOpen}:{onClose:()=>void;onOpen:(name:string,projectText:string)=>Promise<void>}){
  const {locale}=useI18n();const dateLocale=localeTag(locale);
  const [items,setItems]=useState<ExportItem[]>([]);
  const [cloud,setCloud]=useState<CloudItem|null>(null);
  const [busy,setBusy]=useState<string>('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    try{
      const [cloudResponse,exportsResponse]=await Promise.all([
        fetch('/api/project/autosave',{credentials:'same-origin',cache:'no-store'}),
        fetch('/api/exports',{credentials:'same-origin',cache:'no-store'})
      ]);
      if(cloudResponse.status===401||exportsResponse.status===401){window.dispatchEvent(new Event('serula-login-required'));onClose();return}
      if(!cloudResponse.ok)throw Error(await responseError(cloudResponse,'Bulut proje kaydı yüklenemedi.'));
      if(!exportsResponse.ok)throw Error(await responseError(exportsResponse,'Geçmiş yüklenemedi.'));
      const [cloudData,exportsData]=await Promise.all([cloudResponse.json(),exportsResponse.json()]);
      setCloud(cloudData.item??null);
      setItems(Array.isArray(exportsData.items)?exportsData.items:[]);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  async function fetchCloudText(){
    const response=await fetch('/api/project/autosave?content=1',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw Error(await responseError(response,'Bulut proje kaydı açılamadı.'));
    return response.text();
  }
  async function openCloud(){
    if(!cloud)return;
    setBusy('cloud');setError('');
    try{await onOpen('Serula Nesting En Temiz Hali.sparrow-project.json',await fetchCloudText())}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy('')}
  }
  async function downloadCloud(){
    if(!cloud)return;
    setBusy('cloud');setError('');
    try{saveBlob('Serula Nesting En Temiz Hali.sparrow-project.json',new Blob([await fetchCloudText()],{type:'application/json'}))}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy('')}
  }
  async function downloadItem(item:ExportItem){
    setBusy('export-'+item.id);setError('');
    try{
      const response=await fetch('/api/exports/'+item.id,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error(await responseError(response,'DXF indirilemedi.'));
      saveBlob(item.fileName,await response.blob());
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy('')}
  }
  async function openItem(item:ExportItem){
    setBusy('export-'+item.id);setError('');
    try{
      const response=await fetch('/api/exports/'+item.id+'?kind=project',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error(await responseError(response,'Proje kaydı açılamadı.'));
      const text=await response.text();
      const projectFile=item.fileName.replace(/\.dxf$/i,'')+'.sparrow-project.json';
      await onOpen(projectFile,text);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy('')}
  }
  async function deleteItem(item:ExportItem){
    if(!window.confirm(`${item.fileName} geçmişten silinsin mi?`))return;
    setBusy('export-'+item.id);setError('');
    try{
      const response=await fetch('/api/exports/'+item.id,{method:'DELETE',credentials:'same-origin'});
      if(!response.ok)throw Error(await responseError(response,'Kayıt silinemedi.'));
      setItems(previous=>previous.filter(entry=>entry.id!==item.id));
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy('')}
  }

  return <Modal title="Geçmiş" onClose={onClose} locked={!!busy}>
    <div className="export-history">
      <div className="export-history-head"><div><strong>Bulut kayıtları</strong><small>Çalışma değiştikçe son temiz proje durumu otomatik kaydedilir; DXF exportları ayrıca geçmişte tutulur.</small></div><button disabled={loading||!!busy} onClick={()=>void load()}>Yenile</button></div>
      {error&&<p role="alert" className="field-error">{error}</p>}
      {loading?<p className="muted">Geçmiş yükleniyor…</p>:<>
        {cloud&&<article className="export-history-item export-history-latest">
          <div className="export-history-file"><strong>{cloud.label}</strong><span>{cloud.projectName||'Serula projesi'} · otomatik bulut kaydı</span><small>{formatDate(cloud.updatedAt,dateLocale)} · {formatBytes(cloud.byteSize)}</small></div>
          <div className="export-history-actions"><button disabled={!!busy} onClick={()=>void openCloud()}>{busy==='cloud'?'Bekleyin…':'Aç'}</button><button disabled={!!busy} onClick={()=>void downloadCloud()}>Proje indir</button></div>
        </article>}
        {!cloud&&!items.length?<div className="export-history-empty"><strong>Henüz kayıt yok</strong><span>Giriş yaptıktan sonra proje değişiklikleri otomatik olarak burada saklanır.</span></div>:<div className="export-history-list">{items.map(item=><article className="export-history-item" key={item.id}>
          <div className="export-history-file"><strong>{item.fileName}</strong><span>{item.projectName||item.sourceFileName||'Serula projesi'} · DXF dışa aktarma</span><small>{formatDate(item.createdAt,dateLocale)} · {formatBytes(item.byteSize)}</small></div>
          <div className="export-history-actions"><button disabled={!!busy} onClick={()=>void openItem(item)}>{busy==='export-'+item.id?'Bekleyin…':'Aç'}</button><button disabled={!!busy} onClick={()=>void downloadItem(item)}>DXF indir</button><button className="danger-button" disabled={!!busy} onClick={()=>void deleteItem(item)}>Sil</button></div>
        </article>)}</div>}
      </>}
      <div className="modal-actions"><button disabled={!!busy} onClick={onClose}>Kapat</button></div>
    </div>
  </Modal>;
}
