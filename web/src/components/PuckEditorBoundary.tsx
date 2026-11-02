import {Component,type ReactNode} from 'react';

type Props={children:ReactNode;onClose:()=>void;onLegacy:()=>void};
type State={message:string|null};

const frameStyle={
  position:'fixed' as const,inset:0,zIndex:3000,background:'#f5f7fb',
  display:'grid',placeItems:'center',padding:24,color:'#18243a'
};

/**
 * A failed Vite lazy import previously had no error boundary. In production
 * this can unmount the whole admin UI, leaving the editor button looking broken.
 * Keep the admin usable and offer a safe way back without clearing drafts.
 */
export default class PuckEditorBoundary extends Component<Props,State>{
  state:State={message:null};
  static getDerivedStateFromError(error:unknown):State{
    return {message:error instanceof Error?error.message:String(error)};
  }
  componentDidCatch(error:unknown){
    console.error('Puck editor failed to initialize:',error);
  }
  render(){
    if(!this.state.message)return this.props.children;
    return <section aria-label="Puck editör yükleme hatası" role="alert" style={frameStyle}>
      <div style={{maxWidth:550,width:'100%',padding:28,background:'#fff',border:'1px solid #d9e1ee',borderRadius:14,boxShadow:'0 16px 54px #13213b1c'}}>
        <h1 style={{fontSize:23,margin:'0 0 12px'}}>Puck Editor açılamadı</h1>
        <p style={{lineHeight:1.6,margin:'0 0 12px'}}>Editör dosyası yüklenirken veya açılırken bir sorun oluştu. Mevcut tasarımlar ve sunucudaki kayıtlar silinmedi.</p>
        <details style={{marginBottom:20}}>
          <summary>Hata ayrıntısı</summary>
          <code style={{display:'block',overflowWrap:'anywhere',whiteSpace:'pre-wrap',padding:'9px 0'}}>{this.state.message}</code>
        </details>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button type="button" onClick={()=>window.location.reload()} style={{padding:'10px 14px',background:'#3759c9',color:'white',border:'none',borderRadius:8}}>Yeniden yükle</button>
          <button type="button" onClick={this.props.onLegacy} style={{padding:'10px 14px',background:'#fff',color:'#24314b',border:'1px solid #ccd5e5',borderRadius:8}}>Eski editöre geç</button>
          <button type="button" onClick={this.props.onClose} style={{padding:'10px 14px',background:'#fff',color:'#24314b',border:'1px solid #ccd5e5',borderRadius:8}}>Yönetim paneline dön</button>
        </div>
      </div>
    </section>;
  }
}

export function PuckLoadingFallback({onClose}:{onClose:()=>void}){
  return <section role="status" aria-label="Puck editör yükleniyor" style={frameStyle}>
    <div style={{padding:24,background:'#fff',borderRadius:12,border:'1px solid #d9e1ee',minWidth:300}}>
      <h2 style={{fontSize:18,margin:'0 0 10px'}}>Puck Editörü açılıyor…</h2>
      <p style={{margin:'0 0 16px'}}>Düzenleyici bileşenleri yükleniyor.</p>
      <button type="button" onClick={onClose} style={{padding:'9px 12px',borderRadius:7,border:'1px solid #ccd5e5',background:'#fff'}}>İptal et ve yönetim paneline dön</button>
    </div>
  </section>;
}
