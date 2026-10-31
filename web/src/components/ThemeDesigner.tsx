import {useEffect,useState} from 'react';
import './ThemeDesigner.css';

type Design={accent:string;ink:string;paper:string;surface:string;radius:number;cardRadius:number;shadow:number;font:string};
const defaults:Design={accent:'#286a75',ink:'#172a35',paper:'#f7f9fa',surface:'#edf2f4',radius:12,cardRadius:16,shadow:12,font:'system'};
const key='serula-design-preview-v1';
const editsKey='serula-element-edits-v1';
const cssKey='serula-custom-css-v1';
type ElementEdit={selector:string;styles:Record<string,string>;text?:string};
function selectorFor(element:HTMLElement){
  const parts:string[]=[];
  let node:Element|null=element;
  while(node&&node.tagName!=='HTML'){
    if(node.id&&/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(node.id)){parts.unshift('#'+node.id);break;}
    const parent:Element|null=node.parentElement;
    const siblings=parent?Array.from(parent.children).filter(child=>child.tagName===node!.tagName):[];
    parts.unshift(node.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(node)+1)+')');
    node=parent;
  }
  return parts.join(' > ');
}
function restoreEdit(edit:ElementEdit){
  if(!edit||typeof edit.selector!=='string'||!edit.styles)return;
  let el:HTMLElement|null=null;
  try{el=document.querySelector<HTMLElement>(edit.selector)}catch{return}
  if(!el||el.closest('.serula-designer-root'))return;
  for(const [name,value] of Object.entries(edit.styles))
    if(['color','background-color','font-size','border-radius','box-shadow'].includes(name)&&typeof value==='string'&&value.length<120)el.style.setProperty(name,value,'important');
  if(typeof edit.text==='string'&&edit.text.length<500&&!el.matches('input,textarea,select,[contenteditable]')){
    const node=Array.from(el.childNodes).find(n=>n.nodeType===Node.TEXT_NODE);
    if(node)node.textContent=edit.text;
    else if(!el.children.length)el.textContent=edit.text;
  }
}
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
  const [customCss,setCustomCss]=useState(()=>{try{return localStorage.getItem(cssKey)||''}catch{return ''}});
  const [elementEdits,setElementEdits]=useState<Record<string,ElementEdit>>(()=>{try{
    const value=JSON.parse(localStorage.getItem(editsKey)||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {}}});
  useEffect(()=>{
    const restore=()=>{
      for(const item of Object.values(elementEdits))restoreEdit(item);
      if(customCss){
        let style=document.getElementById('serula-design-css-preview') as HTMLStyleElement|null;
        if(!style){style=document.createElement('style');style.id='serula-design-css-preview';document.head.append(style)}
        style.textContent=customCss;
      }
    };
    const a=window.setTimeout(restore,100);
    const b=window.setTimeout(restore,1200);
    return()=>{clearTimeout(a);clearTimeout(b)};
    // Restore saved browser draft on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const [buttonLabel,setButtonLabel]=useState('Yeni buton');
  const [buttonColor,setButtonColor]=useState('#286a75');
  const [buttonTextColor,setButtonTextColor]=useState('#ffffff');
  const [buttonRadius,setButtonRadius]=useState(12);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    if(!inspect||!open)return;
    const handle=(e:MouseEvent)=>{
      const source=e.target;
      if(!(source instanceof Element)||source.closest('.serula-designer-root'))return;
      // In edit mode, consume real button actions before the application's handlers run.
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const element=source.closest<HTMLElement>('button, a, [role="button"]')||source.closest<HTMLElement>('h1,h2,h3,p,label,span,section,article,aside,header,footer,div')||(source instanceof HTMLElement?source:source.parentElement);
      if(!element)return;
      setSelected(previous=>{previous?.removeAttribute('data-serula-selected');return element;});
      element.setAttribute('data-serula-selected','true');
      const style=getComputedStyle(element);
      const toHex=(value:string)=>{
        const parts=value.match(/rgba?\\(\\s*(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)/i);
        return parts?'#'+parts.slice(1,4).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#ffffff';
      };
      const text=element.textContent?.trim()||'';
      setPaint({color:toHex(style.color),background:toHex(style.backgroundColor),size:parseFloat(style.fontSize)||14,radius:parseFloat(style.borderRadius)||0,shadow:0,text});
      setNotice('Öğe seçildi. Ayarları aşağıdan değiştirebilirsin.');
      // Keep selection mode on so the next item can be selected without reopening the panel.
    };
    document.addEventListener('click',handle,true);
    return()=>document.removeEventListener('click',handle,true);
  },[inspect,open]);
  useEffect(()=>()=>{selected?.removeAttribute('data-serula-selected')},[selected]);
  const changeSelected=(property:'color'|'background'|'size'|'radius'|'shadow'|'text',value:string|number)=>{
    if(!selected)return;
    setPaint(p=>({...p,[property]:value}));
    const selector=selectorFor(selected);
    setElementEdits(prev=>{
      const existing=prev[selector]||{selector,styles:{}};
      const styles={...existing.styles};
      const names:Record<string,string>={color:'color',background:'background-color',size:'font-size',radius:'border-radius',shadow:'box-shadow'};
      if(property!=='text')styles[names[property]]=property==='size'||property==='radius'?value+'px':property==='shadow'?(Number(value)?'0 4px '+value+'px #0003':'none'):String(value);
      return {...prev,[selector]:{...existing,styles,...(property==='text'?{text:String(value)}:{})}};
    });
    if(property==='text'){
      // Text is intentionally limited to leaf elements so React-controlled controls are never replaced.
      if(!selected.matches('input,textarea,select,[contenteditable]')){const textNode=Array.from(selected.childNodes).find(node=>node.nodeType===Node.TEXT_NODE);if(textNode)textNode.textContent=String(value);else if(selected.children.length===0)selected.textContent=String(value);}
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
  const save=()=>{try{
    localStorage.setItem(key,JSON.stringify(draft));
    localStorage.setItem(editsKey,JSON.stringify(elementEdits));
    localStorage.setItem(cssKey,customCss);
    setNotice('Tema, öğe metinleri, stiller ve CSS tarayıcı taslağına kaydedildi.');
  }catch{setNotice('Tarayıcı kaydetmeye izin vermedi.');}};
  const reset=()=>{setDraft(defaults);setEnabled(false);setElementEdits({});setCustomCss('');
    try{localStorage.removeItem(key);localStorage.removeItem(editsKey);localStorage.removeItem(cssKey);}catch{/* storage unavailable */}
    document.getElementById('serula-design-css-preview')?.remove();
    setNotice('Taslak sıfırlandı. Öğeleri sıfırlamak için sayfayı yenile.');
  };
  return <div className="serula-designer-root">
    <button type="button" className="serula-designer-launch" onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-controls="serula-designer-panel">🎨 Tema Tasarımcısı</button>
    {open&&<aside id="serula-designer-panel" className="serula-designer-panel" aria-label="Serula tema tasarımcısı">
      <header><strong>Serula Tasarım Atölyesi</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Tema tasarımcısını kapat">×</button></header>
<div className="serula-designer-savebar" aria-label="Tasarım kaydetme işlemleri"><button type="button" onClick={save}>Kaydet</button><button type="button" disabled title="Güvenli yayınlama akışı henüz bağlı değil; canlı siteye değişiklik gönderilmez.">Kaydet ve Yayınla</button><small>Yayınlama henüz etkin değil.</small></div>
      <p>Değişiklikleri sayfanın üzerinde anında gör. Bu ekran yalnızca tasarım dalında çalışır.</p>
      <div className="serula-designer-actions"><button type="button" onClick={()=>setInspect(i=>!i)}>{inspect?'Seçimi iptal et':'✥ Ekrandan öğe seç'}</button></div>
      {inspect&&<p role="status">Seçim modu açık. Ekrandaki butona veya başka bir öğeye tıkla; işlem çalışmadan düzenleme paneli açılacak.</p>}
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
        {!selected.matches('input,textarea,select,[contenteditable]')&&<label>Metin <textarea rows={2} value={paint.text} onChange={e=>changeSelected('text',e.target.value)}/></label>}
        {selected.matches('[data-serula-preview-only="true"]')&&<button type="button" onClick={removeButton}>Eklenen butonu sil</button>}
        <small>Kaydet ile öğeye özel stiller ve metin tarayıcıya saklanır. Dinamik ekran değişiklikleri bazı seçimleri etkileyebilir.</small>
      </section>}
      <details className="serula-css-editor"><summary>Gelişmiş CSS düzenle</summary><textarea aria-label="Önizleme CSS kodu" rows={5} value={customCss} onChange={e=>setCustomCss(e.target.value)} placeholder=".app .sidebar { background: #f1f4f6; }"/><button type="button" onClick={applyCss}>CSS'yi önizle</button><small>CSS yalnızca bu tarayıcıda uygulanır; güvenmediğin kodu yapıştırma.</small></details>
      <div className="serula-designer-fields">
      {([['accent','Vurgu rengi'],['ink','Yazı / ana buton'],['paper','Arka plan'],['surface','Panel yüzeyi']] as const).map(([name,label])=><label key={name}>{label}<input type="color" value={draft[name]} onChange={e=>change(name,e.target.value)}/><output>{draft[name]}</output></label>)}
      <label>Yazı tipi<select value={draft.font} onChange={e=>change('font',e.target.value)}><option value="system">Sistem (modern)</option><option value="inter">Inter</option><option value="geometric">Geometrik</option><option value="classic">Klasik</option></select></label>
      {([['radius','Buton köşeleri'],['cardRadius','Panel köşeleri'],['shadow','Gölge yumuşaklığı']] as const).map(([name,label])=><label key={name}>{label}<input type="range" min="0" max={name==='shadow'?40:32} value={draft[name]} onChange={e=>change(name,Number(e.target.value))}/><output>{draft[name]} px</output></label>)}
      </div>
      <div className="serula-designer-actions"><button type="button" onClick={()=>setEnabled(s=>!s)}>{enabled?'Önizlemeyi kapat':'Önizlemeyi aç'}</button><button type="button" onClick={reset}>Sıfırla</button></div>
      <small>Kaydet, tema ve öğe değişikliklerini yalnızca bu tarayıcıda saklar. Kaydet ve Yayınla, güvenli onay ve yayınlama altyapısı bağlanana kadar devre dışıdır; canlı siteye hiçbir değişiklik gönderilmez.</small>
    </aside>}
  </div>;
}
