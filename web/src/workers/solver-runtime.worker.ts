import { loadSerialWasm, loadThreadedWasm, supportsSIMD, type SolverBinary } from '../wasm';
import type { Start, SolverMessage } from './protocol';
import type { Document, Part } from '../model';
import { normalizeDocument } from '../geometry/normalize';
import { collisionRing } from '../geometry/validate';
import { solverInput } from '../import/sparrow';

type WasmApi=Pick<typeof import('../../wasm/pkg/sparrow_web'),'run'|'thread_count'>;
type CandidateMessage=Extract<SolverMessage,{type:'candidate'}>;
const ALLOWED_SECONDS=[10,30,60,120,300,600] as const;

function ringArea(part:Part){
  const ring=collisionRing(part);
  let area=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++)area+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];
  return Math.max(1e-6,Math.abs(area)/2);
}
function perSheetSeconds(total:number|null|undefined,estimatedSheets:number):(typeof ALLOWED_SECONDS)[number]{
  if(total==null)return 30;
  const target=Math.max(10,Math.floor(total/Math.max(1,estimatedSheets)));
  return ([...ALLOWED_SECONDS].reverse().find(value=>value<=target)??10) as (typeof ALLOWED_SECONDS)[number];
}
function batchCounts(tokens:number[],count:number,partCount:number){
  const counts=new Array<number>(partCount).fill(0);
  for(let i=0;i<count;i++)counts[tokens[i]]++;
  return counts;
}
function solveOneSheet(wasm:WasmApi,doc:Document,counts:number[],seconds:number,seed:string,clearance:number,preset:string,
  send:(message:object)=>void,solverBinary:SolverBinary,control?:Int32Array){
  const parts=doc.parts.filter(part=>part.quantity>0);
  const selected=parts.map((part,index)=>({...part,quantity:counts[index]}));
  const subdoc:Document={...doc,parts:selected,settings:{...doc.settings,materialType:'roll',timeLimitSeconds:seconds}};
  const localToGlobal=selected.map((part,index)=>part.quantity>0?index:-1).filter(index=>index>=0);
  const input=solverInput(subdoc);
  send({type:'run-input',input,seed,seconds,clearance,preset,threads:wasm.thread_count(),solverBinary});
  let best:CandidateMessage|undefined;
  wasm.run(input,seconds,seed,clearance,preset,(json:string)=>{
    const message=JSON.parse(json) as SolverMessage;
    if(control&&message.type==='phase'&&message.phase==='Compression')Atomics.store(control,0,-1);
    if(message.type==='candidate'){
      if(!best||message.solution.strip_width<best.solution.strip_width)best=message;
      return;
    }
    if(message.type==='live'||message.type==='finished')return;
    send(message);
  },control?(reset:boolean)=>{if(reset)Atomics.compareExchange(control,0,1,0);return Atomics.load(control,0)===1;}:undefined);
  if(!best)throw Error('Sparrow bu plaka için geçerli yerleşim üretemedi.');
  return {candidate:best,localToGlobal};
}
function solveSheetMode(wasm:WasmApi,doc:Document,data:Extract<Start,{type:'start'}>,send:(message:object)=>void,solverBinary:SolverBinary,control?:Int32Array){
  const length=doc.settings.materialLengthMm,width=doc.settings.materialWidthMm,clearance=doc.settings.clearanceMm,preset=doc.settings.solverPreset??'standard';
  if(!length||!Number.isFinite(length)||length<=0)throw Error('Plaka uzunluğu pozitif bir değer olmalıdır.');
  const parts=doc.parts.filter(part=>part.quantity>0);
  const tokens:number[]=[];
  parts.forEach((part,index)=>{for(let copy=0;copy<part.quantity;copy++)tokens.push(index);});
  const areas=parts.map(ringArea);
  tokens.sort((a,b)=>areas[b]-areas[a]||a-b);
  const totalArea=tokens.reduce((sum,index)=>sum+areas[index],0),plateArea=width*length;
  const estimatedSheets=Math.max(1,Math.ceil(totalArea/Math.max(1,plateArea*.78)));
  const seconds=perSheetSeconds(doc.settings.timeLimitSeconds,estimatedSheets);
  const remaining=[...tokens],placed:CandidateMessage['solution']['layout']['placed_items']=[];
  let sheetIndex=0,sequence=0,elapsedMs=0;
  while(remaining.length){
    let area=0,count=0;
    while(count<remaining.length){
      const next=area+areas[remaining[count]];
      if(count>0&&next>plateArea*.88)break;
      area=next;count++;
    }
    count=Math.max(1,count);
    let solved:ReturnType<typeof solveOneSheet>|undefined;
    for(let attempt=0;attempt<8;attempt++){
      const counts=batchCounts(remaining,count,parts.length);
      const attemptSeed=(BigInt(data.seed)+BigInt(sheetIndex*17+attempt+1)).toString();
      const started=performance.now();
      const result=solveOneSheet(wasm,doc,counts,seconds,attemptSeed,clearance,preset,send,solverBinary,control);
      elapsedMs+=performance.now()-started;
      if(result.candidate.solution.strip_width<=length+1e-6){solved=result;break;}
      if(count===1){
        const part=parts[remaining[0]];
        throw Error(`${part.name} tek başına ${width} × ${length} mm plakaya izin verilen dönüşlerle sığmıyor.`);
      }
      const ratio=length/result.candidate.solution.strip_width;
      const reduced=Math.max(1,Math.min(count-1,Math.floor(count*ratio*.92)));
      count=reduced<count?reduced:count-1;
    }
    if(!solved)throw Error('Kalan parçalar verilen plaka ölçüsüne güvenli şekilde yerleştirilemedi.');
    for(const item of solved.candidate.solution.layout.placed_items){
      const globalItem=solved.localToGlobal[item.item_id];
      if(globalItem===undefined)throw Error('Plaka yerleşiminde parça eşlemesi bozuldu.');
      placed.push({item_id:globalItem,transformation:{rotation:item.transformation.rotation,
        translation:[item.transformation.translation[0]+sheetIndex*length,item.transformation.translation[1]]}});
    }
    remaining.splice(0,count);
    sheetIndex++;
  }
  send({type:'candidate',sequence:++sequence,report:'SheetFeas',elapsedMs,
    solution:{strip_width:sheetIndex*length,layout:{placed_items:placed}}});
  send({type:'finished'});
}

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
    if(data.type==='start'&&doc?.settings.materialType==='sheet'){
      solveSheetMode(wasm,doc,data,send,solverBinary,control);
      return;
    }
    const input=doc?solverInput(doc):(data as Extract<Start,{type:'bridge'}>).input;
    const seconds=data.type==='bridge'?data.seconds:doc!.settings.timeLimitSeconds,clearance=doc?.settings.clearanceMm??0,preset=doc?.settings.solverPreset??'standard';
    send({type:'run-input',input,seed:data.seed,seconds,clearance,preset,threads:wasm.thread_count(),solverBinary});
    wasm.run(input, seconds??undefined, data.seed, clearance, preset, (json: string) => {
      const message = JSON.parse(json) as SolverMessage;
      if(control&&message.type==='phase'&&message.phase==='Compression')Atomics.store(control,0,-1);
      send(message);
    }, control?(reset:boolean)=>{if(reset)Atomics.compareExchange(control,0,1,0);return Atomics.load(control,0)===1;}:undefined);
  } catch (error) {
    send({ type: 'error', message: String(error) });
    if(data.type==='preload')self.close();
  }
};