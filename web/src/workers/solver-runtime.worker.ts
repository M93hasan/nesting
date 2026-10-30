import { loadSerialWasm, loadThreadedWasm, supportsSIMD, type SolverBinary } from '../wasm';
import type { Start, SolverMessage } from './protocol';
import { normalizeDocument } from '../geometry/normalize';
import { solverInput } from '../import/sparrow';
import {qualityAttempts} from './solverQuality';

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
    const attempts=data.type==='bridge'?[{seed:data.seed,seconds:data.seconds}]:qualityAttempts(data.seed,seconds,preset);
    let globalSequence=0,elapsedOffsetMs=0;
    for(let index=0;index<attempts.length;index++){
      const attempt=attempts[index];
      if(control)Atomics.store(control,0,0);
      send({type:'run-input',input,seed:attempt.seed,seconds:attempt.seconds,clearance,preset,threads:wasm.thread_count(),solverBinary,attempt:index+1,attempts:attempts.length});
      if(attempts.length>1)send({type:'solver-log',line:`Quality start ${index+1}/${attempts.length}: seed ${attempt.seed}, budget ${attempt.seconds}s.`,timestamp:Date.now()});
      const started=performance.now();
      wasm.run(input, attempt.seconds??undefined, attempt.seed, clearance, preset, (json: string) => {
        const message = JSON.parse(json) as SolverMessage;
        if(message.type==='finished'){
          if(index===attempts.length-1)send(message);
          return;
        }
        if(message.type==='candidate'||message.type==='live'){
          message.sequence=++globalSequence;
          message.elapsedMs+=elapsedOffsetMs;
          Object.assign(message,{attempt:index+1,attemptSeed:attempt.seed});
        }
        if(control&&message.type==='phase'&&message.phase==='Compression')Atomics.store(control,0,-1);
        send(message);
      }, control?(reset:boolean)=>{if(reset)Atomics.compareExchange(control,0,1,0);return Atomics.load(control,0)===1;}:undefined);
      elapsedOffsetMs+=performance.now()-started;
    }
  } catch (error) {
    send({ type: 'error', message: String(error) });
    if(data.type==='preload')self.close();
  }
};