import type { SolverBinary } from '../wasm';
import { useEffect, useRef, useState } from 'react';
import { SOLVER_REVISION, type Document, type Result } from '../model';
import { candidateResult } from '../infrastructure/nesting/candidateResult';
import { phaseImprovements, type Timing } from '../application/nesting/phaseImprovements';
import { wallClockLimitSeconds } from '../domain/nesting/wallClockLimitSeconds';
import { enqueueValidationCandidate } from '../application/nesting/validationQueue';
import { selectBestNestingResult } from '../application/nesting/selectBestNestingResult';
import { createSolverWorkers, releaseSolverWorkers } from '../infrastructure/nesting/solverWorkers';
import { calculateSolverDeadline, scheduleSolverDeadline } from '../infrastructure/nesting/solverDeadline';
import { matchesRunMessage, matchesValidationReply, startNestingWorker, initializeNestingWorkers, validateNestingCandidate } from '../infrastructure/nesting/workerMessages';
import type { Candidate, GeometryReply, SolverMessage } from './protocol';
import type {LiveGeometry} from '../geometry/live';

export type RunState='Ready'|'Initializing'|'Running'|'Complete'|'Stopped'|'Error';
// Cumulative milliseconds since Nest was requested, including preparation and worker loading.
type StartupTiming={preparedMs:number;solverReadyMs?:number;firstCandidateMs?:number;firstValidMs?:number;firstPreviewMs?:number;firstResultRenderedMs?:number};
export type Diagnostics={runDocument?:Document;attempts?:(Extract<SolverMessage,{type:"run-input"}> & {configuration?:string})[];logs?:string[];droppedLogs?:number;phases?:{phase:string;elapsedMs:number}[];compressionRequestedMs?:number;solverRevision:string;seed:string;buildMode:string;solverBinary?:SolverBinary;initializationMs?:number;startup?:StartupTiming;stopReason?:string;history:Timing[];liveSnapshots?:number;liveErrors:{sequence:number;message:string}[]};
export type LiveFrame=LiveGeometry & {sequence:number;result:Result;report:string};
type PendingCandidate={candidate:Candidate;result:Result};
type ValidationReply={type:'validated-candidate';runId:number;documentRevision:number;sequence:number;result?:Result;error?:string};
type Run={id:number;revision:number;doc:Document;seed:string;requestedAt:number;solver?:Worker;preview:Worker;validator:Worker;
  latest?:Candidate;previewActive?:{candidate:Candidate;result:Result};frame?:LiveFrame;previewSequence:number;previewError?:string;
  best?:Result;bestSheetSolverLength?:number;ended?:'Complete'|'Stopped'|'Error';startedAt?:number;watchdog:ReturnType<typeof setTimeout>;deadline?:ReturnType<typeof setTimeout>;
  deadlineAtEpochMs?:number;visibilityHandler?:()=>void;lastPaintAt?:number;lastPreviewAt?:number;renderIntervalMs:number;
  checking?:PendingCandidate;pending:PendingCandidate[];finalizing?:boolean;validationTimeout?:ReturnType<typeof setTimeout>;
  diagnostics:Diagnostics};
