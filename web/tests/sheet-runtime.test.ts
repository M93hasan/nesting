import {afterEach,expect,test,vi} from 'vitest';
import {DEFAULT_SETTINGS,newPart,type Document} from '../src/model';
import {solverInput} from '../src/import/sparrow';
import {candidateResult} from '../src/workers/solverResult';
import {validate} from '../src/geometry/validate';
import {prepareSheetSearch} from '../src/geometry/sheetSearch';
import type {Candidate,SolverMessage,Start} from '../src/workers/protocol';

afterEach(()=>{vi.unstubAllGlobals();vi.doUnmock('../src/wasm');vi.resetModules();});

async function execute(materialType:'roll'|'sheet'){
  const heights=[6,6,4,4],starts=[0,7,14,19];
  const doc:Document={name:'runtime-packing',parts:heights.map((h,i)=>({...newPart([[0,0],[1,0],[1,h],[0,h]]),id:`p${i}`})),
    settings:{...DEFAULT_SETTINGS,materialType,materialWidthMm:20,materialLengthMm:10}};
  const candidate:Candidate={type:'candidate',runId:1,documentRevision:5,sequence:1,report:'ExplFeas',elapsedMs:1,
    solution:{strip_width:23,layout:{placed_items:heights.map((_,i)=>({item_id:i,transformation:{rotation:0,translation:[starts[i],i*2]}}))}}};
  const messages:SolverMessage[]=[],inputs:string[]=[];
  const scope={postMessage:(message:SolverMessage)=>messages.push(message),close:()=>{},onmessage:undefined as undefined|((event:{data:Start})=>Promise<void>)};
  vi.stubGlobal('self',scope);
  vi.doMock('../src/wasm',()=>({supportsSIMD:true,loadSerialWasm:async()=>({default:async()=>{},thread_count:()=>1,
    run:(input:string,_seconds:number,_seed:string,_clearance:number,_preset:string,callback:(json:string)=>void)=>{
      inputs.push(input);
      const invalid=structuredClone(candidate);invalid.sequence=999;
      invalid.solution.layout.placed_items[0].transformation.translation=[0,100];
      callback(JSON.stringify({...invalid,type:'live'}));
      callback(JSON.stringify({...candidate,type:'live'}));
      callback(JSON.stringify(candidate));callback(JSON.stringify({type:'finished'}));
    }})}));
  await import('../src/workers/solver-runtime.worker');
  await scope.onmessage!({data:{type:'start',runId:1,documentRevision:5,seed:'42',document:doc,threads:1}});
  return {doc,candidate,messages,inputs};
}

test('the real runtime constrains the finite plate axis and publishes physical coordinates',async()=>{
  const {doc,messages,inputs}=await execute('sheet');
  expect(inputs).toEqual([solverInput(prepareSheetSearch(doc).document)]);
  expect(JSON.parse(inputs[0]).strip_height).toBeCloseTo(10.02);
  const candidate=messages.find(message=>message.type==='candidate') as Candidate;
  expect(candidate.sheetResult).toMatchObject({sheetCount:1,documentRevision:5});
  expect(messages.filter(message=>message.type==='live'||message.type==='candidate')
    .every(message=>'sheetResult' in message)).toBe(true);
  expect(messages.some(message=>'sequence' in message&&message.sequence===999)).toBe(false);
  const decoded=candidateResult(doc,candidate,'42');
  expect(decoded.placements).toHaveLength(4);
  expect(validate(doc,decoded).status).toBe('passed');
  expect(messages.at(-1)?.type).toBe('finished');
});

test('roll candidates pass through the runtime without sheet repacking',async()=>{
  const {candidate,messages,inputs,doc}=await execute('roll');
  expect(inputs).toEqual([solverInput(doc)]);
  expect(messages.find(message=>message.type==='candidate')).toEqual(candidate);
});
