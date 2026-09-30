import RotationControl from './components/RotationControl';
import packageInfo from '../package.json';
import {readRecovery,saveRecovery} from './storage/recovery';
import {useDismissibleMenu} from './components/useDismissibleMenu';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, rotationSummary, type Document, type Part, type Point, type Result, type RotationRule } from './model';
import { bounds } from './geometry/normalize';
import { netArea } from './geometry/validate';
import { pathData } from './geometry/path';
import { geometryTask } from './workers/geometryTask';
import {loadExample} from './datasets';
import { phaseImprovements, useSolver } from './workers/useSolver';
import type { ImportReview } from './import/sparrow';
import Workspace,{colors} from './components/Workspace';
import Modal from './components/Modal';
import SelectionControls from './components/SelectionControls';
import {displayLength,unitScale,type DisplayUnit} from './units';
import {selectionBounds,type GeometryEdit} from './geometry/manipulate';
import {isEditableTarget,preparationShortcut} from './geometry/gestures';
import {copyRefsFor,documentPlacements,duplicateCopies,removeCopies,rotateToNextOrientation,movePlacements,placementLayoutsEqual,syncQuantity,updatePlacements,withDocumentPlacements,type CopyRef} from './geometry/placements';

const emptyProject=(name='Adsız proje'):Document=>({name,parts:[],settings:{...DEFAULT_SETTINGS}});
type ProjectSwitch={document:Document;result?:Result;warnings?:string[];saved?:boolean;nest?:boolean};
const rotationValue=(rule:RotationRule)=>rule.kind==='continuous'?'free':JSON.stringify([...new Set(rule.degrees.map(d=>((d%360)+360)%360))].sort((a,b)=>a-b));
const validQuantity=(n:number)=>Number.isInteger(n)&&n>=0&&n<=500;
const displayedPieceCount=(parts:Part[])=>parts.reduce((total,part)=>total+part.quantity*(part.source.dxfSourceEntityCount??1),0);
type RemoteAdminSettings={materialWidthMm?:number;clearanceMm?:number;rotation?:'fixed'|'half'|'free';materialType?:'roll'|'sheet';solverPreset?:'standard'|'fast'};
function download(name:string,text:BlobPart,type='application/json') {
  const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function App({initialDocument=emptyProject(),initialError='',loadDefaultExample=false}:{initialDocument?:Document;initialError?:string;loadDefaultExample?:boolean}) {
  const [doc,setDoc]=useState<Document>(()=>withDocumentPlacements(initialDocument)),[revision,setRevision]=useState(1),[selectedCopies,setSelectedCopies]=useState<CopyRef[]>([]);
  const [unusedSelection,setUnusedSelection]=useState<string[]>([]);
  // Safari clears the focus selection on mouse-up; preserve it for the first click only.
  const partAnchor=useRef(0),focusClick=useRef<HTMLInputElement|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(initialError);
  const [fitRequest,setFitRequest]=useState(0);
  const [resultMode,setResultMode]=useState<'live'|'checked'>('live');
  const [threads,setThreads]=useState(0);
  const [sizeValid,setSizeValid]=useState(true),[downloadedResult,setDownloadedResult]=useState(false);
  const [theme,setTheme]=useState<'system'|'light'|'dark'>(()=>{try{const saved=localStorage.getItem('serula-theme');return saved==='light'||saved==='dark'||saved==='system'?saved:'system';}catch{return 'system';}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('serula-theme',theme);}catch{/* The theme still works when storage is unavailable. */}},[theme]);
  const [unit,setUnit]=useState<DisplayUnit>(()=>{try{return localStorage.getItem('serula-units')==='in'?'in':'mm';}catch{return 'mm';}});
  useEffect(()=>{try{localStorage.setItem('serula-units',unit);}catch{/* Görüntü birimleri work without persistence. */}},[unit]);
  const factor=unitScale(unit),length=(mm:number)=>(mm/factor).toLocaleString(undefined,{maximumFractionDigits:unit==='mm'?2:4});
  const inputLength=(mm:number)=>Number.isFinite(mm)?displayLength(mm,unit):'';
  const [panel,setPanel]=useState(true),[info,setInfo]=useState<'admin'|'about'|'contact'|'help'>();
  const [files,setFiles]=useState<{name:string;text:string}[]>(),[scale,setScale]=useState(1),[review,setReview]=useState<ImportReview>();
  const [tolerance,setTolerance]=useState(.01),[enclosed,setEnclosed]=useState<'holes'|'parts'>('holes');
  const [layers,setLayers]=useState<string[]>(),[availableLayers,setAvailableLayers]=useState<string[]>([]),[excludeIssues,setExcludeIssues]=useState(false);
  const [previewStale,setPreviewStale]=useState(false);
  const [importWarnings,setImportWarnings]=useState<string[]>([]);
  const exportFormat='dxf' as const;
  const [materialWidthFocused,setMaterialWidthFocused]=useState(false);
  const [nameDialog,setNameDialog]=useState<'new'|'rename'>(),[projectName,setProjectAd]=useState('');
  const [pendingProject,setPendingProject]=useState<ProjectSwitch>();
  const [fileIntent,setFileIntent]=useState<'project'|'shapes'|'auto'>('auto');
  const projectInput=useRef<HTMLInputElement>(null),projectMenu=useRef<HTMLDetailsElement>(null);
  useDismissibleMenu(projectMenu);
  const [shape,setShape]=useState<'rectangle'|'circle'|'polygon'>(),[shapeWidth,setShapeWidth]=useState(40),[shapeHeight,setShapeHeight]=useState(30),[polygon,setPolygon]=useState<Point[]>();
  const history=useRef<{doc:Document;geometry:boolean;selection:CopyRef[];unused:string[]}[]>([]),future=useRef<{doc:Document;geometry:boolean;selection:CopyRef[];unused:string[]}[]>([]),operation=useRef(0);
  const input=useRef<HTMLInputElement>(null),solver=useSolver();
  const fieldEdit=useRef<{key:string;document:Document}|undefined>(undefined);
  const running=['Initializing','Running'].includes(solver.state),locked=running||busy;
  const result=solver.result?.documentRevision===revision?solver.result:undefined;
  const [exported,setExported]=useState<{document:Document;result?:Result}>(()=>({document:doc}));
  const [loadingExample,setLoadingExample]=useState(loadDefaultExample);
  const [browserSaved,setBrowserSaved]=useState<{document:Document;result?:Result;revision:number}>();
  const [recoveryReady,setRecoveryReady]=useState(false),[recoveryError,setRecoveryError]=useState('');
  useEffect(()=>{
    if(loadingExample)return;
    const worker=new Worker(new URL('./workers/solver-runtime.worker.ts',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>worker.terminate(),15_000);
    const done=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onmessage=done;
    worker.onerror=event=>{event.preventDefault();done();};
    worker.postMessage({type:'preload',threads:crossOriginIsolated&&typeof SharedArrayBuffer!=='undefined'&&navigator.hardwareConcurrency>2?3:1});
    return done;
  },[loadingExample]);
  const defaultExampleCancelled=useRef(false);
  function cancelDefaultExample() {defaultExampleCancelled.current=true;setLoadingExample(false);}
  useEffect(()=>{
    if(!loadDefaultExample)return;
    let disposed=false;
    void (async()=>{
      try {
        try {
          const saved=await readRecovery();
          if(disposed)return;
          if(defaultExampleCancelled.current){setRecoveryReady(true);return;}
          if(saved) {
            const reply=await geometryTask({type:'import',runId:0,documentRevision:0,files:[{name:'recovery.json',text:JSON.stringify(saved)}],scale:1});
            if(disposed)return;
            if(defaultExampleCancelled.current){setRecoveryReady(true);return;}
            if(reply.type!=='import-review')throw Error('Could not restore the previous project.');
            switchProject({...reply.review,saved:false});
            setRecoveryReady(true);
            return;
          }
          setRecoveryReady(true);
        } catch {
          if(!disposed)setRecoveryError('Browser saving is unavailable. Export the project to keep a copy.');
        }
        const imported=await loadExample('gardeyn2.json',AbortSignal.timeout(10000));
        if(disposed||defaultExampleCancelled.current)return;
        const prepared=await geometryTask({type:'prepare-layout',runId:0,documentRevision:0,document:imported.document,pinnedIds:[],compact:true});
        if(disposed||defaultExampleCancelled.current)return;
        if(prepared.type!=='normalized')throw Error('Could not arrange gardeyn2.json.');
        const document=withDocumentPlacements(prepared.document);
        setDoc(document);setExported({document});setFitRequest(n=>n+1);
      } catch(error) {
        if(!disposed&&!defaultExampleCancelled.current)setError(`The demo could not load. You can still create or import a project. ${String(error)}`);
      } finally {if(!disposed)setLoadingExample(false);}
    })();
    return ()=>{disposed=true;};
  },[loadDefaultExample]);
  const unexported=doc.name!==exported.document.name||doc.parts!==exported.document.parts||doc.placements!==exported.document.placements||Object.keys(doc.settings).some(key=>doc.settings[key as keyof typeof doc.settings]!==exported.document.settings[key as keyof typeof doc.settings])||result!==exported.result;
  const live=solver.live?.result.documentRevision===revision?solver.live:undefined;
  const showingLive=resultMode==='live'&&!!live;
  const selected=useMemo(()=>[...new Set([...selectedCopies.map(copy=>copy.partId),...unusedSelection])],[selectedCopies,unusedSelection]);
  const visibleResult=showingLive?live?.result:result;
  const canvasDocument=useMemo(()=>visibleResult?{...doc,placements:visibleResult.placements}:doc,[doc,visibleResult]);
  const chosen=doc.parts.find(p=>p.id===selected[0]);
  const mixedRotations=chosen&&doc.parts.some(part=>selected.includes(part.id)&&rotationValue(part.rotations)!==rotationValue(chosen.rotations));
  const selectedBox=useMemo(()=>selectionBounds(canvasDocument,selected,selectedCopies),[canvasDocument,selected,selectedCopies]);
  const invalidSettings=!sizeValid||!Number.isFinite(doc.settings.materialWidthMm)||doc.settings.materialWidthMm<=0||doc.settings.materialWidthMm>100_000||((doc.settings.materialType??'roll')==='sheet'&&(!Number.isFinite(doc.settings.materialLengthMm)||doc.settings.materialLengthMm!<=0||doc.settings.materialLengthMm!>100_000))||!Number.isFinite(doc.settings.clearanceMm)||doc.settings.clearanceMm<0||doc.settings.clearanceMm>=doc.settings.materialWidthMm||doc.parts.some(p=>!validQuantity(p.quantity))||doc.parts.reduce((n,p)=>n+p.quantity,0)>500;
  const recoveryResult=running?undefined:result;
  const browserSavePending=browserSaved?.document!==doc||browserSaved?.result!==recoveryResult||browserSaved?.revision!==revision;
  const browserSaveState=recoveryError?'error':!recoveryReady||loadingExample?'loading':invalidSettings||!!polygon?.length?'unsaved':browserSavePending?'saving':'saved';
  const browserSaveLabel={error:'Tarayıcıya kaydedilmedi',loading:'Proje yükleniyor…',unsaved:'Tarayıcıya kaydedilmedi',saving:'Tarayıcıya kaydediliyor…',saved:'Tarayıcıya kaydedildi'}[browserSaveState];
  useEffect(()=>{
    if(!recoveryReady||loadingExample||invalidSettings||!doc.name.trim())return;
    const project={...doc,...(recoveryResult?{placements:recoveryResult.placements,result:recoveryResult}:{}),schemaVersion:1 as const,revision};
    let written=false,active=true;
    const write=()=>{
      if(written)return;written=true;
      void saveRecovery(project).then(()=>{if(active){setBrowserSaved({document:doc,result:recoveryResult,revision});setRecoveryError('');}},()=>{if(active)setRecoveryError('Changes could not be saved in this browser. Export the project to keep a copy.');});
    };
    const timer=setTimeout(write,500);
    const hidden=()=>{if(document.visibilityState==='hidden')write();};
    window.addEventListener('pagehide',write);document.addEventListener('visibilitychange',hidden);
    return ()=>{active=false;clearTimeout(timer);window.removeEventListener('pagehide',write);document.removeEventListener('visibilitychange',hidden);};
  },[doc,recoveryResult,revision,loadingExample,recoveryReady,invalidSettings]);
  useEffect(()=>{
    if(running||!result) return;
    const next=withDocumentPlacements(doc,result.placements);
    if(!placementLayoutsEqual(doc,next)) setDoc(next);
  },[running,result,doc]);
  useEffect(()=>{if(!running&&result)setResultMode('checked');},[running,result]);
  function commit(next:Document,geometry=true,field?:string) {
    const parts=new Map(next.parts.map(part=>[part.id,part]));
    const placements=next.placements?.filter(copy=>parts.has(copy.partId)&&copy.copyIndex<(Number.isInteger(parts.get(copy.partId)!.quantity)?Math.max(0,parts.get(copy.partId)!.quantity):1));
    let canonical:Document;
    try {canonical=withDocumentPlacements({...next,placements});} catch(error) {setError(String(error));return;}
    setUnusedSelection(previous=>previous.filter(id=>canonical.parts.some(part=>part.id===id&&part.quantity===0)));
    setSelectedCopies(previous=>previous.filter(copy=>canonical.parts.some(part=>part.id===copy.partId&&copy.copyIndex<part.quantity)));
    // Keep live field feedback, but record only the value before this editing session.
    if(!field||fieldEdit.current?.key!==field||fieldEdit.current.document!==doc)
      history.current=[...history.current.slice(-49),{doc,geometry,selection:selectedCopies,unused:unusedSelection}];
    fieldEdit.current=field?{key:field,document:canonical}:undefined;future.current=[];
    cancelDefaultExample();setDoc(canonical);setError('');
    if(geometry) {setRevision(r=>r+1);solver.invalidate();}
  }
  useEffect(()=>{
    const apply=(event:Event)=>{
      if(locked)return;
      const settings=(event as CustomEvent<RemoteAdminSettings>).detail;
      if(!settings||typeof settings!=='object')return;
      const nextSettings={...doc.settings};
      if(Number.isFinite(settings.materialWidthMm)&&Number(settings.materialWidthMm)>0)nextSettings.materialWidthMm=Number(settings.materialWidthMm);
      if(Number.isFinite(settings.clearanceMm)&&Number(settings.clearanceMm)>=0)nextSettings.clearanceMm=Number(settings.clearanceMm);
      if(settings.materialType==='roll'||settings.materialType==='sheet')nextSettings.materialType=settings.materialType;
      if(settings.solverPreset==='standard'||settings.solverPreset==='fast')nextSettings.solverPreset=settings.solverPreset;
      let parts=doc.parts;
      if(settings.rotation){
        const rotations:RotationRule=settings.rotation==='free'?{kind:'continuous'}:settings.rotation==='fixed'?{kind:'discrete',degrees:[0]}:{kind:'discrete',degrees:[0,180]};
        parts=doc.parts.map(part=>({...part,rotations}));
      }
      const changed=JSON.stringify(nextSettings)!==JSON.stringify(doc.settings)||parts!==doc.parts;
      if(changed)commit({...doc,settings:nextSettings,parts},true,'admin-settings');
    };
    window.addEventListener('serula-user-settings',apply);
    window.addEventListener('serula-remote-settings',apply);
    return()=>{window.removeEventListener('serula-user-settings',apply);window.removeEventListener('serula-remote-settings',apply)};
  },[doc,locked]);
  async function prepareDocument(next:Document,pinnedIds:string[]=[],compact=false) {
    const reply=await geometryTask({type:'prepare-layout',runId:++operation.current,documentRevision:revision,document:next,pinnedIds,compact});
    if(reply.type!=='normalized')throw Error('Could not arrange the preparation drawing.');
    const parts=next.parts.map((part,i)=>({...part,preparationPosition:reply.document.parts[i].preparationPosition}));
    const placements=documentPlacements(next).map(placement=>{
      const before=next.parts.find(part=>part.id===placement.partId)!.preparationPosition;
      const after=parts.find(part=>part.id===placement.partId)!.preparationPosition;
      return {...placement,xMm:placement.xMm+after[0]-before[0],yMm:placement.yMm+after[1]-before[1]};
    });
    return withDocumentPlacements({...next,parts},placements);
  }
  function restore(redo=false) {
    if(locked) return;
    fieldEdit.current=undefined;
    const from=redo?future:history,to=redo?history:future,entry=from.current.pop();
    if(!entry) return;
    to.current.push({doc,geometry:entry.geometry,selection:selectedCopies,unused:unusedSelection});setDoc(withDocumentPlacements(entry.doc));
    setUnusedSelection(entry.unused);
    setSelectedCopies(entry.selection.filter(copy=>entry.doc.parts.some(part=>part.id===copy.partId&&copy.copyIndex<part.quantity)));
    if(entry.geometry) {setRevision(r=>r+1);solver.invalidate();}
  }
  useEffect(()=>{
    if(solver.state!=='Initializing'&&solver.state!=='Running')return;
    const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',leave);return ()=>window.removeEventListener('beforeunload',leave);
  },[solver.state]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{try {
      if(document.querySelector('dialog[open]'))return;
      const editable=isEditableTarget(e.target);
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!editable) {e.preventDefault();restore(e.shiftKey);return;}
      if(e.key==='Escape') {setUnusedSelection([]);setSelectedCopies([]);setPolygon(undefined);}
      if(e.key==='Enter'&&polygon&&!locked&&!editable) {e.preventDefault();void addShape('polygon');return;}
      if(editable||locked||e.altKey||!selected.length)return;
      if(e.key==='Backspace'||e.key==='Delete') {e.preventDefault();if(!selectedCopies.length)return;commit(removeCopies(canvasDocument,selectedCopies));setSelectedCopies([]);return;}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d') {
        e.preventDefault();if(!selectedCopies.length)return;try {
          const next=duplicateCopies(canvasDocument,selectedCopies),oldCounts=new Map(doc.parts.map(part=>[part.id,part.quantity]));
          commit(next);setSelectedCopies(documentPlacements(next).filter(copy=>copy.copyIndex>=oldCounts.get(copy.partId)!).map(({partId,copyIndex})=>({partId,copyIndex})));
        }catch(error){setError(String(error));}return;
      }
      if(e.metaKey||e.ctrlKey)return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selectedCopies.length) {
        e.preventDefault();const step=e.shiftKey?10:1;
        commit(movePlacements(canvasDocument,selectedCopies,[e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0]),true,'nudge');return;
      }
      const action=preparationShortcut(e.key);
      const refs=selectedCopies.length?selectedCopies:copyRefsFor(doc,selected);
      if(action==='rotate'&&selectedBox){e.preventDefault();const next=rotateToNextOrientation(canvasDocument,refs);if(!placementLayoutsEqual(canvasDocument,next))commit(next);return;}
      if(action!=='increase-quantity'&&action!=='decrease-quantity')return;
      const parts=doc.parts.filter(part=>selected.includes(part.id));
      if(!parts.length||parts.some(part=>!validQuantity(part.quantity)))return;
      const delta=action==='increase-quantity'?1:-1,total=doc.parts.reduce((sum,part)=>sum+part.quantity,0);
      if(delta>0?(total+parts.length>500||parts.some(part=>part.quantity>=500)):parts.some(part=>part.quantity<=0))return;
      e.preventDefault();
      const parents=parts.flatMap(part=>{const copy=refs.find(copy=>copy.partId===part.id);return copy?[copy]:[];});
      if(delta>0) {
        const duplicated=parents.length?duplicateCopies(canvasDocument,parents):canvasDocument;
        const next=syncQuantity({...duplicated,parts:duplicated.parts.map(part=>unusedSelection.includes(part.id)?{...part,quantity:1}:part)});commit(next);setUnusedSelection([]);
        setSelectedCopies(parts.map(part=>({partId:part.id,copyIndex:part.quantity})));
      } else {
        const next=removeCopies(canvasDocument,parents);commit(next);
        setSelectedCopies(parents.filter(copy=>next.parts.find(part=>part.id===copy.partId)!.quantity>0)
          .map(copy=>({...copy,copyIndex:Math.min(copy.copyIndex,next.parts.find(part=>part.id===copy.partId)!.quantity-1)})));
      }
    }catch(error){setError(String(error));}};
    const endNudge=()=>{if(fieldEdit.current?.key==='nudge')fieldEdit.current=undefined;};
    window.addEventListener('keydown',key);window.addEventListener('keyup',endNudge);window.addEventListener('blur',endNudge);
    return ()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',endNudge);window.removeEventListener('blur',endNudge);};
  });
  async function fullPlateSelected() {
    if(locked||selected.length!==1||!chosen)return;
    if((doc.settings.materialType??'roll')!=='sheet') {setError('Tam plaka için malzeme tipini Plaka seçin.');return;}
    const plateLength=doc.settings.materialLengthMm;
    if(typeof plateLength!=='number'||!Number.isFinite(plateLength)||plateLength<=0){setError('Geçerli bir plaka uzunluğu girin.');return;}
    const clearance=doc.settings.clearanceMm;
    const usableWidth=doc.settings.materialWidthMm-2*clearance;
    const usableLength=plateLength-2*clearance;
    const area=netArea(chosen);
    if(!(usableWidth>0&&usableLength>0&&area>0)) {setError('Tam plaka için plaka ölçülerini ve parça geometrisini kontrol edin.');return;}
    const quantity=Math.max(1,Math.min(500,Math.floor((usableWidth*usableLength)/area)));
    const next=syncQuantity({...doc,parts:doc.parts.map(part=>({...part,quantity:part.id===chosen.id?quantity:0}))});
    commit(next);
    setUnusedSelection(doc.parts.filter(part=>part.id!==chosen.id).map(part=>part.id));
    setSelectedCopies(copyRefsFor(next,[chosen.id]));
    await run(next,revision+1);
  }
  async function run(document=doc,rev=revision) {
    const requestedAt=performance.now();
    setBusy(true);setError('');setResultMode('live');
    const id=++operation.current;
    try {
      const reply=await geometryTask({type:'normalize',runId:id,documentRevision:rev,document});
      if(id!==operation.current || reply.type!=='normalized') return;
      solver.start(reply.document,rev,threads||undefined,requestedAt);
    } catch(e) {setError(String(e));} finally {if(id===operation.current)setBusy(false);}
  }
  async function openFiles(list:FileList|File[],intent:'project'|'shapes'|'auto'='auto') {
    if(locked) return;
    const batch=Array.from(list);
    if(batch.some(f=>f.size>(/\.zip$/i.test(f.name)?25:10)*1024*1024)||batch.reduce((n,f)=>n+f.size,0)>25*1024*1024) {setError('Import limit: 10 MiB per drawing, 25 MiB per project ZIP or batch.');return;}
    if(!batch.length)return;cancelDefaultExample();setBusy(true);setError('');
    try{
      const read=await Promise.all(batch.map(async f=>({name:f.name,text:/\.zip$/i.test(f.name)?(await import('./zip')).projectArchiveText(new Uint8Array(await f.arrayBuffer())):await f.text()})));
      setFileIntent(intent);setReview(undefined);setScale(1);setLayers(undefined);setAvailableLayers([]);setExcludeIssues(false);setFiles(read);
      // Normal DXF/SVG imports should be one tap: parse immediately and add valid parts.
      // Keep the review screen only when the importer actually needs user attention.
      if(intent==='shapes'&&read.every(f=>/\.(dxf|svg)$/i.test(f.name))){
        const reply=await geometryTask({type:'import',runId:++operation.current,documentRevision:revision,files:read,scale:1,tolerance,enclosed,layers:undefined});
        if(reply.type==='import-review'){
          setAvailableLayers(reply.review.layers??[]);
          setPreviewStale(false);
          if(!reply.review.replace&&reply.review.document.parts.length>0&&!(reply.review.issues?.length)){
            await addParts(reply.review.document.parts,reply.review.warnings,true);
            setFiles(undefined);setReview(undefined);setFitRequest(n=>n+1);
          }else if(reply.review.document.parts.length>0){
            await addParts(reply.review.document.parts,reply.review.warnings,true);
            setFiles(undefined);setReview(undefined);setFitRequest(n=>n+1);
            // Keep successfully imported DXF parts usable without flooding the workspace with repeated contour warnings.
          }else{
            setFiles(undefined);setReview(undefined);
            setError(reply.review.issues?.join(' ')||'DXF içinde içe aktarılabilir kapalı kontur bulunamadı.');
          }
        }
      }
    }
    catch(e){setError(`DXF içe aktarılamadı: ${e instanceof Error?e.message:String(e)}`);}finally{setBusy(false);}
  }
  async function preview() {
    if(!files) return;setBusy(true);setError('');setExcludeIssues(false);
    try {const reply=await geometryTask({type:'import',runId:++operation.current,documentRevision:revision,files,scale,tolerance,enclosed,layers});if(reply.type==='import-review'){setReview(reply.review);setPreviewStale(false);setAvailableLayers(reply.review.layers??[]);}}
    catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function addParts(parts:Part[],warnings:string[]=[],preserveSourceLayout=false) {
    cancelDefaultExample();
    const reply=await geometryTask({type:'normalize',runId:++operation.current,documentRevision:revision,document:{...doc,parts:[...doc.parts,...parts]}});
    if(reply.type!=='normalized')throw Error('Could not add these shapes.');
    const next=preserveSourceLayout?reply.document:await prepareDocument(reply.document,doc.parts.map(p=>p.id));
    commit(next);
    setUnusedSelection([]);setSelectedCopies(copyRefsFor(next,parts.map(part=>part.id)));setImportWarnings(previous=>[...previous,...warnings]);
  }
  function switchProject(next:ProjectSwitch) {
    cancelDefaultExample();
    const nextRevision=revision+1,checked=next.result?{...next.result,documentRevision:nextRevision}:undefined;
    const document=withDocumentPlacements(next.document,checked?.placements ?? next.document.placements);
    ++operation.current;solver.invalidate();setRevision(nextRevision);setDoc(document);
    history.current=[];future.current=[];fieldEdit.current=undefined;partAnchor.current=0;setUnusedSelection([]);setSelectedCopies([]);setPolygon(undefined);setFiles(undefined);setReview(undefined);setPendingProject(undefined);setError('');setImportWarnings(next.warnings??[]);setFitRequest(n=>n+1);setResultMode(checked?'checked':'live');
    if(checked)solver.load(checked);
    setExported({document:next.saved?document:withDocumentPlacements(emptyProject()),result:next.saved?checked:undefined});
    if(next.nest)void run(document,nextRevision);
  }
  function requestProject(next:ProjectSwitch) {
    if(unexported||polygon?.length)setPendingProject(next);else switchProject(next);
  }
  const openingSparrowProject=fileIntent==='project'&&files?.length===1&&!!review?.document.parts.length&&review.document.parts.every(part=>part.source.format==='sparrow');
  async function accept(asProject=openingSparrowProject) {
    if(!review||previewStale||(!review.replace&&!review.document.parts.length)||review.issues?.length&&!excludeIssues)return;
    setBusy(true);setError('');
    try {
      if(review.replace){
        // A saved project already contains its exact per-copy layout. Preserve
        // those coordinates and angles byte-for-byte instead of re-running the
        // preparation arranger and introducing floating-point drift.
        requestProject({document:review.document,result:review.result,warnings:review.warnings,saved:true});
      } else if(asProject){
        const document=await prepareDocument(review.document,[],true);
        requestProject({document,result:review.result,warnings:review.warnings,saved:false});
      }
      else{await addParts(review.document.parts,review.warnings,true);setFiles(undefined);setReview(undefined);setFitRequest(n=>n+1);}
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  function editPart(change:Partial<Part>,geometry=true,field?:string) {if(chosen)commit({...doc,parts:doc.parts.map(p=>selected.includes(p.id)?{...p,...change}:p)},geometry,field);}
  function positionSelection(axis:0|1,value:number) {
    if(!selectedBox||locked)return;
    const delta=value-selectedBox[axis];
    const refs=selectedCopies.length?selectedCopies:copyRefsFor(doc,selected);
    commit(movePlacements(canvasDocument,refs,axis===0?[delta,0]:[0,delta]));
  }
  async function transformSelection(edit:GeometryEdit,refs=selectedCopies.length?selectedCopies:copyRefsFor(doc,selected)) {
    if(edit.kind==='scale') {
      const ids=new Set(refs.map(ref=>ref.partId));
      const importedDxf=doc.parts.filter(part=>ids.has(part.id)&&part.source.format==='dxf');
      if(importedDxf.length) {
        setError('DXF parçalarının ölçüleri kilitlidir. İçe aktarılan DXF dosyasının genişlik ve yüksekliği değiştirilemez.');
        return;
      }
    }
    if(locked||!selected.length)return;setBusy(true);setError('');
    try {
      const reply=await geometryTask({type:'edit-selection',runId:++operation.current,documentRevision:revision,document:canvasDocument,ids:selected,edit,refs});
      if(reply.type==='normalized')commit(reply.document);
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function addShape(kind:'rectangle'|'circle'|'polygon') {
    cancelDefaultExample();setBusy(true);setError('');
    try {
      const reply=await geometryTask({type:'shape',runId:++operation.current,documentRevision:revision,shape:kind,width:shapeWidth,height:shapeHeight,points:polygon});
      if(reply.type==='part') {
        await addParts([reply.part]);setShape(undefined);setPolygon(undefined);
      }
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  const exportBlockedReason=busy?'Wait for the current operation to finish.':invalidSettings?'Fix invalid settings before downloading.':showingLive?'Switch to the best valid solution view to download.':running&&!result?'Wait for a best valid solution before downloading.':undefined;
  async function exportLayout() {
    if(busy||invalidSettings||showingLive||(running&&!result))return false;
    setBusy(true);setError('');
    try {
      const reply=await geometryTask({type:'export',runId:++operation.current,documentRevision:revision,document:canvasDocument,result});
      if(reply.type==='export-result'){
        const content=reply.bundle.dxf;
        download(`${exportAd}.dxf`,content,'application/dxf');setDownloadedResult(true);setExported({document:doc,result});return true;
      }
      return false;
    } catch(e){setError(String(e));return false;}finally{setBusy(false);}
  }
  const sourceAd=(doc.parts.find(part=>part.source.format==='dxf')?.source.fileName??doc.name).replace(/\.dxf$/i,'').trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'').slice(0,100)||'project';
  const exportAd=`${sourceAd}-serula`;
  const totalArea=useMemo(()=>doc.parts.reduce((n,p)=>n+netArea(p)*p.quantity,0),[doc.parts]);
  const materialArea=result?(doc.settings.materialType==='sheet'&&doc.settings.materialLengthMm
    ? doc.settings.materialWidthMm*doc.settings.materialLengthMm*(result.sheetCount??1)
    : doc.settings.materialWidthMm*result.usedLengthMm):0;
  const utilization=result&&materialArea>0?totalArea/materialArea*100:0;
  const waste=result?Math.max(0,100-utilization):0;
  const improvement=result&&phaseImprovements(solver.diagnostics.current?.history??[],result.usedLengthMm);
  return <div className="app" onBlurCapture={()=>{fieldEdit.current=undefined;}} onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLInputElement&&e.target.hasAttribute('data-undo-field')){e.preventDefault();e.target.blur();}}} onMouseDownCapture={e=>{const target=e.target;focusClick.current=target instanceof HTMLInputElement&&['text','number'].includes(target.type)&&document.activeElement!==target?target:null;}} onMouseUpCapture={e=>{if(focusClick.current===e.target){e.preventDefault();focusClick.current.select();}focusClick.current=null;}} onFocusCapture={e=>{const input=e.target;if(input instanceof HTMLInputElement&&['text','number'].includes(input.type))input.select();}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!document.querySelector('dialog[open]'))void openFiles(e.dataTransfer.files);}}>
    <header className="header"><div className="brand-block"><a className="brand serula-brand" aria-label="Serula Nesting Studio" href={import.meta.env.BASE_URL}><img src={`${import.meta.env.BASE_URL}serula-logo.svg`} alt="" /><strong>Serula Nesting</strong><span>/studio · Sürüm {packageInfo.version}</span></a><p className="tagline">Akıllı DXF yerleştirme ve malzeme optimizasyonu</p></div>
      <div className="header-primary project-bar"><details className="project-menu" ref={projectMenu}><summary aria-label={`Project: ${doc.name}`}>{doc.name}<span aria-hidden="true"> ▾</span></summary><div>
        <button disabled={locked} onClick={()=>{projectMenu.current!.open=false;setProjectAd('Adsız proje');setNameDialog('new');}}>Yeni proje</button>
        <button disabled={locked} onClick={()=>{projectMenu.current!.open=false;projectInput.current?.click();}}>Proje aç</button>
        
        <button disabled={locked} onClick={()=>{projectMenu.current!.open=false;setProjectAd(doc.name);setNameDialog('rename');}}>Projeyi yeniden adlandır</button>
      </div></details><small className="project-status" data-save-state={browserSaveState} aria-live="polite" title={recoveryError||(invalidSettings?'Fix invalid values to save changes.':polygon?.length?'Finish or cancel the polygon to save changes.':'Bu tarayıcıda bu cihaza otomatik kaydedilir.')}><span aria-hidden="true">{browserSaveState==='saved'?'✓':browserSaveState==='error'||browserSaveState==='unsaved'?'!':'◷'}</span>{browserSaveLabel}</small></div>
      <nav><button className="mobile-settings" aria-expanded={panel} aria-controls="parts-settings" onClick={()=>setPanel(!panel)}>Parçalar &amp; ayarlar</button><button className="theme-toggle" title="Toggle light/dark mode" aria-label="Toggle light/dark mode" onClick={()=>setTheme(theme==='dark'||theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'light':'dark')}><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/></svg></button><button aria-label="Serula Nesting Hakkında" onClick={()=>setInfo('about')}><span aria-hidden="true">ⓘ</span>Hakkında</button><button className="hello-button" aria-label="İletişim" onClick={()=>setInfo('contact')}><span className={downloadedResult?'hello-wave':undefined} aria-hidden="true">☎</span>İletişim</button></nav>
      <input ref={input} hidden type="file" multiple accept=".json,.svg,.dxf" onChange={e=>{if(e.target.files)void openFiles(e.target.files,'shapes');e.target.value='';}}/>
      <input ref={projectInput} hidden type="file" accept=".zip,.sparrow-project.json,.json" onChange={e=>{if(e.target.files)void openFiles(e.target.files,'project');e.target.value='';}}/>
      {solver.state==='Running'&&<span className="background-hint">En iyi performans için bu sekmeyi açık tutun</span>}
    </header>
    {(error||solver.error)&&<div className="error-banner" role="alert">{error||solver.error}</div>}
    {recoveryError&&<div className="error-banner" role="alert">{recoveryError}</div>}
    <main className="main-workspace">
      <aside id="parts-settings" className={`sidebar ${panel?'open':''}`}>
        <div className="panel-title"><h2>Parçalar <span>{displayedPieceCount(doc.parts)}</span></h2><button onClick={()=>setInfo('help')}>Yardım</button></div>
        <div className="parts-list">{doc.parts.map((p,i)=>{const b=bounds(p.outer);return <div key={p.id} className={`part-row ${selected.includes(p.id)?'selected':''}`}>
          <button className="part-select" aria-pressed={selected.includes(p.id)} onClick={e=>{
            const additive=e.metaKey||e.ctrlKey;
            let next:string[];
            if(e.shiftKey){
              const range=doc.parts.slice(Math.min(partAnchor.current,i),Math.max(partAnchor.current,i)+1).map(part=>part.id);
              next=additive?[...new Set([...selected,...range])]:range;
            }else{
              partAnchor.current=i;
              next=additive?(selected.includes(p.id)?selected.filter(id=>id!==p.id):[...selected,p.id]):[p.id];
            }
            setSelectedCopies(copyRefsFor(doc,next));
            setUnusedSelection(next.filter(id=>doc.parts.some(part=>part.id===id&&part.quantity===0)));
          }}>
            <svg aria-hidden="true" viewBox={`${b[0]-2} ${-b[3]-2} ${b[2]-b[0]+4} ${b[3]-b[1]+4}`}><path d={pathData([p.outer,...p.holes])} transform="scale(1 -1)" fillRule="evenodd" fill={colors[i%colors.length]}/></svg>
            <span>{p.name}<small>{length(b[2]-b[0])} × {length(b[3]-b[1])} {unit}</small><small className="rotation-summary">{rotationSummary(p.rotations)}</small></span>
          </button><input data-undo-field aria-label={`Quantity for ${p.name}`} type="number" min="0" max="500" aria-invalid={!validQuantity(p.quantity)} value={Number.isFinite(p.quantity)?p.quantity:''} disabled={locked} onChange={e=>commit(syncQuantity({...doc,parts:doc.parts.map(part=>part.id===p.id?{...part,quantity:e.target.valueAsNumber}:part)}),true,`quantity:${p.id}`)}/>
          <button className="remove-part" aria-label={`Remove ${p.name}`} title={`Remove ${p.name} and all its kopya`} disabled={locked} onClick={()=>commit({...doc,parts:doc.parts.filter(part=>part.id!==p.id)})}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button>
          {!validQuantity(p.quantity)&&<small role="alert" className="field-error quantity-error">Enter a whole number from 0 to 500.</small>}
        </div>;})}</div>
        {doc.parts.reduce((n,p)=>n+(Number.isFinite(p.quantity)?p.quantity:0),0)>500&&<p role="alert" className="field-error quantity-total">This drawing exceeds the 500-copy limit. Reduce quantities to continue.</p>}
        {doc.parts.some(part=>part.quantity===0)&&<button className="text-button clear-unused" disabled={locked} onClick={()=>commit({...doc,parts:doc.parts.filter(part=>part.quantity!==0)})}>Adedi sıfır olan parçaları kaldır</button>}
        <div className="add-shape"><button disabled={locked} onClick={()=>setShape('rectangle')}>Şekil çiz</button><button className="primary" disabled={locked} onClick={()=>input.current?.click()}>DXF İçe Aktar</button></div>
        <p className="import-formats">SVG veya DXF dosyası içe aktar</p>
        <div className="row-actions history"><button disabled={locked||!history.current.length} onClick={()=>restore()}>Geri al</button><button disabled={locked||!future.current.length} onClick={()=>restore(true)}>Yinele</button></div>
        <section className="settings"><h2>Malzeme ve Yerleşim</h2>
          <label>Malzeme tipi<select value={doc.settings.materialType??'roll'} disabled={locked} onChange={e=>{const materialType=e.target.value as 'roll'|'sheet';const settings=materialType==='roll'?{...doc.settings,materialType,materialLengthMm:undefined}:{...doc.settings,materialType,materialLengthMm:doc.settings.materialLengthMm??1000};commit({...doc,settings},false)}}><option value="roll">Rulo</option><option value="sheet">Plaka</option></select></label>
          <label>Malzeme genişliği <span>{unit}</span><input data-undo-field type="number" min={0.001/factor} max={100000/factor} step="any" value={inputLength(doc.settings.materialWidthMm)} onFocus={()=>setMaterialWidthFocused(true)} onBlur={()=>setMaterialWidthFocused(false)} disabled={locked} onChange={e=>commit({...doc,settings:{...doc.settings,materialWidthMm:e.target.valueAsNumber*factor}},true,'material-width')}/></label>
          {(!Number.isFinite(doc.settings.materialWidthMm)||doc.settings.materialWidthMm<=0||doc.settings.materialWidthMm>100_000)&&<small role="alert" className="field-error">Geçerli bir malzeme genişliği girin.</small>}
          {(doc.settings.materialType??'roll')==='sheet'&&<><label>Plaka uzunluğu <span>{unit}</span><input data-undo-field type="number" min={0.001/factor} max={100000/factor} step="any" value={inputLength(doc.settings.materialLengthMm??0)} disabled={locked} onChange={e=>commit({...doc,settings:{...doc.settings,materialLengthMm:e.target.valueAsNumber*factor}},true,'material-length')}/></label>{(!Number.isFinite(doc.settings.materialLengthMm)||doc.settings.materialLengthMm!<=0)&&<small role="alert" className="field-error">Geçerli bir plaka uzunluğu girin.</small>}</>}
          <label>Parça aralığı <span>{unit}</span><input data-undo-field type="number" min="0" step="any" value={inputLength(doc.settings.clearanceMm)} disabled={locked} onChange={e=>commit({...doc,settings:{...doc.settings,clearanceMm:e.target.valueAsNumber*factor}},true,'clearance')}/></label><label>Başlangıç yönü<select value={doc.settings.startCorner??'right-bottom'} disabled={locked} onChange={e=>commit({...doc,settings:{...doc.settings,startCorner:e.target.value as 'right-top'|'right-bottom'}},false)}><option value="right-bottom">Sağ alt ↘</option><option value="right-top">Sağ üst ↗</option></select></label>
          {doc.settings.clearanceMm>0&&<small>Sparrow ayrıca malzeme kenarlarında {length(doc.settings.clearanceMm)} {unit} pay bırakır. Bu kesim kerfi değildir.</small>}
          {(!Number.isFinite(doc.settings.clearanceMm)||doc.settings.clearanceMm<0||doc.settings.clearanceMm>=doc.settings.materialWidthMm)&&<small role="alert" className="field-error">Enter zero or a positive clearance smaller than the material width.</small>}
          <label>Durdurma koşulu<select value={doc.settings.timeLimitSeconds??'auto'} disabled={locked} onChange={e=>commit({...doc,settings:{...doc.settings,timeLimitSeconds:e.target.value==='auto'?null:Number(e.target.value) as 10|30|60|120|300|600}},false)}><option value="auto">Otomatik · en fazla 59 sn</option>{[10,30,60,120,300,600].map(s=><option value={s} key={s}>{s<60?`Up to ${s} seconds`:`Up to ${s/60} minute${s>60?'s':''}`}</option>)}</select></label>
          <details className="solver-options"><summary>Yerleştirme seçenekleri</summary><label>Arama modu<select disabled={locked} value={doc.settings.solverPreset??'standard'} aria-describedby="preset-description" onChange={e=>commit({...doc,settings:{...doc.settings,solverPreset:e.target.value as 'standard'|'fast'}},false)}><option value="standard">Standart</option><option value="fast">Hızlı</option></select></label><small id="preset-description">{doc.settings.solverPreset==='fast'?'Good layouts sooner. A greedier search that may miss the best final layout.':'A more thorough search for the best final layout.'}</small><label>İşlemci iş parçacıkları<select disabled={locked} value={threads} onChange={e=>setThreads(Number(e.target.value))}><option value={0}>Otomatik</option>{[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select></label>{solver.workers&&<small>Last initialized run: {solver.workers.actual} solver worker{solver.workers.actual===1?'':'s'}.{solver.workers.reason&&` ${solver.workers.reason}`}</small>}<small>{crossOriginIsolated?'Otomatik mod bir işlemci çekirdeğini boş bırakır ve en fazla 3 iş parçacığı kullanır.':'Bu tarayıcı oturumu bir thread.'}</small></details>
          <small>Arama ilerlemediğinde otomatik durur. İstediğiniz zaman durdurabilirsiniz.</small>
        </section>
      </aside>
      <section className="drawing-panel">
        <Workspace optimizing={running} onSelectCopies={kopya=>{setUnusedSelection([]);setSelectedCopies(kopya);}} materialWidthFocused={materialWidthFocused} unit={unit} fitRequest={fitRequest} document={canvasDocument} result={visibleResult} live={showingLive?live:undefined} selected={selected} selectedCopies={selectedCopies} disabled={locked} onTransform={transformSelection}
          polygon={polygon} onDraw={point=>{if(!locked)setPolygon(p=>[...(p??[]),point]);}}
          onSelect={(copy,toggle)=>{setUnusedSelection([]);if(!copy){setSelectedCopies([]);return;}const key=`${copy.partId}:${copy.copyIndex}`,already=selectedCopies.some(p=>`${p.partId}:${p.copyIndex}`===key);const nextCopies=toggle?(already?selectedCopies.filter(p=>`${p.partId}:${p.copyIndex}`!==key):[...selectedCopies,copy]):already?selectedCopies:[copy];setSelectedCopies(nextCopies);}}
          onMove={positions=>{const current=documentPlacements(canvasDocument);const updates=positions.map(position=>{const previous=current.find(p=>p.partId===position.partId&&p.copyIndex===position.copyIndex);return previous?{...previous,xMm:position.position[0],yMm:position.position[1]}:undefined;}).filter((position):position is NonNullable<typeof position>=>!!position);commit(updatePlacements(canvasDocument,updates));}}/>
        {!doc.parts.length&&!polygon&&<div className="empty-project"><h2>Projeniz boş</h2><p>Bir şekil çizin, ( DXF ) içe aktarın veya kütüphaneden şekil ekleyin.</p><div className="empty-project-actions"><button className="primary" disabled={locked} onClick={()=>input.current?.click()}>DXF İçe Aktar</button></div></div>}
        {polygon&&<div className="polygon-actions"><span>{polygon.length} vertices</span><button disabled={locked||polygon.length<3} onClick={()=>void addShape('polygon')}>Çokgeni tamamla</button><button onClick={()=>setPolygon(undefined)}>Çokgeni iptal et</button></div>}
        {(live||result)&&<div className={`result-details${showingLive?' live-details':''}`}><div className="result-mode" role="group" aria-label="Result display"><button aria-pressed={resultMode==='live'} disabled={!live} onClick={()=>setResultMode('live')}>{running&&<i className="live-dot" aria-hidden="true"/>}Live search</button><button aria-pressed={resultMode==='checked'} disabled={!result} onClick={()=>setResultMode('checked')}>En iyi geçerli yerleşim</button></div>{showingLive&&<div className="result-copy"><span><i className="overlap-key"/>Çakışmalar kırmızı</span><p>Ara yerleşimlerde geçici çakışmalar olabilir.</p></div>}</div>}
        {solver.liveError&&<p className="field-error">Live preview unavailable: {solver.liveError}</p>}
      </section>
        {chosen&&<aside className="selection-panel" aria-label="Parça özellikleri"><div className="panel-title"><h2>Parça özellikleri</h2><button aria-label="Clear selection" onClick={()=>{setUnusedSelection([]);setSelectedCopies([]);}}>×</button></div><section className="part-settings">{selected.length===1?<label>Ad<input data-undo-field value={chosen.name} disabled={locked} onChange={e=>editPart({name:e.target.value},false,`name:${chosen.id}`)}/></label>:<h2>{selected.length} parts selected</h2>}
          {selectedBox?<SelectionControls key={JSON.stringify(selectedCopies)} unit={unit} box={selectedBox} disabled={locked} sizeLocked={selected.some(id=>doc.parts.some(part=>part.id===id&&part.source.format==='dxf'))} onPosition={positionSelection} onSize={(axis,value)=>void transformSelection({kind:'scale',factor:value/(selectedBox[axis+2]-selectedBox[axis]),pivot:[selectedBox[0],selectedBox[1]]})} onRotate={degrees=>void transformSelection({kind:'rotate',degrees,pivot:[(selectedBox[0]+selectedBox[2])/2,(selectedBox[1]+selectedBox[3])/2]})} onValidity={setSizeValid}/>:<p className="muted">No kopya selected. Add a copy using its quantity to move or resize this part.</p>}
          <RotationControl key={JSON.stringify([selected,mixedRotations,chosen.rotations])} rule={chosen.rotations} mixed={!!mixedRotations} disabled={locked} onChange={rotations=>editPart({rotations})}/>
          {selected.length===1&&<div className="row-actions"><button className="primary" disabled={locked||(doc.settings.materialType??'roll')!=='sheet'} title={(doc.settings.materialType??'roll')!=='sheet'?'Önce malzeme tipini Plaka seçin.':'Seçili parçayı plakanın tamamına yerleştir.'} onClick={()=>void fullPlateSelected()}>Tam plaka</button><button disabled={locked||!history.current.length} onClick={()=>restore()}>Tam plaka iptal</button></div>}

        </section></aside>}
    </main>
    <footer className="statusbar"><div className="run-controls"><span id="compression-tooltip" role="tooltip" className="compression-tooltip"><strong>Skip to compression</strong>End exploration and refine the best layout.</span>{running?<><button className="run-button" onClick={solver.stop}>Durdur</button>{solver.canSkip&&(solver.state==='Initializing'||solver.state==='Running'&&solver.phase==='Exploration')&&<button className="run-button skip-compression" aria-label="Skip to compression" disabled={solver.state!=='Running'||solver.skipping||!solver.result} aria-describedby="compression-tooltip" onClick={solver.skipToCompression}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 5v14l9-7zM12 5v14l9-7z"/></svg></button>}</>:<button className="run-button" disabled={locked||invalidSettings||!doc.parts.some(part=>part.quantity>0)||!!polygon} onClick={()=>void run()}>{result?'Yeniden yerleştir':'Parçaları yerleştir'}</button>}</div>
      <div className="run-status"><span className="status-symbol" aria-hidden="true"><i className={running||busy?'active':undefined}/></span><span role="status" className="run-state"><span>{busy?'Checking inputs':loadingExample?'Loading example…':solver.state==='Running'&&solver.phase?(solver.skipping?'Switching…':solver.phase):solver.state}</span>{(running||solver.state==='Complete'||solver.state==='Stopped')&&<span className="run-elapsed">{solver.elapsed.toFixed(1)} s</span>}</span>{solver.workers&&<small className="worker-status" title={solver.workers.reason} data-worker-count={solver.workers.actual}>{`${solver.workers.actual} solver worker${solver.workers.actual===1?'':'s'}`}{solver.workers.requested?` / ${solver.workers.requested} istendi`:' · otomatik'}{solver.workers.reason&&' · yedek'}</small>}</div>
      <div className="metrics"><span>{doc.settings.materialType==='sheet'?'Kullanılan plaka':showingLive?'Best valid length':'Kullanılan uzunluk'} <strong>{result?(doc.settings.materialType==='sheet'?String(result.sheetCount??1):`${length(result.usedLengthMm)} ${unit}`):'—'}</strong></span><span>Malzeme verimliliği <strong>{result?`${utilization.toFixed(2)}%`:'—'}</strong></span><span>Fire <strong>{result?`${waste.toFixed(2)}%`:'—'}</strong></span>{improvement&&doc.settings.materialType!=='sheet'&&<span title="Exploration: reduction from the first valid length. Compression: further reduction from the best exploration length.">İyileştirme keşfet / sıkıştır <strong>{improvement.explore.toFixed(1)}% / {improvement.compress.toFixed(1)}%</strong></span>}</div>
      <div className="export-actions"><span className="download-control" tabIndex={exportBlockedReason?0:undefined} aria-describedby={exportBlockedReason?'download-tooltip':undefined}><button disabled={!!exportBlockedReason} className="primary" onClick={()=>void exportLayout()}>DXF İndir</button>{exportBlockedReason&&<span id="download-tooltip" role="tooltip" className="compression-tooltip">{exportBlockedReason}</span>}</span></div>

    </footer>
    {files&&<Modal title="İçe aktarmayı gözden geçir" locked={busy} onClose={()=>{setFiles(undefined);setReview(undefined);setError('');}}><p>{files.map(f=>f.name).join(', ')}</p><p className="muted">{fileIntent==='project'?'Project files restore a complete job. Drawing files can be added as shapes.':'SVG, DXF and instance JSON add shapes. A saved project restores a complete job.'}</p>
      {!review?.replace&&<><label>Bir çizim birimi<select value={scale} disabled={busy} onChange={e=>{setScale(Number(e.target.value));setPreviewStale(true);}}><option value="1">1 mm</option><option value="25.4">1 inch · 25.4 mm</option></select></label><p className="muted">Physical SVG dimensions and recognized DXF units are honored. Instance JSON and drawings without units use the selected scale.</p></>}
      {files.some(f=>!f.text.trimStart().startsWith('{'))&&<><label>Maximum curve deviation, {unit}<input type="number" min={0.000001/factor} max={100/factor} step="any" value={inputLength(tolerance)} disabled={busy} onChange={e=>{setTolerance(e.target.valueAsNumber*factor);setPreviewStale(true);}}/></label>{files.some(f=>!['<','{'].includes(f.text.trimStart()[0]))&&<p className="muted">DXF iç konturları ana parçaya kilitlenir; nesting sırasında ayrı parça olarak dağıtılmaz.</p>}</>}
      {availableLayers.length>0&&<fieldset><legend>DXF katmanları</legend>{availableLayers.map(layer=><label className="checkbox" key={layer}><input type="checkbox" disabled={busy} checked={(layers??availableLayers).includes(layer)} onChange={e=>{setLayers(e.target.checked?[...(layers??availableLayers),layer]:(layers??availableLayers).filter(l=>l!==layer));setPreviewStale(true);}}/>{layer}</label>)}</fieldset>}
      {error&&<p role="alert" className="field-error">{error}</p>}
      {review&&<>{previewStale&&<p role="status">Preview outdated. Önizlemeyi güncelle to apply your settings.</p>}<p>{review.document.parts.length} yerleşim grubu · {displayedPieceCount(review.document.parts)} parça · {review.document.parts.reduce((n,p)=>n+p.holes.length,0)} holes</p><p>Malzeme genişliği {length(review.document.settings.materialWidthMm)} {unit}</p><div className="import-parts" aria-label="İçe aktarılan şekiller">{review.document.parts.map((p,i)=>{const b=bounds(p.outer);return <div key={p.id}><svg aria-hidden="true" viewBox={`${b[0]-1} ${-b[3]-1} ${b[2]-b[0]+2} ${b[3]-b[1]+2}`}><path d={pathData([p.outer,...p.holes])} transform="scale(1 -1)" fillRule="evenodd" fill={colors[i%colors.length]}/></svg><span>{p.name}<small>{length(b[2]-b[0])} × {length(b[3]-b[1])} {unit} · {p.quantity} kopya{p.holes.length?` · ${p.holes.length} holes`:''}</small></span></div>;})}</div><ul>{review.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>{review.replace?<p>This is a saved project. Importing it restores its name, material, shapes and checked result.</p>:openingSparrowProject?<p>Opening this project restores its name, material width and shapes.</p>:<p>Şekils will be added to {doc.name}. Its name and material settings stay the same.</p>}</>}
      {!!review?.issues?.length&&<><p className="field-error">These contours cannot be imported:</p><ul>{review.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul><label className="checkbox"><input type="checkbox" checked={excludeIssues} onChange={e=>setExcludeIssues(e.target.checked)}/>Exclude the listed invalid contours</label></>}
      {review&&!review.replace&&!openingSparrowProject&&files.length===1&&review.document.parts.length>0&&review.document.parts.every(part=>part.source.format==='sparrow')&&<button disabled={busy||previewStale||!!review.issues?.length&&!excludeIssues} onClick={()=>void accept(true)}>Open as new project</button>}
      <div className="modal-actions"><button disabled={busy} onClick={()=>{setFiles(undefined);setReview(undefined);setError('');}}>İptal</button>{review&&!previewStale?<button disabled={busy||!review.replace&&!review.document.parts.length||!!review.issues?.length&&!excludeIssues} className="primary" onClick={()=>void accept()}>{review.replace||openingSparrowProject?'Proje aç':`Add ${review.document.parts.length} shape${review.document.parts.length===1?'':'s'} to project`}</button>:<button disabled={busy} className="primary" onClick={()=>void preview()}>{busy?'Checking…':review?'Önizlemeyi güncelle':'İçe aktarmayı önizle'}</button>}</div>
    </Modal>}
    {shape&&<Modal title="Şekil ekle" locked={busy} onClose={()=>setShape(undefined)}><form onSubmit={e=>{e.preventDefault();if(busy)return;if(shape==='polygon'){cancelDefaultExample();setShape(undefined);setPolygon([]);}else void addShape(shape);}}><label>Şekil<select value={shape} onChange={e=>setShape(e.target.value as typeof shape)} disabled={busy}><option value="rectangle">Dikdörtgen</option><option value="circle">Daire</option><option value="polygon">Çokgen çiz</option></select></label>
      {shape!=='polygon'&&<label>{`${shape==='circle'?'Diameter':'Width'}, ${unit}`}<input type="number" min={0.000001/factor} max={100000/factor} step="any" value={inputLength(shapeWidth)} onChange={e=>setShapeWidth(e.target.valueAsNumber*factor)} disabled={busy}/></label>}
      {shape==='rectangle'&&<label>Height, {unit}<input type="number" min={0.000001/factor} max={100000/factor} step="any" value={inputLength(shapeHeight)} onChange={e=>setShapeHeight(e.target.valueAsNumber*factor)} disabled={busy}/></label>}
      {shape==='polygon'&&<p>Click each vertex in the canvas. Enter closes the polygon; Escape cancels. The contour is checked before it is added.</p>}{error&&<p role="alert" className="field-error">{error}</p>}
      <div className="modal-actions"><button type="button" disabled={busy} onClick={()=>setShape(undefined)}>İptal</button><button disabled={busy} className="primary">{shape==='polygon'?'Start drawing':'Şekil ekle'}</button></div></form>
    </Modal>}
    {nameDialog&&<Modal title={nameDialog==='new'?'Yeni proje':'Projeyi yeniden adlandır'} onClose={()=>setNameDialog(undefined)}><form onSubmit={e=>{e.preventDefault();const name=projectName.trim();if(!name)return;if(nameDialog==='new')requestProject({document:emptyProject(name),saved:true});else if(name!==doc.name)commit({...doc,name},false);setNameDialog(undefined);}}><label>Proje adı<input autoFocus onFocus={e=>e.currentTarget.select()} required maxLength={200} value={projectName} onChange={e=>setProjectAd(e.target.value)}/></label><div className="modal-actions"><button type="button" onClick={()=>setNameDialog(undefined)}>İptal</button><button className="primary" disabled={!projectName.trim()}>{nameDialog==='new'?'Proje oluştur':'Yeniden adlandır'}</button></div></form></Modal>}
    {pendingProject&&<Modal title="Projeyi değiştir" locked={busy} onClose={()=>setPendingProject(undefined)}><p><strong>{pendingProject.document.name}</strong> açıldığında mevcut <strong>{doc.name}</strong> projesi değiştirilecek.</p><p className="muted">İsterseniz mevcut yerleşimi önce DXF olarak indirin.</p>{polygon&&<p>DXF indirmeden önce çizimi tamamlayın veya iptal edin.</p>}{error&&<p role="alert" className="field-error">{error}</p>}<div className="project-switch-actions"><button className="primary" disabled={busy||invalidSettings||!!polygon} onClick={async()=>{if(await exportLayout())switchProject(pendingProject);}}>DXF indir ve geç</button><button className="discard-project" disabled={busy} onClick={()=>switchProject(pendingProject)}>İndirmeden geç</button><button className="text-button" disabled={busy} onClick={()=>setPendingProject(undefined)}>İptal</button></div></Modal>}
    {info&&<Modal title={info==='admin'?'Admin Paneli':info==='about'?'Serula Nesting Hakkında':info==='contact'?'İletişim':'Kısayollar ve formatlar'} onClose={()=>setInfo(undefined)}>
      {info==='admin'?<><p>Serula Nesting yönetim alanı.</p><div className="admin-panel"><h2>Sistem durumu</h2><p><strong>Proje:</strong> {doc.name}</p><p><strong>Parça türü:</strong> {doc.parts.length}</p><p><strong>Toplam parça:</strong> {displayedPieceCount(doc.parts)}</p><p><strong>Malzeme:</strong> {(doc.settings.materialType??'roll')==='sheet'?'Plaka':'Rulo'}</p><h2>Etkin yerleşim ayarları</h2><p><strong>Genişlik:</strong> {length(doc.settings.materialWidthMm)} {unit}</p>{(doc.settings.materialType??'roll')==='sheet'&&<p><strong>Plaka uzunluğu:</strong> {length(doc.settings.materialLengthMm??0)} {unit}</p>}<p><strong>Parça aralığı:</strong> {length(doc.settings.clearanceMm)} {unit}</p><p className="muted">Kullanıcı/rol yetkilendirmesi için sunucu tarafı kimlik doğrulama ve kalıcı kullanıcı veritabanı gerekir. Bu statik istemcide güvenli kullanıcı yetkisi taklit edilmez.</p></div></>:info==='about'?<><h2>Serula Nesting Pro</h2><p>Serula Nesting Pro, DXF parçalarını rulo veya plaka malzeme üzerine verimli biçimde yerleştirmek için geliştirilen web tabanlı bir 2D nesting uygulamasıdır.</p><p>Özellikle ayakkabı üretimi, suni deri, tekstil, lazer kesim ve CNC işlemlerinde malzeme kaybını azaltmaya yardımcı olmak amacıyla geliştirilmektedir. İçe aktarılan DXF parçalarının gerçek ölçüleri korunur; parçaların ebatları otomatik olarak değiştirilmez.</p><p>Yerleştirme motoru düzensiz şekilleri değerlendirerek kullanılabilir alanı daha verimli kullanmaya çalışır. Proje aktif olarak geliştirilmektedir.</p><label>Görüntü birimleri<select value={unit} onChange={e=>setUnit(e.target.value as DisplayUnit)}><option value="mm">Milimetre</option><option value="in">İnç</option></select></label><label>Görünüm<select value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="system">Sistem</option><option value="light">Açık</option><option value="dark">Koyu</option></select></label><p><strong>Geliştirici:</strong> Muhammet Hasanoğlu</p></>:info==='contact'?<><h2>İletişim</h2><p>Serula Nesting ile ilgili destek, öneri ve iş birliği için bize ulaşabilirsiniz.</p><div className="contact-links"><a href="mailto:m93hasan@gmail.com"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/></svg>m93hasan@gmail.com</a><a href="tel:+905393480622">☎ +90 539 348 06 22</a></div></>:<><h2>Hazırlık kısayolları</h2><p><kbd>R</kbd> izin verilen yönler arasında geçiş yapar. <kbd>⌘/Ctrl+D</kbd> seçimin bir kopyasını ekler. <kbd>Backspace</kbd> seçili kopyayı kaldırır. <kbd>+</kbd> veya <kbd>=</kbd> adedi artırır; <kbd>−</kbd> veya <kbd>_</kbd> azaltır.</p><p>Kısayollar çalışma alanı veya düzenlenebilir olmayan bir kontrol odaktayken çalışır. Adet değişiklikleri 500 kopyalık proje sınırı içinde tutulur.</p><p>SVG ve DXF dosyalarındaki desteklenen kapalı konturlar içe aktarılır. Açık veya geçersiz konturlar içe aktarma sırasında bildirilir.</p><p>DXF dosyalarında çizgi, yay, daire, elips, polyline ve desteklenen spline konturları işlenir. Katmanlar önizlemede seçilebilir.</p><p>İç boşluklar korunur. Parça aralığı parçalar arasındaki boşluktur; kesim kerfi değildir.</p></>}
      <div className="modal-actions"><button onClick={()=>setInfo(undefined)}>Kapat</button></div></Modal>}
  </div>;
}
