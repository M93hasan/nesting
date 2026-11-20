import type {Document,Placement,Result} from '../model';
import {bounds} from './normalize';
import {collisionRing,transform,validate} from './validate';

// A conservative post-processing pass: only translate parts. Never modify DXF
// geometry, the solver, rotations, copies or production toolpaths.
// Any proposed movement MUST pass the independent production validator.
const EPS=0.02;
const MAX_COPIES=40;
const VALIDATION_BUDGET_MS=250;

type Rect={left:number;right:number;bottom:number;top:number};
function rectangles(doc:Document,result:Result):Rect[]{
  const parts=new Map(doc.parts.map(p=>[p.id,p]));
  return result.placements.map(p=>{
    const part=parts.get(p.partId);
    if(!part)throw Error('Unknown part in layout.');
    const b=bounds(transform(collisionRing(part),p));
    return {left:b[0],bottom:b[1],right:b[2],top:b[3]};
  });
}
function spacing(a:Rect,b:Rect):number {
  const dx=Math.max(0,a.left-b.right,b.left-a.right);
  const dy=Math.max(0,a.bottom-b.top,b.bottom-a.top);
  return Math.hypot(dx,dy);
}
// Prefer tighter internal packing without allowing a longer material run.
function score(rects:Rect[]):number {
  if(rects.length<2)return 0;
  let sum=0;
  for(let i=0;i<rects.length;i++){
    let nearest=Infinity;
    for(let j=0;j<rects.length;j++)if(i!==j)nearest=Math.min(nearest,spacing(rects[i],rects[j]));
    sum+=nearest;
  }
  return sum;
}
function occupiedLength(rects:Rect[]):number {
  return rects.length?Math.max(...rects.map(b=>b.top))-Math.min(...rects.map(b=>b.bottom)):0;
}

/**
 * Try contour-validated rigid translations into existing gaps. Disabled for
 * fixed sheets and large projects to bound CPU cost in the validator worker.
 * The caller must supply an already validated result.
 */
export function compactValidatedGaps(doc:Document,original:Result):Result {
  if(doc.settings.materialType==='sheet'||original.placements.length<2||
     original.placements.length>MAX_COPIES||original.validation.status!=='passed')return original;
  const deadline=performance.now()+VALIDATION_BUDGET_MS;
  let best=original;
  let boxes=rectangles(doc,best);
  let bestScore=score(boxes),baselineLength=occupiedLength(boxes);
  const initialWidth=Math.max(...boxes.map(b=>b.right))-Math.min(...boxes.map(b=>b.left));
  const clearance=Math.max(0,doc.settings.clearanceMm);
  // Do not rotate, mirror, change order, or silently reduce the user gap.
  for(let pass=0;pass<1;pass++){
    let changed=false;
    for(let index=0;index<best.placements.length;index++){
      if(performance.now()>deadline)return best;
      const box=boxes[index];
      const dxs=new Set<number>(),dys=new Set<number>();
      // Anchor against actual material edges and nearby part envelopes.
      dxs.add(doc.settings.materialWidthMm-box.right);
      dys.add(-box.bottom);
      for(let j=0;j<boxes.length;j++){
        if(index===j)continue;
        dxs.add(boxes[j].left-clearance-box.right);
        dxs.add(boxes[j].right+clearance-box.left);
        dys.add(boxes[j].bottom-clearance-box.top);
        dys.add(boxes[j].top+clearance-box.bottom);
      }
      const moves:[number,number][]=[
        ...[...dxs].filter(d=>Math.abs(d)>EPS).sort((a,b)=>Math.abs(a)-Math.abs(b)).slice(0,8).map(d=>[d,0] as [number,number]),
        ...[...dys].filter(d=>Math.abs(d)>EPS).sort((a,b)=>Math.abs(a)-Math.abs(b)).slice(0,8).map(d=>[0,d] as [number,number])
      ];
      for(const [dx,dy] of moves){
        if(performance.now()>deadline)return best;
        const nextPlacement:Placement={...best.placements[index],xMm:best.placements[index].xMm+dx,yMm:best.placements[index].yMm+dy};
        const placements=best.placements.map((p,i)=>i===index?nextPlacement:p);
        const candidate:Result={...best,placements};
        const nextBoxes=rectangles(doc,candidate);
        if(occupiedLength(nextBoxes)>baselineLength+1e-6)continue;
        const width=Math.max(...nextBoxes.map(b=>b.right))-Math.min(...nextBoxes.map(b=>b.left));
        if(width>initialWidth+1e-6)continue;
        const nextScore=score(nextBoxes);
        if(nextScore>=bestScore-0.001)continue;
        const checked=validate(doc,candidate);
        if(checked.status!=='passed')continue;
        best={...candidate,validation:{...checked,source:'local'}};
        boxes=nextBoxes;bestScore=nextScore;changed=true;
        break;
      }
    }
    if(!changed)break;
  }
  return best;
}
