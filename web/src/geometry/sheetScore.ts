import type {Document,Result} from '../model';
import {collisionRing,transform} from './validate';
import {bounds} from './normalize';

/** Prefer layouts that use fewer plates, then compact occupied sheet depth. */
export function sheetLayoutScore(doc:Document,result:Result):number {
  if(doc.settings.materialType!=='sheet')return result.usedLengthMm;
  const parts=new Map(doc.parts.map(part=>[part.id,part]));
  const edges=new Map<number,number>();
  const top=doc.settings.startCorner==='right-top';
  const length=doc.settings.materialLengthMm??0;
  for(const placement of result.placements){
    const part=parts.get(placement.partId);
    if(!part)return Infinity;
    const bb=bounds(transform(collisionRing(part),placement));
    const d=top?length-bb[1]:bb[3];
    const index=placement.sheetIndex??0;
    edges.set(index,Math.max(edges.get(index)??0,d));
  }
  return [...edges.values()].reduce((a,b)=>a+b,0);
}
export function isBetterSheetResult(doc:Document,proposed:Result,previous?:Result,
  newStripLength=Infinity,oldStripLength=Infinity):boolean {
  if(!previous)return true;
  const sheetsA=proposed.sheetCount??1,sheetsB=previous.sheetCount??1;
  if(sheetsA!==sheetsB)return sheetsA<sheetsB;
  const a=sheetLayoutScore(doc,proposed),b=sheetLayoutScore(doc,previous);
  if(Math.abs(a-b)>0.01)return a<b;
  return newStripLength<oldStripLength-0.00001;
}
