import {useEffect,useMemo,useRef,useState,type MouseEvent} from 'react';
import {DEFAULT_SETTINGS,newPartId,type Part} from '../model';
import {bounds} from '../geometry/normalize';
import {pathData} from '../geometry/path';
import {geometryTask} from '../workers/geometryTask';
import {loadCatalog,loadLibrary,type Dataset} from '../datasets';
import {readShapes,saveShapes,removeShape} from '../storage/shapes';
import {LIBRARY_MEDIAN_MM2} from '../import/library';
import Modal from './Modal';
import SizeControls from './SizeControls';
import {displayLength,unitScale,type DisplayUnit} from '../units';
import './ShapeLibrary.css';

const sourceName=(dataset:Dataset)=>dataset.file.replace(/\.json$/i,'');

export default function ShapeLibrary({selectedParts=[],onAdd,onClose,unit='mm'}:{unit?:DisplayUnit;selectedParts?:Part[];onAdd:(parts:Part[])=>void|Promise<void>;onClose:()=>void}) {
  const [catalog,setCatalog]=useState<Dataset[]>([]),[source,setSource]=useState('mine');
  const [mine,setMine]=useState<Part[]>([]),[parts,setParts]=useState<Part[]>([]),[selected,setSelected]=useState<Part[]>([]);
  const anchor=useRef(0);
  const chosen=selected.length===1?selected[0]:undefined;
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[valid,setValid]=useState(true);
  const [error,setError]=useState(''),[storageError,setStorageError]=useState(''),[notice,setNotice]=useState('');
  const groups=useMemo(()=>[...new Set(catalog.map(dataset=>dataset.group))],[catalog]);
  const dataset=catalog.find(item=>item.id===source);
  const area=LIBRARY_MEDIAN_MM2/unitScale(unit)**2;
  const areaText=Number(area.toPrecision(unit==='mm'?6:4)).toString();

  useEffect(()=>{
    let current=true;
    readShapes().then(p=>{if(current)setMine(p);}).catch(e=>{if(current)setStorageError(String(e.message??e));}).finally(()=>{if(current)setLoading(false);});
    loadCatalog().then(catalogItems=>{if(current)setCatalog(catalogItems);}).catch(e=>{if(current)setError(String(e.message??e));});
    return()=>{current=false;};
  },[]);

  const initialSource=useRef(false);
  useEffect(()=>{
    if(initialSource.current||loading||!catalog.length)return;
    initialSource.current=true;
    if(!mine.length)setSource(catalog[0].id);
  },[catalog,loading,mine.length]);

  useEffect(()=>{
    let current=true;setSelected([]);anchor.current=0;setError('');setNotice('');
    if(source==='mine'){setParts(mine);return;}
    if(!dataset)return;
    setParts([]);setBusy(true);
    loadLibrary(dataset).then(libraryParts=>{if(current)setParts(libraryParts);}).catch(e=>{if(current)setError(String(e.message??e));}).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;};
  },[source,mine,catalog,dataset]);

  async function perform(action:()=>Promise<void>) {
    setBusy(true);setError('');setNotice('');
    try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }

  function save(partsToSave:Part[]) {
    void perform(async()=>{
      const saved=await saveShapes(partsToSave);setMine(await readShapes());setSource('mine');setNotice(`${saved.length===1?'Şekil kaydedildi':`${saved.length} şekil kaydedildi`} bu cihaza.`);
    });
  }

  function resize(axis:0|1,sizeMm:number) {
    if(!chosen)return;
    const b=bounds(chosen.outer);if(sizeMm===b[axis+2]-b[axis])return;
    void perform(async()=>{
      const reply=await geometryTask({type:'resize',runId:0,documentRevision:0,document:{name:'Kütüphane şekli',parts:[chosen],settings:DEFAULT_SETTINGS},partId:chosen.id,axis,sizeMm});
      if(reply.type==='normalized')setSelected([reply.document.parts[0]]);
    });
  }

  function choose(index:number,event:MouseEvent<HTMLButtonElement>) {
    const additive=event.metaKey||event.ctrlKey;
    setSelected(previous=>{
      if(event.shiftKey){
        const start=Math.min(anchor.current,index),end=Math.max(anchor.current,index);
        const range=parts.slice(start,end+1);
        return additive?[...previous,...range.filter(part=>!previous.some(item=>item.id===part.id))]:range;
      }
      anchor.current=index;
      const part=parts[index];
      return additive?(previous.some(item=>item.id===part.id)?previous.filter(item=>item.id!==part.id):[...previous,part]):[part];
    });
    setNotice('');
  }

  function selectSource(id:string) {
    if(id!==source)setSource(id);
  }

  const blocked=busy||loading;
  return <Modal title="Şekil kütüphanesi" onClose={onClose} locked={busy}>
    <div className="shape-library">
      <div className="library-toolbar">
        <p className="library-note">Geçerli projeye eklemek için tekrar kullanılabilir şekilleri seçin. Örnek projeler “Örneği aç” bölümünde kalır.</p>
        {selectedParts.length>0&&<button disabled={blocked||!!storageError} onClick={()=>save(selectedParts)}>Seçili {selectedParts.length===1?'şekli':'şekilleri'} kaydet</button>}
      </div>
      <p className="library-note library-normalization-note">{source==='mine'?'Bu cihazdaki tarayıcıda kaydedilir. Yedek için projeleri indirin.':<>Her kaynak dosya tek bir ölçek katsayısı kullanır. Ortanca şekil türü net alanı (dış alan eksi delikler) {areaText} {unit}²; adet dikkate alınmaz, böylece göreli boyutlar ve oranlar korunur.</>}</p>
      {storageError&&<p role="alert" className="field-error">{storageError}</p>}
      {error&&<p role="alert" className="field-error">{error}</p>}
      {(busy||loading)&&<p role="status">Şekiller yükleniyor…</p>}
      {notice&&<p role="status">{notice}</p>}
      <p className="library-note">Seçmek için tıklayın. ⌘/Ctrl-tıklama seçimi değiştirir; Shift-tıklama aralık seçer.</p>
      <div className="library-layout">
        <section className="library-selector" aria-label="Şekil seçici">
          <h3>Şekiller{parts.length?` · ${parts.length}`:''}</h3>
          <div className="library-grid" aria-label="Kütüphane şekilleri">
            {parts.map((part,index)=>{
              const [x0,y0,x1,y1]=bounds(part.outer),width=x1-x0,height=y1-y0;
              const widthLabel=displayLength(width,unit),heightLabel=displayLength(height,unit);
              return <button type="button" key={part.id} aria-label={`${part.name}, ${widthLabel} by ${heightLabel} ${unit}`} aria-pressed={selected.some(item=>item.id===part.id)} disabled={blocked} onClick={event=>choose(index,event)}>
                <Preview part={part}/><span>{part.name}</span><small>{widthLabel} × {heightLabel} {unit}</small>
              </button>;
            })}
            {!parts.length&&!blocked&&<p>{source==='mine'?'Projenizde şekilleri seçip buraya kaydedin veya bir veri seti seçin.':'Bu kaynak dosyada şekil yok.'}</p>}
          </div>
        </section>
        <aside className="library-sidebar" aria-label="Şekil kütüphanesi kaynakları ve seçim">
          <div className="library-categories">
            <h3 id="library-sources-heading">Kaynak dosyalar</h3>
            <label>Koleksiyon<select aria-label="Koleksiyon" value={source} disabled={blocked} onChange={event=>selectSource(event.target.value)}>
              <option value="mine">Şekillerim ({mine.length})</option>
              {groups.map(group=><optgroup key={group} label={group}>{catalog.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.id}{item.continuous?' · serbest dönüş':''}</option>)}</optgroup>)}
            </select></label>
            <nav aria-labelledby="library-sources-heading">
              <button type="button" className={source==='mine'?'active':''} aria-current={source==='mine'?'true':undefined} disabled={blocked} onClick={()=>selectSource('mine')}><span>Şekillerim</span><small>{mine.length} kayıtlı</small></button>
              {groups.map(group=><div className="library-category-group" key={group}><h4>{group}</h4>{catalog.filter(item=>item.group===group).map(item=><button type="button" key={item.id} className={source===item.id?'active':''} aria-current={source===item.id?'true':undefined} disabled={blocked} onClick={()=>selectSource(item.id)}><span>{sourceName(item)}{item.continuous?' · serbest dönüş':''}</span><small>{item.file}</small></button>)}</div>)}
            </nav>
            {dataset&&<small className="library-source-summary">{dataset.partTypes??parts.length} şekil türü · kaynak: {dataset.file}{dataset.continuous?' · serbest dönüş':''}</small>}
          </div>
          {selected.length>0&&<div className="library-detail" aria-label="Seçili kütüphane şekilleri">
            <h3>{chosen?chosen.name:`${selected.length} şekil seçildi`}</h3>
            {chosen&&<><Preview part={chosen}/><SizeControls unit={unit} key={chosen.id} part={chosen} disabled={blocked} onApply={resize} onValidity={setValid}/><small>{chosen.holes.length?`${chosen.holes.length} delik · `:''}{chosen.rotations.kind==='continuous'?'Serbest dönüş':`${chosen.rotations.degrees.join('°, ')}°`}</small></>}
            <button type="button" className="primary" disabled={blocked||!!chosen&&!valid} onClick={()=>void perform(async()=>{await onAdd(selected.map(part=>({...part,id:newPartId(),quantity:1,preparationPosition:[0,0]})));setNotice(`${selected.length===1?'Şekil':`${selected.length} şekil`} projenize eklendi.`);})}>{chosen?'Şekli projeye ekle':`${selected.length} seçili şekli projeye ekle`}</button>
            {chosen&&<button type="button" disabled={blocked||!valid||!!storageError} onClick={()=>save([chosen])}>Yeni kişisel şekil olarak kaydet</button>}
            {chosen&&source==='mine'&&<button type="button" disabled={blocked||!!storageError} onClick={()=>void perform(async()=>{await removeShape(chosen.id);setSelected([]);anchor.current=0;setMine(await readShapes());})}>Kaydedilmiş şekli kaldır</button>}
          </div>}
        </aside>
      </div>
      <div className="library-footer"><button type="button" disabled={busy} onClick={onClose}>Bitti</button></div>
    </div>
  </Modal>;
}

function Preview({part}:{part:Part}) {
  const [x0,y0,x1,y1]=bounds(part.outer),pad=Math.max(x1-x0,y1-y0)*.08;
  return <svg aria-hidden="true" viewBox={`${x0-pad} ${-y1-pad} ${x1-x0+pad*2} ${y1-y0+pad*2}`}><path transform="scale(1 -1)" d={pathData([part.outer,...part.holes])} fill="var(--accent)" fillOpacity=".22" fillRule="evenodd" stroke="var(--accent)" vectorEffect="non-scaling-stroke"/></svg>;
}
