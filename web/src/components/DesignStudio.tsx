import {useEffect,useRef,useState} from 'react';
import './DesignStudio.css';

type Design = {background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;heading:string};
const initial:Design={background:'#121421',panel:'#242935',accent:'#5278ed',radius:12,spacing:16,fontSize:15,heading:'Serula çalışma alanı'};
type Device='desktop'|'tablet'|'mobile';
const samples=['Başlık','Ana panel','Birincil buton'] as const;
const DRAFT_KEY='serula-design-studio-draft-v1';
function validDraft(value:unknown):value is Design{
  if(!value||typeof value!=='object')return false;
  const d=value as Partial<Design>;
  return ['background','panel','accent'].every(key=>typeof d[key as keyof Design]==='string'&&/^#[0-9a-f]{6}$/i.test(d[key as keyof Design] as string))
    &&typeof d.heading==='string'&&d.heading.length<=80
    &&([['radius',0,32],['spacing',8,40],['fontSize',12,22]] as const).every(([key,min,max])=>typeof d[key]==='number'&&Number.isFinite(d[key])&&d[key]>=min&&d[key]<=max);
}
function loadDraft():Design{
  try{const raw=localStorage.getItem(DRAFT_KEY);if(!raw)return initial;const data:unknown=JSON.parse(raw);return validDraft(data)?data:initial;}
  catch{return initial;}
}

export default function DesignStudio({onClose}:{onClose:()=>void}){
  const [history,setHistory]=useState<Design[]>(()=>[loadDraft()]);
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<(typeof samples)[number]>('Ana panel');
  const [device,setDevice]=useState<Device>('desktop');
  const [saved,setSaved]=useState(false);
  const [storageError,setStorageError]=useState('');
  const saveDraft=()=>{
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(design));setSaved(true);setStorageError('');}
    catch{setSaved(false);setStorageError('Tarayıcı taslağı kaydedemedi.');}
  };
  const design=history[index];
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
        <button type="button" onClick={saveDraft}>Taslağı tarayıcıya kaydet</button>
        <button type="button" onClick={reset}>Taslağı sıfırla</button>
        <button type="button" onClick={onClose}>Görünüme dön</button>
      </div>
    </header>
    <p className="design-studio-warning" role="status">Bu prototip yalnızca örnek bileşenleri düzenler. Taslağı bu tarayıcıya kaydedebilirsin; başka cihazlara aktarılmaz ve canlı siteye yayınlanmaz. {saved?'Taslak tarayıcıya kaydedildi.':''}{storageError}</p>
    <div className="design-studio-workspace">
      <aside className="design-studio-pane" aria-label="Katmanlar">
        <h3>Katmanlar</h3>
        {samples.map(item=><button type="button" key={item} aria-pressed={selected===item} className={selected===item?'design-selected':''} onClick={()=>setSelected(item)}>{item}</button>)}
      </aside>
      <div className="design-studio-center">
        <div className="design-device-switch" role="group" aria-label="Cihaz önizleme">
          {(['desktop','tablet','mobile'] as const).map(item=><button type="button" key={item} aria-pressed={device===item} onClick={()=>setDevice(item)}>{({desktop:'Masaüstü',tablet:'Tablet',mobile:'Mobil'} as const)[item]}</button>)}
        </div>
        <div className={'design-preview design-preview-'+device} style={{background:design.background,color:'#fff',fontSize:design.fontSize}}>
          <h2 className={selected==='Başlık'?'design-preview-selected':''} onClick={()=>setSelected('Başlık')}>{design.heading}</h2>
          <div className={selected==='Ana panel'?'design-preview-panel design-preview-selected':'design-preview-panel'} onClick={()=>setSelected('Ana panel')} style={{background:design.panel,borderRadius:design.radius,padding:design.spacing}}>
            <strong>Örnek çalışma paneli</strong>
            <p>Bu alan yalnızca tasarım önizlemesidir. Gerçek hesaplamalar ve kullanıcı verileri değişmez.</p>
            <button type="button" className={selected==='Birincil buton'?'design-preview-selected':''} onClick={event=>{event.stopPropagation();setSelected('Birincil buton');}} style={{background:design.accent,borderRadius:Math.min(design.radius,20),color:'#fff',border:0,padding:'10px 16px'}}>Örnek buton</button>
          </div>
        </div>
      </div>
      <aside className="design-studio-pane design-studio-properties" aria-label="Özellikler">
        <h3>Özellikler</h3>
        <p>Seçili öğe: <strong>{selected}</strong></p>
        <label>Arka plan <input type="color" value={design.background} onChange={e=>apply({background:e.target.value})}/></label>
        <label>Panel rengi <input type="color" value={design.panel} onChange={e=>apply({panel:e.target.value})}/></label>
        <label>Vurgu rengi <input type="color" value={design.accent} onChange={e=>apply({accent:e.target.value})}/></label>
        <label>Köşe yuvarlama: {design.radius}px <input type="range" min="0" max="32" value={design.radius} onChange={e=>apply({radius:Number(e.target.value)})}/></label>
        <label>İç boşluk: {design.spacing}px <input type="range" min="8" max="40" value={design.spacing} onChange={e=>apply({spacing:Number(e.target.value)})}/></label>
        <label>Yazı boyutu: {design.fontSize}px <input type="range" min="12" max="22" value={design.fontSize} onChange={e=>apply({fontSize:Number(e.target.value)})}/></label>
        <label>Başlık <input type="text" maxLength={80} value={design.heading} onChange={e=>apply({heading:e.target.value})}/></label>
      </aside>
    </div>
  </section>;
}
