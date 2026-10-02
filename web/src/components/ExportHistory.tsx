import {useEffect,useState} from 'react';
import Modal from './Modal';

type ExportItem={
  id:number;
  projectName:string;
  sourceFileName:string;
  fileName:string;
  byteSize:number;
  createdAt:string;
};

function formatBytes(bytes:number){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
function formatDate(value:string){
  const normalized=/Z$|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z';
  const date=new Date(normalized);
  return Number.isNaN(date.getTime())?value:date.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});
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
  const [items,setItems]=useState<ExportItem[]>([]);
  const [busy,setBusy]=useState<number|0>(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/exports',{credentials:'same-origin',cache:'no-store'});
      if(response.status===401){window.dispatchEvent(new Event('serula-login-required'));onClose();return}
      if(!response.ok)throw Error(await responseError(response,'Geçmiş yüklenemedi.'));
      const data=await response.json();
      setItems(Array.isArray(data.items)?data.items:[]);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  async function downloadItem(item:ExportItem){
    setBusy(item.id);setError('');
    try{
      const response=await fetch('/api/exports/'+item.id,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error(await responseError(response,'DXF indirilemedi.'));
      saveBlob(item.fileName,await response.blob());
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(0)}
  }
  async function openItem(item:ExportItem){
    setBusy(item.id);setError('');
    try{
      const response=await fetch('/api/exports/'+item.id+'?kind=project',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error(await responseError(response,'Proje kaydı açılamadı.'));
      const text=await response.text();
      const projectFile=item.fileName.replace(/\.dxf$/i,'')+'.sparrow-project.json';
      await onOpen(projectFile,text);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(0)}
  }
  async function deleteItem(item:ExportItem){
    if(!window.confirm(`${item.fileName} geçmişten silinsin mi?`))return;
    setBusy(item.id);setError('');
    try{
      const response=await fetch('/api/exports/'+item.id,{method:'DELETE',credentials:'same-origin'});
      if(!response.ok)throw Error(await responseError(response,'Kayıt silinemedi.'));
      setItems(previous=>previous.filter(entry=>entry.id!==item.id));
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(0)}
  }

  return <Modal title="Geçmiş" onClose={onClose} locked={!!busy}>
    <div className="export-history">
      <div className="export-history-head"><div><strong>Bulut kayıtları</strong><small>DXF indirdiğinizde dosya ve proje durumu hesabınıza otomatik kaydedilir.</small></div><button disabled={loading||!!busy} onClick={()=>void load()}>Yenile</button></div>
      {error&&<p role="alert" className="field-error">{error}</p>}
      {loading?<p className="muted">Geçmiş yükleniyor…</p>:!items.length?<div className="export-history-empty"><strong>Henüz kayıt yok</strong><span>İlk DXF indirmenizden sonra burada görünecek.</span></div>:<div className="export-history-list">{items.map(item=><article className="export-history-item" key={item.id}>
        <div className="export-history-file"><strong>{item.fileName}</strong><span>{item.projectName||item.sourceFileName||'Serula projesi'}</span><small>{formatDate(item.createdAt)} · {formatBytes(item.byteSize)}</small></div>
        <div className="export-history-actions"><button disabled={!!busy} onClick={()=>void openItem(item)}>{busy===item.id?'Bekleyin…':'Aç'}</button><button disabled={!!busy} onClick={()=>void downloadItem(item)}>İndir</button><button className="danger-button" disabled={!!busy} onClick={()=>void deleteItem(item)}>Sil</button></div>
      </article>)}</div>}
      <div className="modal-actions"><button disabled={!!busy} onClick={onClose}>Kapat</button></div>
    </div>
  </Modal>;
}
