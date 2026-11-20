/** Pure quality metrics: independent of React and Web Worker lifecycles. */
export type Timing={phase?:string;sequence:number;elapsedMs:number;lengthMm:number;validation?:string;validationMs?:number;errors?:string[]};
export function phaseImprovements(history:Timing[],lengthMm:number) {
  const valid=history.filter(entry=>entry.validation==='passed'),first=valid[0];
  if(!first)return undefined;
  const exploration=valid.filter(entry=>entry.phase!=='Compression');
  if(!exploration.length)return undefined;
  const explored=Math.min(...exploration.map(entry=>entry.lengthMm));
  return {explore:(1-explored/first.lengthMm)*100,compress:Math.max(0,(1-lengthMm/explored)*100)};
}
