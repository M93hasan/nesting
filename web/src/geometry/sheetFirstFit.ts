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
function footprint(sheet:Positioned[]):number {
  if(!sheet.length)return 0;
  const left=Math.min(...sheet.map(item=>item.box[0]));
  const right=Math.max(...sheet.map(item=>item.box[2]));
  const bottom=Math.min(...sheet.map(item=>item.box[1]));
  const top=Math.max(...sheet.map(item=>item.box[3]));
  // A compact rectangular footprint matters on *every* fixed plate,
  // including the last. A one-row ribbon is not automatically superior.
  return (right-left)+(top-bottom);
}
function score(sheets:Positioned[][],length:number,top:boolean){
  return {count:sheets.length,
    footprint:sheets.reduce((sum,sheet)=>sum+footprint(sheet),0),
    depth:occupiedDepth(sheets,length,top),
    lastLoad:sheets.at(-1)?.length??0};
}
function better(a:ReturnType<typeof score>,b:ReturnType<typeof score>){
  if(a.count!==b.count)return a.count<b.count;
  if(Math.abs(a.footprint-b.footprint)>0.01)return a.footprint<b.footprint;
  if(Math.abs(a.depth-b.depth)>0.01)return a.depth<b.depth;
  return a.count>1&&a.lastLoad<b.lastLoad;
}
/** Repack each plate independently, including Plate 2, Plate 3 and later.
 * Same parts and rotations, rigid translations only. Candidate acceptance
 * remains subject to full contour validation in the geometry worker. */
