import { loadSerialWasm, loadThreadedWasm, supportsSIMD, type SolverBinary } from '../wasm';
import type { Start, SolverMessage } from './protocol';
import { normalizeDocument } from '../geometry/normalize';
import { solverInput } from '../import/sparrow';
import {candidateResult} from './solverResult';
import {arrangeSheetRows,improveSheetPacking} from '../geometry/sheetPacking';
import {packResultIntoSheets} from '../geometry/multiSheet';
import {prepareSheetSearch,restoreSheetSearchResult} from '../geometry/sheetSearch';

type WasmApi=Pick<typeof import('../../wasm/pkg/sparrow_web'),'run'|'thread_count'>;

// Roll input is unchanged. Finite plates constrain the shorter physical axis in
// Sparrow, then restore original coordinates and fill free space off the UI thread.

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
    const search=doc?prepareSheetSearch(doc):undefined;
    const control=data.control?new Int32Array(data.control):undefined;
    const input=search?solverInput(search.document):(data as Extract<Start,{type:'bridge'}>).input;
    const seconds=data.type==='bridge'?data.seconds:doc!.settings.timeLimitSeconds,clearance=doc?.settings.clearanceMm??0,preset=doc?.settings.solverPreset??'standard';
    send({type:'run-input',input,seed:data.seed,seconds,clearance,preset,threads:wasm.thread_count(),solverBinary});
    let sheetSearchMs=0,lastSheetSearch=-Infinity;
    const sheetSearchBudget=Math.min(1500,(seconds??59)*150);
    wasm.run(input, seconds??undefined, data.seed, clearance, preset, (json: string) => {
      const message = JSON.parse(json) as SolverMessage;
      if(control&&message.type==='phase'&&message.phase==='Compression')Atomics.store(control,0,-1);
      const improve=message.type==='candidate'&&sheetSearchMs<sheetSearchBudget&&performance.now()-lastSheetSearch>=250;
      if(doc?.settings.materialType==='sheet'&&search&&(message.type==='candidate'||message.type==='live')&&
        (search.transposed||improve)){
        const began=performance.now();
        try{
          const decoded=candidateResult(search.document,{...message,runId,documentRevision},data.seed);
          const packed=improve?improveSheetPacking(search.document,decoded,{timeLimitMs:Math.min(200,sheetSearchBudget-sheetSearchMs)}):
            packResultIntoSheets(search.document,decoded);
          const physical=restoreSheetSearchResult(doc,packed,search.transposed);
          const remaining=Math.min(200,sheetSearchBudget-sheetSearchMs)-(performance.now()-began);
          const sheetResult=improve&&remaining>0?arrangeSheetRows(doc,physical,{timeLimitMs:remaining}):physical;
          send({...message,sheetResult,...(sheetResult!==physical?{rowOrdered:true}:{})});
        }catch{
          // Original-axis candidates retain the existing UI validation fallback.
          // Transposed raw coordinates must never be interpreted as physical XY.
          if(!search.transposed)send(message);
        }
        if(improve){lastSheetSearch=performance.now();sheetSearchMs+=lastSheetSearch-began;}
        return;
      }
      send(message);
    }, control?(reset:boolean)=>{if(reset)Atomics.compareExchange(control,0,1,0);return Atomics.load(control,0)===1;}:undefined);
  } catch (error) {
    send({ type: 'error', message: String(error) });
    if(data.type==='preload')self.close();
  }
};
