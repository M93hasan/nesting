import { loadSerialWasm, loadThreadedWasm, supportsSIMD, type SolverBinary } from '../wasm';
import type { Start, SolverMessage } from './protocol';
import { normalizeDocument } from '../geometry/normalize';
import { solverInput } from '../import/sparrow';
import {candidateResult} from './solverResult';
import {improveSheetPacking} from '../geometry/sheetPacking';

type WasmApi=Pick<typeof import('../../wasm/pkg/sparrow_web'),'run'|'thread_count'>;

// Both modes retain Sparrow's input and search. Finite-sheet candidates additionally
// fill free plate space here, off the UI thread, with the original packing as fallback.

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
    send({type:'run-input',input,seed:data.seed,seconds,clearance,preset,threads:wasm.thread_count(),solverBinary});
    let sheetSearchMs=0,lastSheetSearch=-Infinity;
    const sheetSearchBudget=Math.min(1500,(seconds??59)*150);
    wasm.run(input, seconds??undefined, data.seed, clearance, preset, (json: string) => {
      const message = JSON.parse(json) as SolverMessage;
      if(control&&message.type==='phase'&&message.phase==='Compression')Atomics.store(control,0,-1);
      if(doc?.settings.materialType==='sheet'&&message.type==='candidate'&&
        sheetSearchMs<sheetSearchBudget&&performance.now()-lastSheetSearch>=250){
        const began=performance.now();
        try{
          const decoded=candidateResult(doc,{...message,runId,documentRevision},data.seed);
          const sheetResult=improveSheetPacking(doc,decoded,{timeLimitMs:Math.min(200,sheetSearchBudget-sheetSearchMs)});
          send({...message,sheetResult});
        }catch{
          // Let the usual sheet validation report any original candidate failure.
          send(message);
        }
        lastSheetSearch=performance.now();sheetSearchMs+=lastSheetSearch-began;
        return;
      }
      send(message);
    }, control?(reset:boolean)=>{if(reset)Atomics.compareExchange(control,0,1,0);return Atomics.load(control,0)===1;}:undefined);
  } catch (error) {
    send({ type: 'error', message: String(error) });
    if(data.type==='preload')self.close();
  }
};
