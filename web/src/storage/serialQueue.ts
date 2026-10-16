/** Run asynchronous writes in arrival order so stale saves cannot finish last. */
export function createSerialQueue() {
  let tail:Promise<void>=Promise.resolve();
  return <T>(task:()=>Promise<T>):Promise<T>=>{
    const next=tail.then(task);
    // A failed save must not prevent a later save from retrying.
    tail=next.then(()=>undefined,()=>undefined);
    return next;
  };
}
