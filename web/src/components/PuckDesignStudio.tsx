import {useEffect,useRef,useState} from 'react';
import {Puck,type Config,type Data} from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import {DESIGN_ZONES,type DesignZone} from './design-zone-styles';
import {
  DEFAULT_STUDIO_DESIGN,PUCK_ZONE_NAMES,fromPuckData,loadStudioDesign,
  parseStudioDesign,toPuckData,type StudioDesign
} from './puck-design-adapter';
import './PuckDesignStudio.css';

type ZoneProps={
  zone:DesignZone;background?:string;color?:string;radius?:number;spacing?:number;
  fontSize?:number;shadow?:number;text?:string;offsetX?:number;offsetY?:number;
};
type RootProps={background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;heading:string};
type Components={Zone:ZoneProps};
const colorField=(label:string)=>({
  type:'custom' as const,label,
  render:({value,onChange}:{value?:string;onChange:(value:string)=>void})=><input type="color" aria-label={label} value={typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)?value:'#ffffff'} onChange={e=>onChange(e.currentTarget.value)}/>
});
const config:Config<Components,RootProps>={
  components:{
    Zone:{
      label:'Nesting bileşeni',
      fields:{
        zone:{type:'text',label:'Sabit bileşen kimliği'},
        text:{type:'text',label:'Bölüm veya buton başlığı'},
        background:colorField('Arka plan'),
        color:colorField('Yazı rengi'),
        radius:{type:'number',label:'Köşe (px)',min:0,max:32},
        spacing:{type:'number',label:'İç boşluk (px)',min:0,max:48},
        fontSize:{type:'number',label:'Yazı boyutu (px)',min:11,max:24},
        shadow:{type:'number',label:'Gölge',min:0,max:32},
        offsetX:{type:'number',label:'Buton yatay konum (px)',min:-80,max:80},
        offsetY:{type:'number',label:'Buton dikey konum (px)',min:-80,max:80}
      },
      resolvePermissions:({props})=>({drag:['parts','canvas','material'].includes(props.zone)}),
      render:({zone,text,background,color,radius,spacing,fontSize,shadow,offsetX,offsetY})=>{
        const button=['runButton','corelButton','downloadButton'].includes(zone);
        const label=PUCK_ZONE_NAMES[zone]??'Bileşen';
        const content=text||label;
        const style={
          background:background||'#ffffff',color:color||'#1e293b',
          borderRadius:radius??12,padding:spacing??14,fontSize:fontSize??14,
          boxShadow:shadow?'0 '+Math.round(shadow/3)+'px '+shadow+'px rgba(15,23,42,.20)':'none',
          transform:button?'translate('+(offsetX??0)+'px,'+(offsetY??0)+'px)':undefined
        };
        return <section className={'puck-zone-card'+(button?' puck-zone-action':'')} style={style}>
          <small>{label}</small>
          {button?<button type="button" tabIndex={-1} aria-hidden="true">{content}</button>:<strong>{content}</strong>}
          {zone==='canvas'&&<div className="puck-zone-canvas" aria-hidden="true"><span/><span/><span/></div>}
          {zone==='parts'&&<div className="puck-zone-lines" aria-hidden="true"><span/><span/><span/></div>}
        </section>;
      }
    }
  },
  root:{
    fields:{
      heading:{type:'text',label:'Çalışma alanı başlığı'},
      background:colorField('Sayfa rengi'),
      panel:colorField('Panel rengi'),
      accent:colorField('Vurgu rengi'),
      radius:{type:'number',label:'Genel köşe',min:0,max:32},
      spacing:{type:'number',label:'Genel boşluk',min:8,max:40},
      fontSize:{type:'number',label:'Genel yazı boyutu',min:12,max:22}
    },
    render:({children,heading,background,panel,accent})=>
      <div className="puck-mock-page" style={{background:background||'#f5f6f8',borderColor:panel||'#ddd'}}>
        <header><strong>{heading||'Nesting Studio'}</strong><span style={{background:accent||'#5278ed'}}/></header>
        <div className="puck-mock-zones">{children}</div>
        <p>Bu alan bileşen düzenleme yüzeyidir. Gerçek Nesting ekranını üstteki “Gerçek ekran” sekmesinden kontrol et.</p>
      </div>
  }
};
type Version={id:number;created_at:string};
type Publication={id:number;action:string;source_revision:number|null;created_at:string};
const PREVIEW_KEY='serula-design-studio-live-preview-v1';
const DRAFT_KEY='serula-design-studio-draft-v1';
export default function PuckDesignStudio({onClose}:{onClose:()=>void}){
  const [initial]=useState<StudioDesign>(()=>loadStudioDesign());
  const [snapshot,setSnapshot]=useState(()=>toPuckData(initial));
  const [generation,setGeneration]=useState(0);
  const latest=useRef<StudioDesign>(initial);
  const frame=useRef<HTMLIFrameElement|null>(null);
  const [view,setView]=useState<'edit'|'live'>('edit');
  const [status,setStatus]=useState('');
  const [saving,setSaving]=useState(false);
  const [versions,setVersions]=useState<Version[]>([]);
  const [publications,setPublications]=useState<Publication[]>([]);
  const [releaseId,setReleaseId]=useState('');
  const [rollbackId,setRollbackId]=useState('');
  const [device,setDevice]=useState<'desktop'|'tablet'|'mobile'>('desktop');
  const [showHistory,setShowHistory]=useState(false);
  const putPreview=(design:StudioDesign)=>{
    latest.current=design;
    try{
      localStorage.setItem(DRAFT_KEY,JSON.stringify(design));
      localStorage.setItem(PREVIEW_KEY,JSON.stringify(design));
      frame.current?.contentWindow?.postMessage('serula-design-preview-refresh',window.location.origin);
    }catch{setStatus('Tarayıcı taslağı kaydedemedi. Tasarım verilerini dışa aktarmadan bu sayfayı kapatma.');}
  };
  const refresh=async()=>{
    const [vr,pr]=await Promise.all([
      fetch('/api/admin/design/versions',{credentials:'same-origin',cache:'no-store'}),
      fetch('/api/admin/design/publications',{credentials:'same-origin',cache:'no-store'})
    ]);
    if(vr.ok)setVersions(((await vr.json()) as {versions?:Version[]}).versions??[]);
    if(pr.ok)setPublications(((await pr.json()) as {publications?:Publication[]}).publications??[]);
  };
  useEffect(()=>{putPreview(initial);void refresh().catch(()=>{});},[]);
  const restore=(design:StudioDesign)=>{
    putPreview(design);
    setSnapshot(toPuckData(design));
    setGeneration(v=>v+1); // Puck initial data only updates on remount.
  };
  const onChange=(data:Data<Components,RootProps>)=>{
    const next=fromPuckData(data,latest.current);
    if(!next){setStatus('Geçersiz bileşen değişikliği engellendi. Taslak değiştirilmedi.');return;}
    putPreview(next);
    setStatus('Değişiklikler yalnızca bu tarayıcıda. Canlı site etkilenmedi.');
  };
  const onSave=async(data:Data<Components,RootProps>)=>{
    const design=fromPuckData(data,latest.current);
    if(!design)throw Error('Bileşen listesi geçersiz; taslak kaydedilmedi.');
    setSaving(true);
    try{
      const response=await fetch('/api/admin/design/draft',{
        method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
        body:JSON.stringify({format:'serula-design-v1',design})
      });
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw Error(result.error||'Taslak kaydedilemedi.');
      putPreview(design);
      await refresh();
      setStatus('Sunucu taslağı kaydedildi. Henüz yayınlanmadı.');
    }catch(e){
      setStatus(e instanceof Error?e.message:'Kayıt başarısız.');
      throw e;
    }finally{setSaving(false);}
  };
  const loadServer=async()=>{
    if(!window.confirm('Sunucu taslağı mevcut yerel değişikliklerin yerine yüklensin mi?'))return;
    setSaving(true);
    try{
      const response=await fetch('/api/admin/design/draft',{credentials:'same-origin',cache:'no-store'});
      const json=await response.json() as {draft?:{design?:unknown}|null;error?:string};
      if(!response.ok)throw Error(json.error||'Sunucu taslağı açılamadı.');
      const design=parseStudioDesign(json.draft?.design);
      if(!design)throw Error('Sunucuda geçerli taslak yok.');
      restore(design);setStatus('Sunucu taslağı yüklendi; canlı site değişmedi.');
    }catch(e){setStatus(e instanceof Error?e.message:'Yükleme başarısız.');}
    finally{setSaving(false);}
  };
  const publish=async(kind:'publish'|'rollback')=>{
    const id=Number(kind==='publish'?releaseId:rollbackId);
    if(!Number.isSafeInteger(id)||id<=0)return;
    const confirmText=kind==='publish'?'YAYINLA':'GERI AL';
    if(!window.confirm(kind==='publish'?'Seçilen sunucu sürümü tüm kullanıcılara uygulansın mı?':'Önceki canlı yayına dönülsün mü?'))return;
    if(window.prompt('Onay için '+confirmText+' yaz:')!==confirmText)return;
    setSaving(true);
    try{
      const response=await fetch('/api/admin/design/'+kind,{
        method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},
        body:JSON.stringify(kind==='publish'?{versionId:id,confirmation:confirmText}:{publicationId:id,confirmation:confirmText})
      });
      const json=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw Error(json.error||'Yayın işlemi başarısız.');
      await refresh();setStatus(kind==='publish'?'Seçili sürüm yayınlandı.':'Seçili eski yayın geri yüklendi.');
    }catch(e){setStatus(e instanceof Error?e.message:'Yayın işlemi başarısız.');}
    finally{setSaving(false);}
  };
  const resetUnsaved=()=>{
    if(!window.confirm('Kaydedilmemiş tasarım değişiklikleri sıfırlansın mı?'))return;
    restore(DEFAULT_STUDIO_DESIGN);
    setStatus('Bu tarayıcının taslağı sıfırlandı. Sunucu kayıtları ve canlı yayın değişmedi.');
  };
  const liveWidth=device==='desktop'?1440:device==='tablet'?768:390;
  return <section className="puck-studio" aria-label="Puck görsel tasarım editörü">
    <header className="puck-studio-topbar">
      <div><strong>Puck Tasarım Editörü</strong><small>Güvenli Nesting bileşenleri · taslak</small></div>
      <nav aria-label="Tasarım görünümü">
        <button type="button" aria-pressed={view==='edit'} onClick={()=>setView('edit')}>Bileşen editörü</button>
        <button type="button" aria-pressed={view==='live'} onClick={()=>setView('live')}>Gerçek ekran</button>
        <button type="button" onClick={()=>setShowHistory(x=>!x)}>Sürümler ve yayın</button>
        <button type="button" onClick={onClose}>Kapat ✕</button>
      </nav>
    </header>
    {status&&<div className="puck-studio-status" role="status">{status}</div>}
    {showHistory&&<div className="puck-studio-history">
      <button type="button" disabled={saving} onClick={()=>void loadServer()}>Sunucu taslağını aç</button>
      <button type="button" disabled={saving} onClick={resetUnsaved}>Yerel değişiklikleri sıfırla</button>
      <label>Yayın sürümü <select aria-label="Yayın sürümü" value={releaseId} onChange={e=>setReleaseId(e.target.value)}><option value="">Seç</option>{versions.map(v=><option value={v.id} key={v.id}>#{v.id} · {v.created_at}</option>)}</select></label>
      <button type="button" disabled={saving||!releaseId} onClick={()=>void publish('publish')}>Onaylı yayınla</button>
      <label>Eski yayın <select aria-label="Eski yayın" value={rollbackId} onChange={e=>setRollbackId(e.target.value)}><option value="">Seç</option>{publications.map(v=><option value={v.id} key={v.id}>#{v.id} · {v.created_at}</option>)}</select></label>
      <button type="button" disabled={saving||!rollbackId} onClick={()=>void publish('rollback')}>Önceki yayına dön</button>
    </div>}
    <div className="puck-studio-editor" style={{display:view==='edit'?'block':'none'}}>
      <Puck
        key={generation}
        config={config}
        data={snapshot as Data<Components,RootProps>}
        headerTitle="Nesting Bileşenleri"
        dictionary={{'header-publish':'Sunucu taslağını kaydet'}}
        onChange={onChange}
        onPublish={onSave}
        permissions={{insert:false,delete:false,duplicate:false}}
        viewports={[{width:1440,label:'Masaüstü'},{width:768,label:'Tablet'},{width:390,label:'Mobil'}]}
        height="100%"
      />
    </div>
    {view==='live'&&<div className="puck-studio-live">
      <div className="puck-studio-devices">
        <strong>Gerçek Nesting ekranı · yalnızca önizleme</strong>
        {(['desktop','tablet','mobile'] as const).map(v=><button type="button" key={v} aria-pressed={device===v} onClick={()=>setDevice(v)}>{v==='desktop'?'Masaüstü':v==='tablet'?'Tablet':'Mobil'}</button>)}
      </div>
      <div className="puck-studio-live-scroll">
        <iframe ref={frame} title="Puck gerçek Nesting önizlemesi" src={import.meta.env.BASE_URL+'?design-preview=1'}
          style={{width:liveWidth,height:780,maxWidth:'none',pointerEvents:'none'}}
          onLoad={()=>frame.current?.contentWindow?.postMessage('serula-design-preview-refresh',window.location.origin)}/>
      </div>
      <p>Bu ekran etkileşimsizdir. Mevcut Nesting işlevleri ve kullanıcı projeleri etkilenmez.</p>
    </div>}
  </section>;
}