function compactIndividualPlates(doc:Document,result:Result,
    rings:Map<string,ReturnType<typeof collisionRing>>):Result {
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm!;
  const gap=Math.max(0,doc.settings.clearanceMm),top=doc.settings.startCorner==='right-top';
  const groups=evaluate(doc,result,rings);
  if(!groups)return result;
  const adjusted:Positioned[][]=groups.map(sheet=>sheet);
  let changed=false,checks=0;
  const allowed=()=>{
    // Keep work bounded inside the existing background validation worker.
    return checks<48_000;
  };
  for(let sheetIndex=0;sheetIndex<groups.length;sheetIndex++){
    const original=groups[sheetIndex];
    if(original.length<2)continue;
    let winner=original,winnerMetric=footprint(original);
    const sorters=[
      (a:Positioned,b:Positioned)=>((b.box[2]-b.box[0])*(b.box[3]-b.box[1])-
        (a.box[2]-a.box[0])*(a.box[3]-a.box[1])),
      (a:Positioned,b:Positioned)=>(b.box[3]-b.box[1])-(a.box[3]-a.box[1]),
      (a:Positioned,b:Positioned)=>top?b.box[1]-a.box[1]:a.box[1]-b.box[1]
    ];
    for(const sorter of sorters){
      if(!allowed())break;
      const order=[...original].sort(sorter),placed:Positioned[]=[];
      let failed=false;
      for(const item of order){
        if(!allowed()){failed=true;break;}
        const w=item.box[2]-item.box[0],h=item.box[3]-item.box[1];
        const xs=new Set<number>([0,width-w]),ys=new Set<number>([0,length-h]);
        for(const other of placed){
          xs.add(other.box[0]-w-gap);xs.add(other.box[2]+gap);
          ys.add(other.box[1]-h-gap);ys.add(other.box[3]+gap);
        }
        const xx=[...xs].filter(x=>Number.isFinite(x)&&x>=-EPS&&x+w<=width+EPS)
          .map(x=>Math.max(0,Math.min(width-w,x))).slice(0,64);
        const yy=[...ys].filter(y=>Number.isFinite(y)&&y>=-EPS&&y+h<=length+EPS)
          .map(y=>Math.max(0,Math.min(length-h,y))).slice(0,64);
        let choice:{x:number;y:number;cost:number}|undefined;
        const left=placed.length?Math.min(...placed.map(p=>p.box[0])):Infinity;
        const right=placed.length?Math.max(...placed.map(p=>p.box[2])):-Infinity;
        const bottom=placed.length?Math.min(...placed.map(p=>p.box[1])):Infinity;
        const upper=placed.length?Math.max(...placed.map(p=>p.box[3])):-Infinity;
        for(const y of yy)for(const x of xx){
          if(!allowed())break;
          checks++;
          const box:Box=[x,y,x+w,y+h];
          if(placed.some(other=>!distance(box,other.box,gap)))continue;
          const minX=Math.min(left,x),maxX=Math.max(right,x+w);
          const minY=Math.min(bottom,y),maxY=Math.max(upper,y+h);
          const compactCost=(maxX-minX)+(maxY-minY);
          // Tie-break by requested start corner: right side, bottom or top.
          const cost=compactCost+1e-6*(width-maxX+(top?length-maxY:minY));
          if(!choice||cost<choice.cost-1e-8)choice={x,y,cost};
        }
        if(!choice){failed=true;break;}
        placed.push({box:[choice.x,choice.y,choice.x+w,choice.y+h],
          placement:{...item.placement,
            xMm:item.placement.xMm+choice.x-item.box[0],
            yMm:item.placement.yMm+choice.y-item.box[1],
            sheetIndex}});
      }
      if(failed||placed.length!==original.length)continue;
      const metric=footprint(placed);
      if(metric<winnerMetric-0.01){winner=placed;winnerMetric=metric;}
    }
    // Shelf layouts use the very same parts and rigid translations, but
    // try several target row widths. The greedy free-point strategy can put
    // five long pieces in a 4+1 row even when a 3+2 arrangement is tighter.
    // Repeating this for EACH physical plate avoids the sparse last plate.
    for(const sorter of sorters){
      if(!allowed())break;
      const order=[...original].sort(sorter);
      for(const targetRatio of [0.5,0.6,0.67,0.75,0.85,1]){
        if(!allowed())break;
        const maxPartWidth=Math.max(...order.map(p=>p.box[2]-p.box[0]));
        const rowLimit=Math.max(maxPartWidth,width*targetRatio);
        let rowX=0,rowY=0,rowHeight=0;
        const placed:Positioned[]=[];
        let failed=false;
        for(const item of order){
          const w=item.box[2]-item.box[0],h=item.box[3]-item.box[1];
          if(rowX>EPS && rowX+gap+w>rowLimit+EPS){
            rowY+=rowHeight+gap;rowX=0;rowHeight=0;
          }
          if(++checks>48_000||rowY+h>length+EPS){failed=true;break;}
          const x=rowX,y=rowY;
          const box:Box=[x,y,x+w,y+h];
          placed.push({box,placement:{...item.placement,
            xMm:item.placement.xMm+x-item.box[0],
            yMm:item.placement.yMm+y-item.box[1],
            sheetIndex}});
          rowX+=w+gap;
          rowHeight=Math.max(rowHeight,h);
        }
        if(failed||placed.length!==original.length)continue;
        const metric=footprint(placed);
        if(metric<winnerMetric-0.01){winner=placed;winnerMetric=metric;}
      }
    }
    if(winner!==original){adjusted[sheetIndex]=winner;changed=true;}
  }
  if(!changed)return result;
  const placementsByKey=new Map<string,Placement>();
  for(const sheet of adjusted)for(const item of sheet)
    placementsByKey.set(JSON.stringify([item.placement.partId,item.placement.copyIndex]),item.placement);
  if(placementsByKey.size!==result.placements.length)return result;
  return {...result,placements:result.placements.map(p=>
    placementsByKey.get(JSON.stringify([p.partId,p.copyIndex]))??p),
    validation:{status:'pending',overlapAreaMm2:null,maxBoundaryViolationMm:null,
      minClearanceMm:null,errors:[]}};
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
  // Earlier-plate first-fit alone is not enough: compact *every* physical
  // plate, including the last. Full collision validation occurs before use.
  return compactIndividualPlates(doc,best,rings);
}