// Compatibility exports: existing callers keep the same public module API.
export { candidateResult, phaseImprovements, wallClockLimitSeconds };
export type { Timing };

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
      releaseSolverWorkers(r);
      clearTimeout(r.watchdog);if(r.deadline)clearTimeout(r.deadline);if(r.validationTimeout)clearTimeout(r.validationTimeout);
      if(r.visibilityHandler&&typeof document!=='undefined')document.removeEventListener('visibilitychange',r.visibilityHandler);
    }
    run.current=undefined;setPhase(undefined);setSkipping(false);setCanSkip(false);
  }
  function scheduleDeadline(r:Run) {
    scheduleSolverDeadline(r,()=>end('Complete'));
  }
  useEffect(()=>{
    const timer=setInterval(()=>{
      const r=run.current;
      if(r) {
        const now=performance.now();
        // Dense imported DXF contours make rendering expensive. Pace UI updates
        // independently of the solver so controls stay responsive during Keşif.
        if(now-(r.lastPaintAt??0)>=r.renderIntervalMs){
          r.lastPaintAt=now;
          setResult(r.best);setLive(r.frame);setLiveError(r.previewError??'');
          if(!r.ended)setElapsed((now-r.requestedAt)/1000);
        }
        // One live preview at a time; heavy sheet packing and clipping take place
        // inside geometry.worker rather than blocking the UI thread.
        if(r.latest&&!r.previewActive&&!r.previewError&&r.latest.sequence>r.previewSequence
          &&now-(r.lastPreviewAt??0)>=r.renderIntervalMs) {
          const candidate=r.latest;
          r.lastPreviewAt=now;
          try{
            const previewResult=candidateResult(r.doc,candidate,r.seed);
            r.previewActive={candidate,result:previewResult};r.previewSequence=candidate.sequence;
            r.preview.postMessage({type:'live-preview',sequence:candidate.sequence,runId:r.id,documentRevision:r.revision,result:previewResult});
          }catch{r.previewSequence=candidate.sequence;}
        }
      }
    },100);
    return ()=>{clearInterval(timer);clear();};
  },[]);
  function end(reason:'Complete'|'Stopped'|'Error',message?:string) {
    const r=run.current;if(!r||r.ended)return;
    r.solver?.postMessage({type:'stop'});r.solver=undefined;clearTimeout(r.watchdog);if(r.deadline)clearTimeout(r.deadline);
    if(r.visibilityHandler&&typeof document!=='undefined')document.removeEventListener('visibilitychange',r.visibilityHandler);
    if(reason==='Complete'&&(r.checking||r.pending.length)){
      if(!r.finalizing){
        r.finalizing=true;
        setPhase('Son yerleşim doğrulanıyor');
        // A complex malformed DXF must not leave the UI in "Running" forever.
        r.validationTimeout=setTimeout(()=>{
          r.checking=undefined;r.pending=[];end('Complete');
        },12_000);
      }
      return;
    }
    if(r.validationTimeout)clearTimeout(r.validationTimeout);
    r.validator.terminate();
    r.ended=reason;
    r.diagnostics.stopReason=message ?? reason;
    if(message) setError(message);
    setElapsed((performance.now()-r.requestedAt)/1000);
    setResult(r.best);setState(reason);
    if(!r.best&&reason==='Complete'){
      const lastFailure=[...r.diagnostics.history].reverse().find(entry=>entry.validation==='failed'&&entry.errors?.length);
      setState('Error');
      setError(lastFailure?.errors?.[0]?`Yerleşim bulundu ancak doğrulama reddetti: ${lastFailure.errors[0]}`:'Geçerli bir yerleşim bulunamadı. Malzeme ölçüsünü ve parça aralığını kontrol edip yeniden deneyin.');
    }
  }
  function start(doc:Document,revision:number,threads?:number,requestedAt=performance.now()) {
    const startup:StartupTiming={preparedMs:performance.now()-requestedAt};
    clear();setWorkers(undefined);setResult(undefined);setLive(undefined);setLiveError('');setError('');setElapsed(0);setState('Initializing');
    const id=++serial.current,seed=crypto.getRandomValues(new BigUint64Array(1))[0].toString();
    const { solver, preview, validator } = createSolverWorkers();
    const complexity=doc.parts.reduce((sum,part)=>sum+part.quantity*(part.outer.length+part.holes.reduce((n,h)=>n+h.length,0)),0);
    const r:Run={id,revision,doc,seed,requestedAt,solver,preview,validator,pending:[],previewSequence:0,
      renderIntervalMs:complexity>15_000?500:250,
      watchdog:setTimeout(()=>end('Stopped','Yerleştirme motoru 30 saniye içinde başlatılamadı. Tarayıcıyı yenileyip tekrar deneyin.'),30_000),
      diagnostics:{runDocument:doc,solverRevision:SOLVER_REVISION,seed,buildMode:'Initializing',startup,history:[],liveSnapshots:0,liveErrors:[]}};
    run.current=r;diagnostics.current=r.diagnostics;
    // Automatic mode is a hard wall-clock budget: preparation + initialization +
    // solving may consume at most 59 seconds. Hiding the tab never pauses the budget.
    r.deadlineAtEpochMs=calculateSolverDeadline(doc,requestedAt,performance.now(),Date.now());
    r.visibilityHandler=()=>{
      if(run.current===r&&!r.ended)scheduleDeadline(r);
    };
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',r.visibilityHandler);
    scheduleDeadline(r);
    preview.onmessage=({data}:MessageEvent<GeometryReply>)=>{
      if(run.current!==r||!matchesRunMessage(data,r))return;
      if(data.type==='error'){r.previewError=data.message;r.previewActive=undefined;preview.terminate();return;}
      if(data.type==='live-preview-skipped'){
        r.previewActive=undefined;
        r.diagnostics.liveErrors.push({sequence:data.sequence,message:data.message});
        if(r.diagnostics.liveErrors.length>100)r.diagnostics.liveErrors.splice(0,r.diagnostics.liveErrors.length-100);
        return;
      }
      if(data.type!=='live-frame'||!r.previewActive||data.sequence!==r.previewActive.candidate.sequence)return;
      startup.firstPreviewMs??=performance.now()-requestedAt;
      if(data.geometry.errors.length) {
        r.diagnostics.liveErrors.push(...data.geometry.errors.map(message=>({sequence:data.sequence,message})));
        // ponytail: retain the last 100 live clip failures; diagnostics stay bounded during long searches.
        if(r.diagnostics.liveErrors.length>100)r.diagnostics.liveErrors.splice(0,r.diagnostics.liveErrors.length-100);
      }
      r.frame={...data.geometry,sequence:data.sequence,result:data.result,report:r.previewActive.candidate.report};r.previewActive=undefined;
    };
    preview.onerror=e=>{if(run.current===r){r.previewError=e.message;r.previewActive=undefined;preview.terminate();}};
    // Do not execute DXF polygon clipping and per-copy validation on the React
    // thread. Keep the expensive queue bounded; preserve the earliest candidate
    // and the most promising improvements during heavy WASM bursts.
    function sendNextValidation() {
      if(r.checking||!r.pending.length||r.ended)return;
      const task=r.pending.shift()!;
      r.checking=task;
      validateNestingCandidate(validator,r,task.candidate.sequence,task.result);
    }
    validator.onmessage=({data}:MessageEvent<ValidationReply>)=>{
      if(run.current!==r||r.ended||!matchesValidationReply(data,r,r.checking?.candidate.sequence))return;
      const candidate=r.checking!.candidate;
      r.checking=undefined;
      const entry=r.diagnostics.history.find(item=>item.sequence===data.sequence);
      if(data.error){
        if(entry){entry.validation='failed';entry.errors=[data.error];}
      }else if(data.result){
        const packed=data.result,checked=packed.validation;
        if(entry){entry.validation=checked.status;entry.errors=checked.status==='passed'?undefined:checked.errors;}
        if(checked.status==='passed'){
          const selection=selectBestNestingResult({
            materialType:doc.settings.materialType,
            best:r.best,
            bestSheetSolverLength:r.bestSheetSolverLength,
            candidate:packed,
            candidateSolverLength:candidate.solution.strip_width,
          });
          if(selection.accepted){
            startup.firstValidMs??=performance.now()-requestedAt;
            r.best=selection.best;
            r.bestSheetSolverLength=selection.bestSheetSolverLength;
          }
        }
      }
      sendNextValidation();
      if(r.finalizing&&!r.checking&&!r.pending.length)end('Complete');
    };
    validator.onerror=event=>{
      if(run.current===r&&!r.ended)end('Error',event.message||'Yerleşim doğrulama işçisi durdu.');
    };
    initializeNestingWorkers(validator,preview,r,doc);
    solver.onmessage=({data}:MessageEvent<SolverMessage>)=>{
      if(run.current!==r || !r.solver || !matchesRunMessage(data,r)) return;
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
        case 'ready': setCanSkip(data.canSkip);startup.solverReadyMs??=performance.now()-requestedAt;setWorkers({actual:data.threads,requested:threads,reason:data.fallbackReason});r.diagnostics.solverBinary=data.solverBinary;r.diagnostics.buildMode=`${data.threads} çözücü iş parçacığı, ${data.simd?'SIMD':'SIMD yok'}${data.fallbackReason?`; seri yedek: ${data.fallbackReason}`:''}`; break;
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
          {
            const entry:Timing={phase:r.diagnostics.phases?.at(-1)?.phase,sequence:data.sequence,
              elapsedMs:data.elapsedMs,lengthMm:data.solution.strip_width,validation:'pending'};
            r.diagnostics.history.push(entry);
            if(doc.settings.materialType!=='sheet'&&r.best&&data.solution.strip_width>r.best.usedLengthMm+1e-6){
              entry.validation='skipped';break;
            }
            let next:PendingCandidate;
            try{next={candidate:data,result:candidateResult(doc,data,seed)};}
            catch(error){entry.validation='failed';entry.errors=[String(error)];break;}
            const queued=enqueueValidationCandidate(r.pending,next);
            if(!queued.accepted){entry.validation='skipped';break;}
            if(queued.dropped){
              const old=r.diagnostics.history.find(item=>item.sequence===queued.dropped!.candidate.sequence);
              if(old)old.validation='skipped';
            }
            sendNextValidation();
          }
          break;
        case 'finished': end('Complete');break;
        case 'error': end('Error',data.message);break;
      }
    };
    solver.onerror=e=>{if(run.current===r && r.solver) end('Error',e.message||'Arka plan işçisi yüklenemedi. Sayfayı yenileyip tekrar deneyin.');};
    startNestingWorker(solver,r,doc,seed,threads,Math.max(0,(r.deadlineAtEpochMs??Date.now())-Date.now()));
  }
  function invalidate() {clear();setWorkers(undefined);setResult(undefined);setLive(undefined);setLiveError('');setState('Ready');setError('');}
  function load(checked:Result) {
    clear();setWorkers(undefined);setLive(undefined);setLiveError('');setResult(checked);setElapsed(checked.elapsedSeconds);setState('Complete');setError('');
    diagnostics.current={solverRevision:checked.solverRevision,seed:checked.seed,buildMode:'Yüklenen proje; sonuç yerel olarak yeniden doğrulandı',stopReason:'Yüklenen proje',history:[],liveErrors:[]};
  }
  function skipToCompression() {
    const r=run.current;
    if(!canSkip||!r?.solver||r.ended||phase!=='Exploration'||skipping||!r.best)return;
    setSkipping(true);r.diagnostics.compressionRequestedMs=r.startedAt?performance.now()-r.startedAt:0;
    r.solver.postMessage({type:'skip'});
  }
  return {phase,canSkip,skipping,skipToCompression,state,workers,result,live,liveError,elapsed,error,start,stop:()=>end('Stopped'),invalidate,load,diagnostics};
}
