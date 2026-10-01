import type { SolverBinary } from '../wasm';
import { useEffect, useRef, useState } from 'react';
import { SOLVER_REVISION, type Document, type Result } from '../model';
import type { Candidate, GeometryReply, SolverMessage } from './protocol';
import type {LiveGeometry} from '../geometry/live';
import {packResultIntoSheets} from '../geometry/multiSheet';
import {validate} from '../geometry/validate';

export type RunState='Ready'|'Initializing'|'Running'|'Complete'|'Stopped'|'Error';
export type Timing={phase?:string;sequence:number;elapsedMs:number;lengthMm:number;validation?:string;validationMs?:number;errors?:string[]};
// Cumulative milliseconds since Nest was requested, including preparation and worker loading.
type StartupTiming={preparedMs:number;solverReadyMs?:number;firstCandidateMs?:number;firstValidMs?:number;firstPreviewMs?:number;firstResultRenderedMs?:number};
export type Diagnostics={runDocument?:Document;attempts?:(Extract<SolverMessage,{type:"run-input"}> & {configuration?:string})[];logs?:string[];droppedLogs?:number;phases?:{phase:string;elapsedMs:number}[];compressionRequestedMs?:number;solverRevision:string;seed:string;buildMode:string;solverBinary?:SolverBinary;initializationMs?:number;startup?:StartupTiming;stopReason?:string;history:Timing[];liveSnapshots?:number;liveErrors:{sequence:number;message:string}[]};
export type LiveFrame=LiveGeometry & {sequence:number;result:Result;report:string};
export const wallClockLimitSeconds=(doc:Document)=>doc.settings.timeLimitSeconds??59;
type Run={id:number;revision:number;doc:Document;seed:string;requestedAt:number;solver?:Worker;preview:Worker;
  latest?:Candidate;previewActive?:{candidate:Candidate;result:Result};frame?:LiveFrame;previewSequence:number;previewError?:string;
  best?:Result;ended?:'Complete'|'Stopped'|'Error';startedAt?:number;watchdog:ReturnType<typeof setTimeout>;deadline?:ReturnType<typeof setTimeout>;
  deadlineRemainingMs?:number;deadlineStartedAt?:number;visibilityHandler?:()=>void;
  diagnostics:Diagnostics};
