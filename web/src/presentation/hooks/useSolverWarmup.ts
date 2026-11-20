import { useEffect } from 'react';

/** Warm WASM runtime without blocking the editor; stop after 15 seconds. */
export function useSolverWarmup(loadingExample:boolean) {
  useEffect(()=>{
    if(loadingExample)return;
    const worker=new Worker(new URL('../../workers/solver-runtime.worker.ts',import.meta.url),{type:'module'});
    const timeout=setTimeout(()=>worker.terminate(),15_000);
    const done=()=>{clearTimeout(timeout);worker.terminate();};
    worker.onmessage=done;
    worker.onerror=event=>{event.preventDefault();done();};
    worker.postMessage({type:'preload',threads:1});
    return done;
  },[loadingExample]);
}
