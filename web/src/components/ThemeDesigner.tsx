import {useEffect,useState} from 'react';
import './ThemeDesigner.css';

type Design={accent:string;ink:string;paper:string;surface:string;radius:number;cardRadius:number;shadow:number;font:string};
const defaults:Design={accent:'#286a75',ink:'#172a35',paper:'#f7f9fa',surface:'#edf2f4',radius:12,cardRadius:16,shadow:12,font:'system'};
const key='serula-design-preview-v1';
const fonts:Record<string,string>={
  system:'system-ui, -apple-system, "Segoe UI", sans-serif',
  inter:'Inter, system-ui, sans-serif',
  geometric:'"Trebuchet MS", "Segoe UI", sans-serif',
  classic:'Georgia, serif',
};
function valid(value:unknown):value is Design{
  if(!value||typeof value!=='object')return false;
  const v=value as Design;
  return [v.accent,v.ink,v.paper,v.surface].every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))&&
    [v.radius,v.cardRadius,v.shadow].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=80)&&v.font in fonts;
}
function initial():Design{
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(valid(saved))return saved;}catch{/* fresh preview */}
  return defaults;
}
export default function ThemeDesigner(){
  const [open,setOpen]=useState(false);
  const [enabled,setEnabled]=useState(false);
  const [draft,setDraft]=useState<Design>(initial);
  useEffect(()=>{
    const root=document.documentElement;
    if(enabled){
      root.dataset.serulaDesigner='true';
      const vars:Record<string,string>={
        '--color-ink-black':draft.ink,'--color-paper-white':draft.paper,'--color-mist-gray':draft.surface,
        '--color-fog-white':draft.paper,'--color-sienna-brown':draft.accent,'--color-blush-peach':draft.surface,
        '--font-sohne':fonts[draft.font],'--font-signifier':fonts[draft.font],
        '--radius-buttons':draft.radius+'px','--radius-cards':draft.cardRadius+'px',
        '--shadow-subtle':draft.shadow?'0 4px '+draft.shadow+'px rgb(0 0 0 / .12)':'none',
      };
      for(const [name,value] of Object.entries(vars))root.style.setProperty(name,value);
    }else{
      delete root.dataset.serulaDesigner;
      for(const name of ['--color-ink-black','--color-paper-white','--color-mist-gray','--color-fog-white','--color-sienna-brown','--color-blush-peach','--font-sohne','--font-signifier','--radius-buttons','--radius-cards','--shadow-subtle'])root.style.removeProperty(name);
    }
    return ()=>{delete root.dataset.serulaDesigner;for(const name of ['--color-ink-black','--color-paper-white','--color-mist-gray','--color-fog-white','--color-sienna-brown','--color-blush-peach','--font-sohne','--font-signifier','--radius-buttons','--radius-cards','--shadow-subtle'])root.style.removeProperty(name);};
  },[draft,enabled]);
  const change=<K extends keyof Design>(name:K,value:Design[K])=>{setDraft(prev=>({...prev,[name]:value}));setEnabled(true)};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(draft));}catch{/* storage unavailable */}};
  const reset=()=>{setDraft(defaults);setEnabled(false);try{localStorage.removeItem(key);}catch{/* storage unavailable */}};
  return <div className="serula-designer-root">
    <button type="button" className="serula-designer-launch" onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-controls="serula-designer-panel">🎨 Tema Tasarımcısı</button>
    {open&&<aside id="serula-designer-panel" className="serula-designer-panel" aria-label="Serula tema tasarımcısı">
      <header><strong>Serula Tasarım Atölyesi</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Tema tasarımcısını kapat">×</button></header>
      <p>Değişiklikleri sayfanın üzerinde anında gör. Bu ekran yalnızca tasarım dalında çalışır.</p>
      <div className="serula-designer-fields">
      {([['accent','Vurgu rengi'],['ink','Yazı / ana buton'],['paper','Arka plan'],['surface','Panel yüzeyi']] as const).map(([name,label])=><label key={name}>{label}<input type="color" value={draft[name]} onChange={e=>change(name,e.target.value)}/><output>{draft[name]}</output></label>)}
      <label>Yazı tipi<select value={draft.font} onChange={e=>change('font',e.target.value)}><option value="system">Sistem (modern)</option><option value="inter">Inter</option><option value="geometric">Geometrik</option><option value="classic">Klasik</option></select></label>
      {([['radius','Buton köşeleri'],['cardRadius','Panel köşeleri'],['shadow','Gölge yumuşaklığı']] as const).map(([name,label])=><label key={name}>{label}<input type="range" min="0" max={name==='shadow'?40:32} value={draft[name]} onChange={e=>change(name,Number(e.target.value))}/><output>{draft[name]} px</output></label>)}
      </div>
      <div className="serula-designer-actions"><button type="button" onClick={()=>setEnabled(s=>!s)}>{enabled?'Önizlemeyi kapat':'Önizlemeyi aç'}</button><button type="button" onClick={save}>Bu tarayıcıda kaydet</button><button type="button" onClick={reset}>Sıfırla</button></div>
      <small>Kaydetme yalnızca bu tarayıcıda geçerlidir. Canlı siteye, GitHub main dalına veya diğer kullanıcılara uygulanmaz.</small>
    </aside>}
  </div>;
}
