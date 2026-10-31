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
  const [inspect,setInspect]=useState(false);
  const [selected,setSelected]=useState<HTMLElement|null>(null);
  const [paint,setPaint]=useState({color:'#172a35',background:'#ffffff',size:14,radius:12,shadow:0,text:''});
  const [customCss,setCustomCss]=useState('');
  const [buttonLabel,setButtonLabel]=useState('Yeni buton');
  const [buttonColor,setButtonColor]=useState('#286a75');
  const [buttonTextColor,setButtonTextColor]=useState('#ffffff');
  const [buttonRadius,setButtonRadius]=useState(12);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!inspect||!open)return;
    const handle=(e:MouseEvent)=>{
      const target=e.target;
      if(!(target instanceof HTMLElement)||target.closest('.serula-designer-root'))return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const element=target.closest<HTMLElement>('button, a')||target.closest<HTMLElement>('h1, h2, h3, p, label, span, section, article, aside, header, footer, div')||target;
      setSelected(previous=>{previous?.removeAttribute('data-serula-selected');return element;});
      element.setAttribute('data-serula-selected','true');
      const style=getComputedStyle(element);
      const toHex=(value:string)=>{
        const nums=value.match(/[\\d.]+/g)?.slice(0,3).map(Number)||[];
        return nums.length===3?'#'+nums.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join(''):'#ffffff';
      };
      setPaint({color:toHex(style.color),background:toHex(style.backgroundColor),size:parseFloat(style.fontSize)||14,radius:parseFloat(style.borderRadius)||0,shadow:0,text:element.children.length===0?(element.textContent||'').trim():''});
      setInspect(false);
    };
    document.addEventListener('click',handle,true);
    return()=>document.removeEventListener('click',handle,true);
  },[inspect,open]);
  useEffect(()=>()=>{selected?.removeAttribute('data-serula-selected')},[selected]);
  const changeSelected=(property:'color'|'background'|'size'|'radius'|'shadow'|'text',value:string|number)=>{
    if(!selected)return;
    setPaint(p=>({...p,[property]:value}));
    if(property==='text'){
      // Text is intentionally limited to leaf elements so React-controlled controls are never replaced.
      if(selected.children.length===0&&!selected.matches('input,textarea,select,[contenteditable]'))selected.textContent=String(value);
      return;
    }
    const styles:Record<string,string>={color:'color',background:'background-color',size:'font-size',radius:'border-radius',shadow:'box-shadow'};
    const cssValue=property==='size'||property==='radius'?value+'px':property==='shadow'?(Number(value)?'0 4px '+value+'px #0003':'none'):String(value);
    selected.style.setProperty(styles[property],cssValue,'important');
  };
  const addButton=()=>{
    const region=selected?.closest('.header,.sidebar,.statusbar,.export-actions,.modal,.main-workspace')||document.querySelector('.export-actions');
    if(!region){setNotice('Buton eklemek için önce bir panel seç.');return;}
    const button=document.createElement('button');
    button.type='button';
    button.className='serula-designer-added-button';
    button.dataset.serulaPreviewOnly='true';
    button.textContent=buttonLabel.trim().slice(0,80)||'Yeni buton';
    button.style.setProperty('background-color',buttonColor,'important');
    button.style.setProperty('color',buttonTextColor,'important');
    button.style.setProperty('border-radius',buttonRadius+'px','important');
    button.title='Tasarım önizlemesi — gerçek bir uygulama işlevine bağlı değil';
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setNotice('Bu buton yalnızca tasarım önizlemesidir; işlev henüz bağlı değil.')});
    region.append(button);
    setSelected(previous=>{previous?.removeAttribute('data-serula-selected');return button;});
    button.setAttribute('data-serula-selected','true');
    setPaint({color:buttonTextColor,background:buttonColor,size:14,radius:buttonRadius,shadow:0,text:button.textContent||''});
    setNotice('Önizleme butonu eklendi. Kaynak koda ve işlevlere henüz eklenmedi.');
  };
  const removeButton=()=>{
    if(!selected?.matches('[data-serula-preview-only="true"]'))return;
    selected.remove();
    setSelected(null);
    setNotice('Önizleme butonu silindi.');
  };
  const applyCss=()=>{
    let sheet=document.getElementById('serula-design-css-preview') as HTMLStyleElement|null;
    if(!sheet){sheet=document.createElement('style');sheet.id='serula-design-css-preview';document.head.append(sheet)}
    sheet.textContent=customCss;
  };
  const change=<K extends keyof Design>(name:K,value:Design[K])=>{setDraft(prev=>({...prev,[name]:value}));setEnabled(true)};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(draft));setNotice('Genel tema ayarları bu tarayıcıya kaydedildi. Öğeye özel düzenlemeler geçici.');}catch{setNotice('Tarayıcı kaydetmeye izin vermedi.');}};
  const reset=()=>{setDraft(defaults);setEnabled(false);try{localStorage.removeItem(key);}catch{/* storage unavailable */}};
  return <div className="serula-designer-root">
    <button type="button" className="serula-designer-launch" onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-controls="serula-designer-panel">🎨 Tema Tasarımcısı</button>
    {open&&<aside id="serula-designer-panel" className="serula-designer-panel" aria-label="Serula tema tasarımcısı">
      <header><strong>Serula Tasarım Atölyesi</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Tema tasarımcısını kapat">×</button></header>
      <p>Değişiklikleri sayfanın üzerinde anında gör. Bu ekran yalnızca tasarım dalında çalışır.</p>
      <div className="serula-designer-actions"><button type="button" onClick={()=>setInspect(i=>!i)}>{inspect?'Seçimi iptal et':'✥ Ekrandan öğe seç'}</button></div>
      {inspect&&<p role="status">Düzenlemek istediğin metne, butona veya panele tıkla. Tıklama uygulamadaki işlemi başlatmaz.</p>}
      <section className="serula-inspector" aria-label="Yeni buton oluştur">
        <strong>+ Buton ekle</strong>
        <label>Buton metni <input aria-label="Yeni buton metni" type="text" maxLength={80} value={buttonLabel} onChange={e=>setButtonLabel(e.target.value)}/></label>
        <label>Buton rengi <input aria-label="Yeni buton rengi" type="color" value={buttonColor} onChange={e=>setButtonColor(e.target.value)}/></label>
        <label>Yazı rengi <input aria-label="Yeni buton yazı rengi" type="color" value={buttonTextColor} onChange={e=>setButtonTextColor(e.target.value)}/></label>
        <label>Köşeler <input aria-label="Yeni buton köşeleri" type="range" min="0" max="40" value={buttonRadius} onChange={e=>setButtonRadius(Number(e.target.value))}/><output>{buttonRadius}px</output></label>
        <button type="button" onClick={addButton}>+ Seçili panele buton ekle</button>
        <small>Eklenen buton görsel örnektir, herhangi bir API veya uygulama işlemi çalıştırmaz.</small>
      </section>
      {notice&&<p role="status">{notice}</p>}
      {selected&&<section className="serula-inspector" aria-label="Seçili öğeyi düzenle">
        <strong>Seçili öğe: {selected.tagName.toLowerCase()}</strong>
        <label>Yazı rengi <input aria-label="Seçili yazı rengi" type="color" value={paint.color} onChange={e=>changeSelected('color',e.target.value)}/></label>
        <label>Arka plan <input aria-label="Seçili arka plan" type="color" value={paint.background} onChange={e=>changeSelected('background',e.target.value)}/></label>
        <label>Yazı boyutu <input type="range" min="10" max="44" value={paint.size} onChange={e=>changeSelected('size',Number(e.target.value))}/><output>{Math.round(paint.size)}px</output></label>
        <label>Köşe yuvarlaklığı <input type="range" min="0" max="40" value={paint.radius} onChange={e=>changeSelected('radius',Number(e.target.value))}/><output>{Math.round(paint.radius)}px</output></label>
        <label>Gölge <input type="range" min="0" max="35" value={paint.shadow} onChange={e=>changeSelected('shadow',Number(e.target.value))}/><output>{paint.shadow}px</output></label>
        {selected.children.length===0&&!selected.matches('input,textarea,select,[contenteditable]')&&<label>Metin <textarea rows={2} value={paint.text} onChange={e=>changeSelected('text',e.target.value)}/></label>}
        {selected.matches('[data-serula-preview-only="true"]')&&<button type="button" onClick={removeButton}>Eklenen butonu sil</button>}
        <small>Seçilen öğe üzerindeki değişiklikler geçici önizlemedir; React ekranı yenilenince sıfırlanabilir.</small>
      </section>}
      <details className="serula-css-editor"><summary>Gelişmiş CSS düzenle</summary><textarea aria-label="Önizleme CSS kodu" rows={5} value={customCss} onChange={e=>setCustomCss(e.target.value)} placeholder=".app .sidebar { background: #f1f4f6; }"/><button type="button" onClick={applyCss}>CSS'yi önizle</button><small>CSS yalnızca bu tarayıcıda uygulanır; güvenmediğin kodu yapıştırma.</small></details>
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
