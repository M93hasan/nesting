import {useEffect,useMemo,useRef,useState,type MouseEvent} from 'react';
import {DEFAULT_SETTINGS,newPartId,type Part} from '../model';
import {bounds} from '../geometry/normalize';
import {pathData} from '../geometry/path';
import {geometryTask} from '../workers/geometryTask';
import {loadCatalog,loadLibrary,type Dataset} from '../datasets';
import {readŞekils,saveŞekils,removeŞekil} from '../storage/shapes';
import {LIBRARY_MEDIAN_MM2} from '../import/library';
import Modal from './Modal';
import SizeControls from './SizeControls';
import {displayLength,unitScale,type DisplayUnit} from '../units';
import './ŞekilLibrary.css';

const sourceAd=(dataset:Dataset)=>dataset.file.replace(/\.json$/i,'');

export default function ŞekilLibrary({selectedParçalar=[],onAdd,onKapat,unit='mm'}:{unit?:DisplayUnit;selectedParçalar?:Part[];onAdd:(parts:Part[])=>void|Promise<void>;onKapat:()=>void}) {
  const [catalog,setCatalog]=useState<Dataset[]>([]),[source,setSource]=useState('mine');
  const [mine,setMine]=useState<Part[]>([]),[parts,setParçalar]=useState<Part[]>([]),[selected,setSelected]=useState<Part[]>([]);
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
    readŞekils().then(p=>{if(current)setMine(p);}).catch(e=>{if(current)setStorageError(String(e.message??e));}).finally(()=>{if(current)setLoading(false);});
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
    if(source==='mine'){setParçalar(mine);return;}
    if(!dataset)return;
    setParçalar([]);setBusy(true);
    loadLibrary(dataset).then(libraryParçalar=>{if(current)setParçalar(libraryParçalar);}).catch(e=>{if(current)setError(String(e.message??e));}).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;};
  },[source,mine,catalog,dataset]);

  async function perform(action:()=>Promise<void>) {
    setBusy(true);setError('');setNotice('');
    try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }

  function save(partsToSave:Part[]) {
    void perform(async()=>{
      const saved=await saveŞekils(partsToSave);setMine(await readŞekils());setSource('mine');setNotice(`${saved.length===1?'Şekil saved':`${saved.length} shapes saved`} on this device.`);
    });
  }

  function resize(axis:0|1,sizeMm:number) {
    if(!chosen)return;
    const b=bounds(chosen.outer);if(sizeMm===b[axis+2]-b[axis])return;
    void perform(async()=>{
      const reply=await geometryTask({type:'resize',runId:0,documentRevision:0,document:{name:'Library shape',parts:[chosen],settings:DEFAULT_SETTINGS},partId:chosen.id,axis,sizeMm});
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
  return <Modal title="Şekil kütüphanesi" onKapat={onKapat} locked={busy}>
    <div classAd="shape-library">
      <div classAd="library-toolbar">
        <p classAd="library-note">Pick reusable shapes to add to the current project. Sample projects stay available from “Örnek aç”.</p>
        {selectedParçalar.length>0&&<button disabled={blocked||!!storageError} onClick={()=>save(selectedParçalar)}>Save selected {selectedParçalar.length===1?'shape':'shapes'}</button>}
      </div>
      <p classAd="library-note library-normalization-note">{source==='mine'?'Saved in this browser on this device. Download projects as backups.':<>Each source file uses one scale factor. The median shape-type net area (outer minus holes) is {areaText} {unit}²; demand is ignored, so relative sizes and proportions stay intact.</>}</p>
      {storageError&&<p role="alert" classAd="field-error">{storageError}</p>}
      {error&&<p role="alert" classAd="field-error">{error}</p>}
      {(busy||loading)&&<p role="status">Loading shapes…</p>}
      {notice&&<p role="status">{notice}</p>}
      <p classAd="library-note">Click to select. ⌘/Ctrl-click toggles shapes; Shift-click selects a range.</p>
      <div classAd="library-layout">
        <section classAd="library-selector" aria-label="Şekil selector">
          <h3>Şekils{parts.length?` · ${parts.length}`:''}</h3>
          <div classAd="library-grid" aria-label="Library shapes">
            {parts.map((part,index)=>{
              const [x0,y0,x1,y1]=bounds(part.outer),width=x1-x0,height=y1-y0;
              const widthLabel=displayLength(width,unit),heightLabel=displayLength(height,unit);
              return <button type="button" key={part.id} aria-label={`${part.name}, ${widthLabel} by ${heightLabel} ${unit}`} aria-pressed={selected.some(item=>item.id===part.id)} disabled={blocked} onClick={event=>choose(index,event)}>
                <Preview part={part}/><span>{part.name}</span><small>{widthLabel} × {heightLabel} {unit}</small>
              </button>;
            })}
            {!parts.length&&!blocked&&<p>{source==='mine'?'Select shapes in your project and save them here, or choose a dataset.':'No shapes in this source file.'}</p>}
          </div>
        </section>
        <aside classAd="library-sidebar" aria-label="Şekil kütüphanesi sources and selection">
          <div classAd="library-categories">
            <h3 id="library-sources-heading">Source files</h3>
            <label>Collection<select aria-label="Collection" value={source} disabled={blocked} onChange={event=>selectSource(event.target.value)}>
              <option value="mine">My shapes ({mine.length})</option>
              {groups.map(group=><optgroup key={group} label={group}>{catalog.filter(item=>item.group===group).map(item=><option key={item.id} value={item.id}>{item.id}{item.continuous?' · free rotation':''}</option>)}</optgroup>)}
            </select></label>
            <nav aria-labelledby="library-sources-heading">
              <button type="button" classAd={source==='mine'?'active':''} aria-current={source==='mine'?'true':undefined} disabled={blocked} onClick={()=>selectSource('mine')}><span>My shapes</span><small>{mine.length} saved</small></button>
              {groups.map(group=><div classAd="library-category-group" key={group}><h4>{group}</h4>{catalog.filter(item=>item.group===group).map(item=><button type="button" key={item.id} classAd={source===item.id?'active':''} aria-current={source===item.id?'true':undefined} disabled={blocked} onClick={()=>selectSource(item.id)}><span>{sourceAd(item)}{item.continuous?' · free rotation':''}</span><small>{item.file}</small></button>)}</div>)}
            </nav>
            {dataset&&<small classAd="library-source-summary">{dataset.partTypes??parts.length} shape types from {dataset.file}{dataset.continuous?' · free rotation':''}</small>}
          </div>
          {selected.length>0&&<div classAd="library-detail" aria-label="Selected library shapes">
            <h3>{chosen?chosen.name:`${selected.length} shapes selected`}</h3>
            {chosen&&<><Preview part={chosen}/><SizeControls unit={unit} key={chosen.id} part={chosen} disabled={blocked} onApply={resize} onValidity={setValid}/><small>{chosen.holes.length?`${chosen.holes.length} hole${chosen.holes.length===1?'':'s'} · `:''}{chosen.rotations.kind==='continuous'?'Serbest dönüş':`${chosen.rotations.degrees.join('°, ')}°`}</small></>}
            <button type="button" classAd="primary" disabled={blocked||!!chosen&&!valid} onClick={()=>void perform(async()=>{await onAdd(selected.map(part=>({...part,id:newPartId(),quantity:1,preparationPosition:[0,0]})));setNotice(`${selected.length===1?'Şekil':`${selected.length} shapes`} added to your project.`);})}>{chosen?'Şekil ekle to project':`Add ${selected.length} selected shapes to project`}</button>
            {chosen&&<button type="button" disabled={blocked||!valid||!!storageError} onClick={()=>save([chosen])}>Save as new personal shape</button>}
            {chosen&&source==='mine'&&<button type="button" disabled={blocked||!!storageError} onClick={()=>void perform(async()=>{await removeŞekil(chosen.id);setSelected([]);anchor.current=0;setMine(await readŞekils());})}>Remove saved shape</button>}
          </div>}
        </aside>
      </div>
      <div classAd="library-footer"><button type="button" disabled={busy} onClick={onKapat}>Done</button></div>
    </div>
  </Modal>;
}

function Preview({part}:{part:Part}) {
  const [x0,y0,x1,y1]=bounds(part.outer),pad=Math.max(x1-x0,y1-y0)*.08;
  return <svg aria-hidden="true" viewBox={`${x0-pad} ${-y1-pad} ${x1-x0+pad*2} ${y1-y0+pad*2}`}><path transform="scale(1 -1)" d={pathData([part.outer,...part.holes])} fill="var(--accent)" fillOpacity=".22" fillRule="evenodd" stroke="var(--accent)" vectorEffect="non-scaling-stroke"/></svg>;
}
