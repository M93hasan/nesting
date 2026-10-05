import {useEffect,useState} from 'react';
import {example,type Document} from '../model';
import {loadCatalog,loadExample,type Dataset} from '../datasets';
import {normalizeSampleDocument} from '../import/library';
import Modal from './Modal';

export default function ExamplePicker({onChoose,onClose}:{onChoose:(doc:Document,nest:boolean)=>void|Promise<void>;onClose:()=>void}) {
  const [catalog,setCatalog]=useState<Dataset[]>([]),[selected,setSelected]=useState('workshop');
  const [doc,setDoc]=useState<Document|undefined>(()=>normalizeSampleDocument(example())),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[catalogError,setCatalogError]=useState(''),[warnings,setWarnings]=useState<string[]>([]);
  useEffect(()=>{
    let current=true;
    loadCatalog().then(data=>{if(current)setCatalog(data);})
      .catch(e=>{if(current)setCatalogError(e instanceof Error?e.message:String(e));});
    return()=>{current=false;};
  },[]);
  async function choose(id:string) {
    setSelected(id);setError('');setWarnings([]);setDoc(undefined);
    if(id==='workshop'){setDoc(normalizeSampleDocument(example()));return;}
    const dataset=catalog.find(d=>d.id===id);if(!dataset)return;
    setBusy(true);
    try {
      const reply=await loadExample(dataset);
      setDoc(reply.document);setWarnings(reply.warnings);
    } catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function open(nest=false) {
    if(!doc||busy)return;setBusy(true);
    try{await onChoose(doc,nest);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  const dataset=catalog.find(d=>d.id===selected);
  return <Modal title="Bir örnek deneyin" onClose={onClose} locked={busy}>
    <label>Veri seti<select value={selected} disabled={busy} onChange={e=>void choose(e.target.value)}>
      <option value="workshop">Atölye örneği</option>
      {['Main','Gardeyn'].map(group=><optgroup key={group} label={group}>{catalog.filter(d=>d.group===group).map(d=><option key={d.id} value={d.id}>{d.id}{d.continuous?' · serbest dönüş':''}</option>)}</optgroup>)}
    </select></label>
    <p>{dataset?`${dataset.partTypes} şekil · ${dataset.copies} kopya`:'4 şekil · 12 kopya'} · nesting otomatik durur</p>
    {busy&&<p role="status">Örnek yükleniyor…</p>}
    {catalogError&&<p role="alert" className="field-error">{catalogError} Atölye örneği hâlâ kullanılabilir.</p>}
    {error&&<p role="alert" className="field-error">{error}</p>}
    {!!warnings.length&&<ul>{warnings.map(warning=><li key={warning}>{warning}</li>)}</ul>}
    <div className="modal-actions"><button disabled={busy} onClick={onClose}>İptal</button><button disabled={busy||!doc} onClick={()=>void open(true)}>Aç ve yerleştir</button><button className="primary" disabled={busy||!doc} onClick={()=>void open()}>Örneği aç</button></div>
  </Modal>;
}