export function candidateResult(doc:Document,candidate:Candidate,seed:string):Result {
  const copies=new Map<string,number>(),parts=doc.parts.filter(part=>part.quantity>0);
  return {documentRevision:candidate.documentRevision,solverRevision:SOLVER_REVISION,seed,
    elapsedSeconds:candidate.elapsedMs/1000,usedLengthMm:candidate.solution.strip_width,
    placements:candidate.solution.layout.placed_items.map(p=>{
      const partId=parts[p.item_id]?.id ?? `unknown:${p.item_id}`;
      const copyIndex=copies.get(partId) ?? 0; copies.set(partId,copyIndex+1);
      // solverInput transposes the solver geometry. Swap the translation axes
      // back and invert the solver rotation so the original DXF orientation is
      // preserved while nesting advances down the material length.
      return {partId,copyIndex,xMm:p.transformation.translation[1],yMm:p.transformation.translation[0],angleDeg:-p.transformation.rotation};
    }), validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
}
export function phaseImprovements(history:Timing[],lengthMm:number) {
  const valid=history.filter(entry=>entry.validation==='passed'),first=valid[0];
  if(!first)return undefined;
  const exploration=valid.filter(entry=>entry.phase!=='Compression');
  if(!exploration.length)return undefined;
  const explored=Math.min(...exploration.map(entry=>entry.lengthMm));
  return {explore:(1-explored/first.lengthMm)*100,compress:Math.max(0,(1-lengthMm/explored)*100)};
}
export function useSolver() {
  const [state,setState]=useState<RunState>('Ready'),[result,setResult]=useState<Result>(),[elapsed,setElapsed]=useState(0),[error,setError]=useState('');
  const [phase,setPhase]=useState<string>(),[skipping,setSkipping]=useState(false),[canSkip,setCanSkip]=useState(false);
  const [live,setLive]=useState<LiveFrame>(),[liveError,setLiveError]=useState('');
  const [workers,setWorkers]=useState<{actual:number;requested?:number;reason?:string}>();
  const run=useRef<Run|undefined>(undefined),serial=useRef(0);
  const diagnostics=useRef<Diagnostics|undefined>(undefined);
  useEffect(()=>{
    const r=run.current;
    // Record the React commit containing a new run's result, not a previous run's retained frame.
    if(r?.diagnostics.startup && ((result && result===r.best) || (live && live===r.frame)))
      r.diagnostics.startup.firstResultRenderedMs??=performance.now()-r.requestedAt;
  },[result,live]);
  function clear() {
    const r=run.current;
    if(r) {
      r.solver?.postMessage({type:'stop'});r.preview.terminate();clearTimeout(r.watchdog);if(r.deadline)clearTimeout(r.deadline);
      if(r.visibilityHandler&&typeof document!=='undefined')document.removeEventListener('visibilitychange',r.visibilityHandler);
    }
    run.current=undefined;setPhase(undefined);setSkipping(false);setCanSkip(false);
  }
  function scheduleDeadline(r:Run) {
    if(r.ended||(typeof document!=='undefined'&&document.hidden))return;
    if(r.deadline)clearTimeout(r.deadline);
    const remaining=Math.max(0,r.deadlineRemainingMs??0);
    r.deadlineStartedAt=performance.now();
    r.deadline=setTimeout(()=>end('Complete'),remaining);
  }
  useEffect(()=>{
    const timer=setInterval(()=>{
      const r=run.current;
      if(r) {
        setResult(r.best);setLive(r.frame);setLiveError(r.previewError??'');
        if(!r.ended) setElapsed((performance.now()-r.requestedAt)/1000);
        // Render the latest snapshot at most 10 times/second. Keep one in flight;
        // preview work cannot accumulate while the solver keeps searching.
        if(r.latest&&!r.previewActive&&!r.previewError&&r.latest.sequence>r.previewSequence) {
          const candidate=r.latest;
          let previewResult:Result|undefined;
          try{previewResult=packResultIntoSheets(r.doc,candidateResult(r.doc,candidate,r.seed));}
          catch{r.previewSequence=candidate.sequence;}
          if(previewResult){
            r.previewActive={candidate,result:previewResult};r.previewSequence=candidate.sequence;
            r.preview.postMessage({type:'live-preview',sequence:candidate.sequence,runId:r.id,documentRevision:r.revision,document:r.doc,result:previewResult});
          }
        }
      }
    },100);
    return ()=>{clearInterval(timer);clear();};
  },[]);
  function end(reason:'Complete'|'Stopped'|'Error',message?:string) {
    const r=run.current;if(!r) return;
    r.solver?.postMessage({type:'stop'});r.solver=undefined;clearTimeout(r.watchdog);if(r.deadline)clearTimeout(r.deadline);if(r.visibilityHandler&&typeof document!=='undefined')document.removeEventListener('visibilitychange',r.visibilityHandler);r.ended=reason;
    r.diagnostics.stopReason=message ?? reason;
    if(message) setError(message);
    setElapsed((performance.now()-r.requestedAt)/1000);
    setResult(r.best);setState(reason);
    if(!r.best&&reason==='Complete'){setState('Error');setError('Geçerli bir yerleşim bulunamadı. Malzeme ölçüsünü ve parça aralığını kontrol edip yeniden deneyin.');}
  }
  function start(doc:Document,revision:number,threads?:number,requestedAt=performance.now()) {
    const startup:StartupTiming={preparedMs:performance.now()-requestedAt};
    clear();setWorkers(undefined);setResult(undefined);setLive(undefined);setLiveError('');setError('');setElapsed(0);setState('Initializing');
    const id=++serial.current,seed=crypto.getRandomValues(new BigUint64Array(1))[0].toString();
    const solver=new Worker(new URL('./solver.worker.ts',import.meta.url),{type:'module'});
    const preview=new Worker(new URL('./geometry.worker.ts',import.meta.url),{type:'module'});
    const r:Run={id,revision,doc,seed,requestedAt,solver,preview,previewSequence:0,watchdog:setTimeout(()=>end('Stopped','Yerleştirme motoru 15 saniye içinde başlatılamadı. Tekrar deneyin.'),15_000),
      diagnostics:{runDocument:doc,solverRevision:SOLVER_REVISION,seed,buildMode:'Initializing',startup,history:[],liveSnapshots:0,liveErrors:[]}};
    run.current=r;diagnostics.current=r.diagnostics;
    // Only foreground time consumes the automatic search budget. The solver worker
    // may keep working while the page is in the background, but switching tabs no
    // longer causes the UI deadline to expire and discard a still-running search.
    const wallClockSeconds=wallClockLimitSeconds(doc);
    r.deadlineRemainingMs=Math.max(0,wallClockSeconds*1000-(performance.now()-requestedAt));
    r.visibilityHandler=()=>{
      if(run.current!==r||r.ended)return;
      if(typeof document!=='undefined'&&document.hidden){
        if(r.deadline){
          clearTimeout(r.deadline);r.deadline=undefined;
          if(r.deadlineStartedAt!==undefined)r.deadlineRemainingMs=Math.max(0,(r.deadlineRemainingMs??0)-(performance.now()-r.deadlineStartedAt));
        }
      }else scheduleDeadline(r);
    };
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',r.visibilityHandler);
    scheduleDeadline(r);
    preview.onmessage=({data}:MessageEvent<GeometryReply>)=>{
      if(run.current!==r||data.runId!==r.id||data.documentRevision!==r.revision)return;
      if(data.type==='error'){r.previewError=data.message;r.previewActive=undefined;preview.terminate();return;}
      if(data.type!=='live-frame'||!r.previewActive||data.sequence!==r.previewActive.candidate.sequence)return;
      startup.firstPreviewMs??=performance.now()-requestedAt;
      if(data.geometry.errors.length) {
        r.diagnostics.liveErrors.push(...data.geometry.errors.map(message=>({sequence:data.sequence,message})));
        // ponytail: retain the last 100 live clip failures; diagnostics stay bounded during long searches.
        if(r.diagnostics.liveErrors.length>100)r.diagnostics.liveErrors.splice(0,r.diagnostics.liveErrors.length-100);
      }
      r.frame={...data.geometry,sequence:data.sequence,result:r.previewActive.result,report:r.previewActive.candidate.report};r.previewActive=undefined;
    };
    preview.onerror=e=>{if(run.current===r){r.previewError=e.message;r.previewActive=undefined;preview.terminate();}};
    solver.onmessage=({data}:MessageEvent<SolverMessage>)=>{
      if(run.current!==r || !r.solver || data.runId!==r.id || data.documentRevision!==r.revision) return;
      switch(data.type) {
        case 'run-input': (r.diagnostics.attempts??=[]).push(data);break;
        case 'configuration': {const attempt=r.diagnostics.attempts?.at(-1);if(attempt)attempt.configuration=data.configuration;break;}
        case 'solver-log': {
          const logs=r.diagnostics.logs??=[];
          logs.push(`${((data.timestamp-performance.timeOrigin-r.requestedAt)/1000).toFixed(3)}s ${data.line}`);
          // Keep the latest 10,000 messages during arbitrarily long runs.
          if(logs.length>10_000){logs.splice(0,1000);r.diagnostics.droppedLogs=(r.diagnostics.droppedLogs??0)+1000;}
          break;
        }
        case 'ready': setCanSkip(data.canSkip);startup.solverReadyMs??=performance.now()-requestedAt;setWorkers({actual:data.threads,requested:threads,reason:data.fallbackReason});r.diagnostics.solverBinary=data.solverBinary;r.diagnostics.buildMode=`${data.threads} solver thread${data.threads===1?'':'s'}, ${data.simd?'SIMD':'no SIMD'}${data.fallbackReason?`; serial fallback: ${data.fallbackReason}`:''}`; break;
        case 'phase':
          setPhase(data.phase);setSkipping(false);
          (r.diagnostics.phases??=[]).push({phase:data.phase,elapsedMs:r.startedAt?performance.now()-r.startedAt:0});
          setWorkers(previous=>previous?{...previous,actual:data.workers}:previous);
          // Sparrow's cooperative phase deadlines allow the current iteration to finish.
          if(!r.startedAt) {r.startedAt=performance.now();r.diagnostics.initializationMs=data.initializationMs;clearTimeout(r.watchdog);}
          setState('Running');break;
        case 'live':r.latest=data;r.diagnostics.liveSnapshots!++;break;
        case 'candidate':
          startup.firstCandidateMs??=performance.now()-requestedAt;
          r.latest=data;r.diagnostics.liveSnapshots!++;
          r.diagnostics.history.push({phase:r.diagnostics.phases?.at(-1)?.phase,sequence:data.sequence,elapsedMs:data.elapsedMs,lengthMm:data.solution.strip_width,validation:'passed'});
          {
            let packed:Result;
            try{packed=packResultIntoSheets(doc,candidateResult(doc,data,seed));}
            catch{break;}
            const checked=validate(doc,packed);
            r.diagnostics.history.at(-1)!.validation=checked.status;
            if(checked.status!=='passed'){
              r.diagnostics.history.at(-1)!.errors=checked.errors;
              break;
            }
            const better=!r.best||(doc.settings.materialType==='sheet'
              ? (packed.sheetCount??1)<(r.best.sheetCount??1)
              : packed.usedLengthMm<r.best.usedLengthMm);
            if(better){
              startup.firstValidMs??=performance.now()-requestedAt;
              r.best={...packed,validation:{...checked,source:'local'}};
            }
          }
          break;
        case 'finished': end('Complete');break;
        case 'error': end('Error',data.message);break;
      }
    };
    solver.onerror=e=>{if(run.current===r && r.solver) end('Error',e.message||'A background worker could not be loaded. Reload the page and try again.');};
    solver.postMessage({type:'start',runId:id,documentRevision:revision,document:doc,seed,threads});
  }
  function invalidate() {clear();setWorkers(undefined);setResult(undefined);setLive(undefined);setLiveError('');setState('Ready');setError('');}
  function load(checked:Result) {
    clear();setWorkers(undefined);setLive(undefined);setLiveError('');setResult(checked);setElapsed(checked.elapsedSeconds);setState('Complete');setError('');
    diagnostics.current={solverRevision:checked.solverRevision,seed:checked.seed,buildMode:'Loaded project; result rechecked locally',stopReason:'Loaded project',history:[],liveErrors:[]};
  }
  function skipToCompression() {
    const r=run.current;
    if(!canSkip||!r?.solver||r.ended||phase!=='Exploration'||skipping||!r.best)return;
    setSkipping(true);r.diagnostics.compressionRequestedMs=r.startedAt?performance.now()-r.startedAt:0;
    r.solver.postMessage({type:'skip'});
  }
  return {phase,canSkip,skipping,skipToCompression,state,workers,result,live,liveError,elapsed,error,start,stop:()=>end('Stopped'),invalidate,load,diagnostics};
}
