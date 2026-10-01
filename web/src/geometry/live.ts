import polygonClipping from 'polygon-clipping';
import type {Document,Result,Ring} from '../model';
import {bounds} from './normalize';
import {collisionWorldRings,worldParts,type WorldPart} from './validate';

export type LiveGeometry={world:WorldPart[];overlaps:Ring[][];errors:string[]};
// Display only: a live frame never grants validation or export authority.
export function liveGeometry(doc:Document,result:Result):LiveGeometry {
  const world=worldParts(doc,result),collision=collisionWorldRings(doc,result),boxes=collision.map(bounds),overlaps:Ring[][]=[],errors:string[]=[];
  for(let i=0;i<world.length;i++)for(let j=0;j<i;j++) {
    if(doc.settings.materialType==='sheet' && result.placements[i].sheetIndex!==result.placements[j].sheetIndex)continue;
    const a=boxes[i],b=boxes[j];
    if(a[0]>=b[2]||b[0]>=a[2]||a[1]>=b[3]||b[1]>=a[3])continue;
    try { overlaps.push(...polygonClipping.intersection([collision[i]],[collision[j]])); }
    catch(error) {
      // ponytail: retain the first 20 clip failures per frame; full per-pair logs belong in a repro fixture.
      if(errors.length<20)errors.push(`Copies ${world[j].partId}:${world[j].copyIndex} and ${world[i].partId}:${world[i].copyIndex}: ${error instanceof Error?error.message:String(error)}`);
    }
  }
  return {world,overlaps,errors};
}
