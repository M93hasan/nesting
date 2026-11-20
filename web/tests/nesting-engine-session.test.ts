import { afterEach, expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document, type Result } from '../src/model';
import { createWorkerNestingEngine } from '../src/infrastructure/nesting/WorkerNestingEngine';

type AnyMessage = Record<string, unknown>;
class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<AnyMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: AnyMessage[] = [];
  terminated = false;
  constructor(_url: URL, _options: WorkerOptions) { FakeWorker.all.push(this); }
  postMessage(message: AnyMessage) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  reply(data: AnyMessage) { this.onmessage?.({ data } as MessageEvent<AnyMessage>); }
}
const doc: Document = { name: 'run', parts: [], settings: { ...DEFAULT_SETTINGS, timeLimitSeconds: 30 } };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); FakeWorker.all = []; });

test('NestingEngine owns state, Worker lifecycle and invalidates stale run messages', () => {
  vi.stubGlobal('Worker', FakeWorker);
  const engine = createWorkerNestingEngine();
  const changed = vi.fn();
  const unsubscribe = engine.subscribe(changed);
  const deactivate = engine.activate();
  engine.start(doc, 8, 1);
  expect(engine.getSnapshot().state).toBe('Initializing');
  expect(FakeWorker.all).toHaveLength(3);
  expect(FakeWorker.all[0].messages.at(-1)).toMatchObject({ type: 'start', documentRevision: 8, threads: 1 });
  const runId = Number(FakeWorker.all[0].messages.at(-1)?.runId);
  FakeWorker.all[0].reply({ type: 'phase', runId: runId - 1, documentRevision: 8, phase: 'Exploration', workers: 1, initializationMs: 4 });
  expect(engine.getSnapshot().state).toBe('Initializing');
  FakeWorker.all[0].reply({ type: 'phase', runId, documentRevision: 8, phase: 'Exploration', workers: 1, initializationMs: 4 });
  expect(engine.getSnapshot().state).toBe('Running');
  expect(engine.getSnapshot().phase).toBe('Exploration');
  engine.stop();
  expect(engine.getSnapshot().state).toBe('Stopped');
  expect(FakeWorker.all[0].messages.at(-1)).toEqual({ type: 'stop' });
  engine.invalidate();
  expect(engine.getSnapshot().state).toBe('Ready');
  expect(FakeWorker.all[1].terminated).toBe(true);
  expect(FakeWorker.all[2].terminated).toBe(true);
  expect(changed).toHaveBeenCalled();
  unsubscribe();deactivate();
});

test('NestingEngine preserves validated candidates and finalization state', () => {
  vi.stubGlobal('Worker', FakeWorker);
  const engine = createWorkerNestingEngine();
  const withPart: Document = { ...doc, parts: [{
    id:'p',name:'p',source:{format:'drawn'},outer:[[0,0],[10,0],[10,10],[0,10]],holes:[],
    approximationToleranceMm:0,quantity:1,rotations:{kind:'discrete',degrees:[0]},preparationPosition:[0,0],
  }] };
  const deactivate=engine.activate();
  engine.start(withPart, 3);
  const [solver,,validator]=FakeWorker.all;
  const runId=Number(solver.messages.at(-1)?.runId);
  const ids={runId,documentRevision:3};
  solver.reply({...ids,type:'candidate',sequence:1,report:'StripFeas',elapsedMs:1000,
    solution:{strip_width:30,layout:{placed_items:[{item_id:0,transformation:{rotation:0,reflected:false,translation:[0,0]}}]}}});
  const validating=validator.messages.find(m=>m.type==='validate');
  expect(validating?.sequence).toBe(1);
  const packed = validating?.result as Result;
  validator.reply({...ids,type:'validated-candidate',sequence:1,
    result:{...packed,validation:{status:'passed',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}}});
  solver.reply({...ids,type:'finished'});
  expect(engine.getSnapshot().state).toBe('Complete');
  expect(engine.getSnapshot().result?.validation.status).toBe('passed');
  expect(engine.getSnapshot().result?.usedLengthMm).toBe(30);
  deactivate();
});
