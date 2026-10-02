import { loadSerialWasm, loadThreadedWasm, supportsSIMD, type SolverBinary } from '../wasm';
import type { Start, SolverMessage } from './protocol';
import { normalizeDocument } from '../geometry/normalize';
import { solverInput } from '../import/sparrow';
import {appendFallbackItems,initialPlacementItemId,removeFallbackItem,type FallbackSolverInput,type FallbackSolverItem} from './solverFallback';

type WasmApi=Pick<typeof import('../../wasm/pkg/sparrow_web'),'run'|'thread_count'>;

// Sheet mode intentionally uses the exact same Sparrow input and solver path as roll mode.
// Fixed-length plates are derived only after a normal roll candidate returns (see multiSheet.ts).
// This keeps DXF geometry, copies/demand, rotations, clearance and solver behavior identical.

self.onmessage = async ({ data }: MessageEvent<Start | {type:'preload';threads:number}>) => {
  if (data.type !== 'start' && data.type !== 'bridge' && data.type !== 'preload') return;
  const { runId, documentRevision } = data.type==='preload'?{runId:0,documentRevision:0}:data;
  const send = (message: object) => self.postMessage({ ...message, runId, documentRevision });
  try {
    let wasm: WasmApi;
    if (data.threads && data.threads > 1) {
      const threaded = await loadThreadedWasm();
      await threaded.default();
      if(data.type!=='preload')await threaded.initThreadPool(data.threads);
      wasm = threaded;
    } else {
      const serial = await loadSerialWasm();
      await serial.default();
      wasm = serial;
    }
    if(data.type==='preload'){self.postMessage({type:'preloaded'});self.close();return;}
    const solverBinary: SolverBinary = `${data.threads && data.threads > 1 ? 'threaded' : 'serial'}-${supportsSIMD ? 'simd' : 'nosimd'}`;
    send({ type: 'ready', threads: wasm.thread_count(), solverBinary, simd: supportsSIMD, canSkip: !!data.control });
    const doc=data.type==='start'?normalizeDocument(data.document):null;
    const control=data.control?new Int32Array(data.control):undefined;
    const input=doc?solverInput(doc):(data as Extract<Start,{type:'bridge'}>).input;
    const seconds=data.type==='bridge'?data.seconds:doc!.settings.timeLimitSeconds,clearance=doc?.settings.clearanceMm??0,preset=doc?.settings.solverPreset??'standard';
    const fallbackEnabled=data.type==='start';
    let working=fallbackEnabled?JSON.parse(input) as FallbackSolverInput:undefined;
    const fallbackItems:FallbackSolverItem[]=[];
    while(true){
      const runInput=working?JSON.stringify(working):input;
      send({type:'run-input',input:runInput,seed:data.seed,seconds,clearance,preset,threads:wasm.thread_count(),solverBinary});
      if(working&&!working.items.length){
        const solution=appendFallbackItems({strip_width:0,layout:{placed_items:[]}},fallbackItems,working.strip_height,clearance);
        send({type:'candidate',sequence:1,report:'SafeAppendFeas',elapsedMs:0,solution});
        send({type:'finished'});
        break;
      }
      let initialFailure:string|undefined;
      try{
        wasm.run(runInput, seconds??undefined, data.seed, clearance, preset, (json: string) => {
          let message = JSON.parse(json) as SolverMessage;
          if(message.type==='error'&&fallbackEnabled&&initialPlacementItemId(message.message)!==undefined){initialFailure=message.message;return;}
          if(initialFailure&&message.type==='finished')return;
          if(fallbackItems.length&&(message.type==='candidate'||message.type==='live')){
            message={...message,report:'SafeAppendFeas',solution:appendFallbackItems(message.solution,fallbackItems,working!.strip_height,clearance)};
          }
          if(control&&message.type==='phase'&&message.phase==='Compression')Atomics.store(control,0,-1);
          send(message);
        }, control?(reset:boolean)=>{if(reset)Atomics.compareExchange(control,0,1,0);return Atomics.load(control,0)===1;}:undefined);
      }catch(error){
        const message=String(error);
        if(fallbackEnabled&&initialPlacementItemId(message)!==undefined)initialFailure=message;
        else throw error;
      }
      if(!initialFailure)break;
      const itemId=initialPlacementItemId(initialFailure)!;
      const removed=removeFallbackItem(working!,itemId);
      if(!removed)throw Error(initialFailure);
      fallbackItems.push(removed.item);working=removed.input;
      send({type:'solver-log',line:`Safe append fallback: solver item ${itemId} was removed from Sparrow initialization and will be appended with its allowed rotation.`,timestamp:performance.timeOrigin+performance.now()});
    }
  } catch (error) {
    send({ type: 'error', message: String(error) });
    if(data.type==='preload')self.close();
  }
};