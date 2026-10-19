import {useEffect,useState} from 'react';
import {BUTTON_TARGETS,validateButtonCss,type ButtonStyles} from '../../shared/button-styles.js';
export default function ButtonStyleEditor({value,onChange,disabled,onPending}:{value:ButtonStyles;onChange:(value:ButtonStyles)=>void;disabled:boolean;onPending:(pending:boolean)=>void}){
  const [query,setQuery]=useState(''),[id,setId]=useState(BUTTON_TARGETS[0][0]),[state,setState]=useState<'normal'|'hover'|'disabled'>('normal');
  const [input,setInput]=useState<string|null>(null),[error,setError]=useState('');
  useEffect(()=>{onPending(input!==null);return()=>onPending(false);},[input,onPending]);
  const css=input??value[id]?.[state]??'';
  const select=(next:string)=>{setId(next);setInput(null);setError('');};
  const apply=()=>{
    try{
      validateButtonCss(css);
      const probe=document.createElement('span').style;
      for(const declaration of css.split(';')){
        if(!declaration.trim())continue;
        const colon=declaration.indexOf(':'),property=declaration.slice(0,colon).trim(),v=declaration.slice(colon+1).replace(/!important\s*$/i,'').trim();
        probe.setProperty(property,'');probe.setProperty(property,v);
        if(!probe.getPropertyValue(property))throw Error('Tarayıcının tanımadığı CSS: '+property);
      }
      onChange({...value,[id]:{...value[id],[state]:css}});setInput(null);setError('');
    }catch(reason){setError(reason instanceof Error?reason.message:'CSS geçersiz.');}
  };
  return <fieldset className="button-style-editor" disabled={disabled}>
    <legend>Butonları düzenle</legend>
    <p>Butonu adıyla seç. Tekrarlanan butonlar (örneğin kullanıcı satırları) birlikte değişir.</p>
    <label>Buton ara<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Corel, DXF, kullanıcı…"/></label>
    <label>Düzenlenecek buton<select value={id} onChange={e=>select(e.target.value)}>{BUTTON_TARGETS.filter(([key,label])=>key===id||label.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))).map(([key,label])=><option key={key} value={key}>{label}{value[key]?' · Özelleştirilmiş':''}</option>)}</select></label>
    <label>Buton durumu<select value={state} onChange={e=>{setState(e.target.value as typeof state);setInput(null);setError('');}}><option value="normal">Normal</option><option value="hover">Üzerine gelince</option><option value="disabled">Devre dışı</option></select></label>
    <label>Özel CSS<textarea rows={7} spellCheck={false} maxLength={2000} value={css} onChange={e=>setInput(e.target.value)} placeholder={'background: #2563eb;\ncolor: #ffffff;\nborder-radius: 12px;\npadding: 12px 20px;'} /></label>
    <small>Seçici veya süslü parantez yazmana gerek yok. Renk, arka plan, kenarlık, gölge, padding ve yazı stilleri desteklenir.</small>
    {error&&<p role="alert" className="field-error">{error}</p>}
    <div className="appearance-actions"><button type="button" onClick={()=>{const next={...value};delete next[id];onChange(next);setInput(null);setError('');}}>Bu butonu sıfırla</button><button type="button" onClick={()=>setInput('background: #2563eb;\ncolor: #ffffff;\nborder-radius: 12px;\npadding: 12px 20px;')}>Örnek CSS ekle</button><button type="button" onClick={apply}>CSS’yi önizlemeye uygula</button></div>
    <div className="button-style-preview"><span>{BUTTON_TARGETS.find(target=>target[0]===id)?.[1]} · {state==='hover'?'Üzerine gelince':state==='disabled'?'Devre dışı':'Normal'} önizlemesi</span><button type="button" disabled={state==='disabled'} ref={element=>{if(element)element.style.cssText=((value[id]?.normal??'')+';'+(state==='normal'?'':value[id]?.[state]??'')).split(';').filter(s=>s.trim()).map(s=>s.replace(/\s*!important\s*$/i,'')+' !important').join(';');}}>Örnek buton</button></div>
    {input!==null&&<p role="status">CSS taslağını kaydetmeden önce “CSS’yi önizlemeye uygula” düğmesine bas.</p>}
    <p>Önizlemeden sonra aşağıdaki “Herkes için kaydet” düğmesiyle kalıcı olarak kaydet.</p>
  </fieldset>;
}
