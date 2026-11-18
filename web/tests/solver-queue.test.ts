import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import type {GeometryRequest,GeometryReply,SolverMessage} from '../src/workers/protocol';
import {example,newPart,type Document,type Result} from '../src/model';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {validate} from '../src/geometry/validate';

// Drive the actual hook and mocked worker messages without a DOM/React renderer.
const hooks=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,effects:[] as (()=>void|(()=>void))[],cleanups:[] as (()=>void)[]}));
vi.mock('react',()=>({
  useState:(initial:unknown)=>{const i=hooks.cursor++;if(!(i in hooks.slots))hooks.slots[i]=typeof initial==='function'?initial():initial;return [hooks.slots[i],(value:unknown)=>{hooks.slots[i]=typeof value==='function'?value(hooks.slots[i]):value;}];},
  useRef:(initial:unknown)=>{const i=hooks.cursor++;if(!(i in hooks.slots))hooks.slots[i]={current:initial};return hooks.slots[i];},
  useEffect:(effect:()=>void|(()=>void))=>{const i=hooks.cursor++;if(!(i in hooks.slots)){hooks.slots[i]=true;hooks.effects.push(effect);}},
}));
import {useSolver} from '../src/workers/useSolver';
import {exportSVG} from '../src/export/svg';
import {exportProject} from '../src/import/project';

type WorkerResponse=SolverMessage|GeometryReply|
  {type:'validated-candidate';runId:number;documentRevision:number;sequence:number;result?:Result;error?:string};
type WorkerMessage={type:string;[key:string]:unknown};
class WorkerStub {
  static all:WorkerStub[]=[];
  messages:WorkerMessage[]=[];terminated=false;
  onmessage?:({data}:{data:WorkerResponse})=>void;
  onerror?:(event:{message:string})=>void;
  constructor(){WorkerStub.all.push(this);}
  postMessage(message:WorkerMessage){this.messages.push(message);}
  terminate(){this.terminated=true;}
  deliver(data:WorkerResponse){this.onmessage?.({data});}
}
function render(){hooks.cursor=0;const result=useSolver();for(const effect of hooks.effects.splice(0)){const cleanup=effect();if(cleanup)hooks.cleanups.push(cleanup);}return result;}
const doc:Document={...example(),parts:[{...newPart([[0,0],[10,0],[10,10],[0,10]]),id:'part',quantity:1}],settings:{materialWidthMm:20,clearanceMm:0,timeLimitSeconds:120}};
function candidate(runId:number,documentRevision:number,sequence:number,length:number):SolverMessage {
  return {type:'candidate',runId,documentRevision,sequence,report:'ExplFeas',elapsedMs:sequence*100,solution:{strip_width:length,layout:{placed_items:[{item_id:0,transformation:{rotation:0,translation:[0,0]}}]}}};
}
function accept(validator:WorkerStub,document:Document,sequence:number){
  const message=validator.messages.find(m=>m.type==='validate'&&m.sequence===sequence);
  expect(message,'validator should receive the candidate').toBeDefined();
  const request=message as {type:string;runId:number;documentRevision:number;sequence:number;result:Result};
  const packed=packResultIntoSheets(document,request.result);
  const checked=validate(document,packed);
  validator.deliver({type:'validated-candidate',runId:request.runId,documentRevision:request.documentRevision,
    sequence:request.sequence,result:{...packed,validation:{...checked,source:'local'}}});
}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('Worker',WorkerStub);WorkerStub.all=[];hooks.slots=[];hooks.cursor=0;hooks.effects=[];hooks.cleanups=[];});
afterEach(()=>{for(const cleanup of hooks.cleanups)cleanup();vi.unstubAllGlobals();vi.useRealTimers();});

test('roll candidates are checked off-thread and the best verified result remains exportable',()=>{
  render().start(doc,7);const [solver,preview,validator]=WorkerStub.all;
  expect(WorkerStub.all).toHaveLength(3);
  expect(validator.messages[0]?.type).toBe('init');
  expect(preview.messages[0]?.type).toBe('live-preview-init');
  solver.deliver(candidate(1,7,1,20));solver.deliver(candidate(1,7,2,12));solver.deliver(candidate(1,7,3,18));
  expect(render().result).toBeUndefined();
  accept(validator,doc,1);accept(validator,doc,2);accept(validator,doc,3);
  vi.advanceTimersByTime(300);
  expect(render().result).toMatchObject({usedLengthMm:12,validation:{status:'passed',source:'local'}});
  expect(()=>exportSVG(doc,render().result)).not.toThrow();
  expect(()=>exportProject(doc,7,render().result)).not.toThrow();
  expect(preview.messages.every(message=>['live-preview-init','live-preview'].includes(message.type))).toBe(true);
  solver.deliver({type:'finished',runId:1,documentRevision:7});
  expect(render().state).toBe('Complete');
  solver.onerror?.({message:'Late worker error'});
  expect(render().state).toBe('Complete');
});

