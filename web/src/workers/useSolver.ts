import { useEffect, useRef, useState } from 'react';
import { createWorkerNestingEngine } from '../infrastructure/nesting/WorkerNestingEngine';
export { candidateResult } from '../infrastructure/nesting/candidateResult';
export { phaseImprovements, type Timing } from '../application/nesting/phaseImprovements';
export { wallClockLimitSeconds } from '../domain/nesting/wallClockLimitSeconds';
export type { RunState, Diagnostics, LiveFrame } from '../infrastructure/nesting/WorkerNestingEngine';

/** React adapter: subscribe to engine snapshots without owning nesting policy. */
export function useSolver() {
  const current=useRef<ReturnType<typeof createWorkerNestingEngine>|null>(null);
  if(!current.current)current.current=createWorkerNestingEngine();
  const engine=current.current;
  const [snapshot,setSnapshot]=useState(engine.getSnapshot);
  useEffect(()=>{
    const unsubscribe=engine.subscribe(()=>setSnapshot(engine.getSnapshot()));
    const deactivate=engine.activate();
    return ()=>{unsubscribe();deactivate();};
  },[engine]);
  useEffect(()=>engine.markResultRendered(snapshot.result,snapshot.live),[engine,snapshot.result,snapshot.live]);
  return {
    ...snapshot,
    start:engine.start,
    stop:engine.stop,
    invalidate:engine.invalidate,
    load:engine.load,
    skipToCompression:engine.skipToCompression,
    diagnostics:engine.diagnostics,
  };
}
