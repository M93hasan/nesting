import type {Document,Placement,Result} from '../model';
import {bounds} from './normalize';
import {collisionRing,transform} from './validate';

// Plate conversion is a bounded geometric arrangement of the SAME Sparrow
// solution, not a separate solver: only rigid translations are permitted.
// No angles, copy identities, DXF contours, or per-part dimensions change.
// The caller must validate every candidate and retain its safe fallback.
type Box=[number,number,number,number];
type Item={placement:Placement;box:Box;sourceSheet:number;sourceY:number;area:number};
type Positioned={placement:Placement;box:Box};
const EPS=1e-7;
const MAX_COPIES=120,MAX_VERTICES=18000,MAX_TRIALS=18000;
const distance=(a:Box,b:Box,gap:number)=>(
  a[2]+gap<=b[0]+EPS||b[2]+gap<=a[0]+EPS||
  a[3]+gap<=b[1]+EPS||b[3]+gap<=a[1]+EPS
);
function occupiedDepth(sheets:Positioned[][],length:number,top:boolean){
  return sheets.reduce((sum,sheet)=>sum+(sheet.length?
    top?length-Math.min(...sheet.map(x=>x.box[1])):Math.max(...sheet.map(x=>x.box[3])):0),0);
}
function evaluate(doc:Document,result:Result,parts:Map<string,ReturnType<typeof collisionRing>>){
  const sheets:Positioned[][]=Array.from({length:result.sheetCount??1},()=>[]);
  for(const placement of result.placements){
    const ring=parts.get(placement.partId);if(!ring)return;
    const sheet=placement.sheetIndex??0;
    if(!sheets[sheet])return;
    sheets[sheet].push({placement,box:bounds(transform(ring,placement)) as Box});
  }
  return sheets;
}
function score(sheets:Positioned[][],length:number,top:boolean){
  return {count:sheets.length,depth:occupiedDepth(sheets,length,top),
    lastLoad:sheets.at(-1)?.length??0};
}
function better(a:ReturnType<typeof score>,b:ReturnType<typeof score>){
  if(a.count!==b.count)return a.count<b.count;
  // Compact the material used within each fixed sheet when counts tie.
  if(Math.abs(a.depth-b.depth)>0.01)return a.depth<b.depth;
  return a.count>1&&a.lastLoad<b.lastLoad;
}
export function compactRollLayoutIntoPlates(doc:Document,result:Result):Result {
  if(doc.settings.materialType!=='sheet'||result.placements.length<2||
    result.placements.length>MAX_COPIES||result.validation.status!=='passed')return result;
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm??0;
  const gap=Math.max(0,doc.settings.clearanceMm),top=doc.settings.startCorner==='right-top';
  if(!(width>0&&length>0))return result;
  const partMap=new Map(doc.parts.map(part=>[part.id,part]));
  const rings=new Map(doc.parts.map(part=>[part.id,collisionRing(part)] as const));
  const vertexCount=result.placements.reduce((sum,placement)=>sum+(rings.get(placement.partId)?.length??0),0);
  if(vertexCount>MAX_VERTICES)return result;
  const original=evaluate(doc,result,rings);
  if(!original)return result;
  const baseline=score(original,length,top);
  const items:Item[]=[];
  for(const placement of result.placements){
    const ring=rings.get(placement.partId);if(!ring||!partMap.has(placement.partId))return result;
    const box=bounds(transform(ring,placement)) as Box;
    const w=box[2]-box[0],h=box[3]-box[1];
    if(w>width+EPS||h>length+EPS)return result;
    items.push({placement,box,sourceSheet:placement.sheetIndex??0,
      sourceY:box[1],area:w*h});
  }
  // Try the exact roll order first, then large-first if it fits more copies
  // in earlier plates. Stop after a fixed number of rectangle checks.
  const orders=[
    [...items].sort((a,b)=>a.sourceSheet-b.sourceSheet||a.sourceY-b.sourceY||b.area-a.area),
    [...items].sort((a,b)=>b.area-a.area||a.sourceSheet-b.sourceSheet||a.sourceY-b.sourceY)
  ];
  let best=result,bestScore=baseline;
  for(const order of orders){
    const sheets:Positioned[][]=[];
    let trials=0,aborted=false;
    for(const item of order){
      if(trials>=MAX_TRIALS){aborted=true;break;}
      const w=item.box[2]-item.box[0],h=item.box[3]-item.box[1];
      let found=false;
      for(let sheetIndex=0;sheetIndex<=sheets.length&&!found;sheetIndex++){
        // Never create an additional plate beyond the already valid solution.
        if(sheetIndex>=baseline.count)break;
        const occupied=sheets[sheetIndex]??[];
        const xs=new Set<number>([item.box[0],0,width-w]);
        const ys=new Set<number>([top?length-h:0,0,length-h]);
        for(const other of occupied){
          xs.add(other.box[2]+gap);xs.add(other.box[0]-w-gap);
          ys.add(other.box[3]+gap);ys.add(other.box[1]-h-gap);
        }
        const xOptions=[...xs].filter(x=>x>=-EPS&&x+w<=width+EPS)
          .map(x=>Math.max(0,Math.min(width-w,x)))
          .sort((a,b)=>Math.abs(a-item.box[0])-Math.abs(b-item.box[0])||b-a)
          .slice(0,30);
        const yOptions=[...ys].filter(y=>y>=-EPS&&y+h<=length+EPS)
          .map(y=>Math.max(0,Math.min(length-h,y)))
          .sort((a,b)=>top?b-a:a-b)
          .slice(0,45);
        for(const y of yOptions){
          if(found||aborted)break;
          for(const x of xOptions){
            if(++trials>MAX_TRIALS){aborted=true;break;}
            const box:Box=[x,y,x+w,y+h];
            if(occupied.some(other=>!distance(box,other.box,gap)))continue;
            if(!sheets[sheetIndex])sheets[sheetIndex]=[];
            sheets[sheetIndex].push({box,placement:{...item.placement,
              xMm:item.placement.xMm+x-item.box[0],yMm:item.placement.yMm+y-item.box[1],
              sheetIndex}});
            found=true;break;
          }
        }
      }
      if(!found){aborted=true;break;}
    }
    if(aborted||sheets.some(sheet=>!sheet?.length))continue;
    const candidateScore=score(sheets,length,top);
    if(!better(candidateScore,bestScore))continue;
    const updates=new Map<string,Placement>();
    for(const sheet of sheets)for(const item of sheet)
      updates.set(JSON.stringify([item.placement.partId,item.placement.copyIndex]),item.placement);
    const placements=result.placements.map(item=>updates.get(JSON.stringify([item.partId,item.copyIndex]))??item);
    if(placements.length!==updates.size)continue;
    best={...result,placements,sheetCount:sheets.length,usedLengthMm:sheets.length*length,
      validation:{status:'pending',overlapAreaMm2:null,maxBoundaryViolationMm:null,
        minClearanceMm:null,errors:[]}};
    bestScore=candidateScore;
  }
  return best;
}