test('sheet candidates are validated on a worker before publishing valid plate bounds',()=>{
  const sheetDoc:Document={...doc,settings:{...doc.settings,materialType:'sheet',materialWidthMm:20,materialLengthMm:20,timeLimitSeconds:120}};
  render().start(sheetDoc,7);const [solver,,validator]=WorkerStub.all;
  solver.deliver(candidate(1,7,1,10));
  expect(render().result).toBeUndefined();
  accept(validator,sheetDoc,1);
  vi.advanceTimersByTime(300);
  expect(render().result).toMatchObject({solverRevision:expect.not.stringContaining('quick-sheet'),sheetCount:1,validation:{status:'passed',source:'local'}});
});

test('sheet candidates decode stacked Sparrow coordinates into two distinct plates',()=>{
  const sheetDoc:Document={...doc,parts:[{...doc.parts[0],quantity:2}],settings:{...doc.settings,materialType:'sheet',materialWidthMm:20,materialLengthMm:20,timeLimitSeconds:120}};
  render().start(sheetDoc,7);const [solver,,validator]=WorkerStub.all;
  solver.deliver({type:'candidate',runId:1,documentRevision:7,sequence:1,report:'SheetFeas',elapsedMs:100,
    solution:{strip_width:40,layout:{placed_items:[
      {item_id:0,transformation:{rotation:0,translation:[0,0]}},
      {item_id:1,transformation:{rotation:0,translation:[20,0]}}
    ]}}});
  accept(validator,sheetDoc,1);
  vi.advanceTimersByTime(300);
  expect(render().result?.placements.map(p=>p.sheetIndex)).toEqual([0,1]);
  expect(render().result?.sheetCount).toBe(2);
});

test('a failed live preview is skipped without disabling all later previews',()=>{
  render().start(doc,7);const [solver,preview]=WorkerStub.all;
  solver.deliver({...candidate(1,7,1,20),type:'live'});
  vi.advanceTimersByTime(300);
  preview.deliver({type:'live-preview-skipped',runId:1,documentRevision:7,sequence:1,message:'clip failed'});
  expect(preview.terminated).toBe(false);
  expect(render().diagnostics.current?.liveErrors).toEqual([{sequence:1,message:'clip failed'}]);
  solver.deliver({...candidate(1,7,2,18),type:'live'});
  vi.advanceTimersByTime(300);
  expect(preview.messages.filter(message=>message.type==='live-preview')).toHaveLength(2);
});

test('old revisions and queued validation cannot overwrite results after Stop',()=>{
  render().start(doc,7);const [oldSolver,oldPreview,oldValidator]=WorkerStub.all;
  oldSolver.deliver(candidate(1,7,1,20));accept(oldValidator,doc,1);
  render().stop();expect(render().state).toBe('Stopped');expect(render().result?.usedLengthMm).toBe(20);
  render().start(doc,8);const [solver,,validator]=WorkerStub.all.slice(3);
  expect(oldPreview.terminated).toBe(true);
  expect(oldValidator.terminated).toBe(true);
  oldSolver.deliver({type:'finished',runId:1,documentRevision:7});oldSolver.onerror?.({message:'Old worker error'});
  solver.deliver(candidate(1,8,1,20));solver.deliver(candidate(2,7,1,20));
  expect(render().result).toBeUndefined();expect(render().state).toBe('Initializing');
  solver.deliver(candidate(2,8,1,20));accept(validator,doc,1);
  render().stop();solver.deliver(candidate(2,8,2,15));
  expect(render().state).toBe('Stopped');expect(render().result).toMatchObject({documentRevision:8,usedLengthMm:20});
});

test('wall-clock deadline keeps an already validated solution',()=>{
  render().start({...doc,settings:{...doc.settings,timeLimitSeconds:10}},7);
  const [solver,,validator]=WorkerStub.all;
  vi.advanceTimersByTime(1);
  solver.deliver({type:'phase',runId:1,documentRevision:7,phase:'Exploration',workers:1,initializationMs:0});
  solver.deliver(candidate(1,7,1,20));accept(validator,doc,1);
  vi.advanceTimersByTime(9999);
  expect(render().state).toBe('Complete');
  expect(render().result?.usedLengthMm).toBe(20);
  solver.deliver({...candidate(1,7,2,18),report:'Final'});
  expect(render().result?.usedLengthMm).toBe(20);
});

test('solver completion waits for pending off-thread validity but cannot wait forever',()=>{
  render().start(doc,7);const [solver,,validator]=WorkerStub.all;
  solver.deliver(candidate(1,7,1,20));
  solver.deliver({type:'finished',runId:1,documentRevision:7});
  expect(render().state).toBe('Initializing');
  accept(validator,doc,1);
  expect(render().state).toBe('Complete');
  expect(render().result?.validation.status).toBe('passed');
});

test('overdue validation ends cleanly instead of freezing the UI',()=>{
  render().start(doc,7);const [solver,,validator]=WorkerStub.all;
  solver.deliver(candidate(1,7,1,20));
  solver.deliver({type:'finished',runId:1,documentRevision:7});
  vi.advanceTimersByTime(12_001);
  expect(render().state).toBe('Error');
  expect(validator.terminated).toBe(true);
});
