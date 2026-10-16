import polygonClipping from 'polygon-clipping';
import type {Document,Placement,Point,Result,Ring} from '../model';
import {bounds} from './normalize';
import {collisionRing,pointSegmentDistance,transform,validate} from './validate';

// Only local post-processing: leave Sparrow, DXF geometry and rotations unchanged.
// On complex jobs the original valid solver result is returned untouched.
const MAX_ITEMS=140,MAX_VERTICES=12000,MAX_PART_VERTICES=700;
const MAX_CANDIDATES=12000,MAX_RUNTIME_MS=1200;
const EPS=1e-5;
type Box=[number,number,number,number];
type Item={placement:Placement;ring:Ring;box:Box};
const within=(v:number,min:number,max:number)=>v>=min-EPS&&v<=max+EPS;
const shifted=(ring:Ring,dx:number,dy:number):Ring=>ring.map(([x,y])=>[x+dx,y+dy]);
const shiftBox=(box:Box,dx:number,dy:number):Box=>[box[0]+dx,box[1]+dy,box[2]+dx,box[3]+dy];
const boxGap=(a:Box,b:Box)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));
const cross=(a:Point,b:Point,c:Point,d:Point)=>{
  const ax=b[0]-a[0],ay=b[1]-a[1],bx=d[0]-c[0],by=d[1]-c[1];
  const den=ax*by-ay*bx;
  if(Math.abs(den)<1e-12)return false;
  const cx=c[0]-a[0],cy=c[1]-a[1],s=(cx*by-cy*bx)/den,t=(cx*ay-cy*ax)/den;
  return s>=0&&s<=1&&t>=0&&t<=1;
};
const clearanceDistance=(a:Ring,b:Ring,limit:number)=>{
  let best=Infinity;
  for(let i=0;i<a.length;i++){
    const p=a[i],q=a[(i+1)%a.length];
    for(let j=0;j<b.length;j++){
      const r=b[j],s=b[(j+1)%b.length];
      if(cross(p,q,r,s))return 0;
      best=Math.min(best,pointSegmentDistance(p,r,s),pointSegmentDistance(q,r,s),
        pointSegmentDistance(r,p,q),pointSegmentDistance(s,p,q));
      if(best+0.01<limit)return best;
    }
  }
  return best;
};
const collisionArea=(a:Ring,b:Ring)=>{
  const hits=polygonClipping.intersection([a],[b]);
  return hits.reduce((total,poly)=>total+Math.abs(signedArea(poly[0] as Ring))
    -poly.slice(1).reduce((n,h)=>n+Math.abs(signedArea(h as Ring)),0),0);
};
const signedArea=(ring:Ring)=>ring.reduce((n,p,i)=>{
  const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1];
},0)*0.5;
const candidateCoordinates=(items:Item[],index:number,axis:0|1,span:number,limit:number,gap:number)=>{
  const points=new Set<number>([0,limit-span]);
  const add=(number:number)=>{if(Number.isFinite(number)&&within(number,0,limit-span))points.add(Math.max(0,Math.min(limit-span,number)));};
  add(items[index].box[axis]);
  for(let i=0;i<items.length;i++)if(i!==index){
    const box=items[i].box,low=box[axis],high=box[axis+2];
    for(const value of [low-span-gap,high+gap,low,high-span,low-span*.5,high-span*.5])add(value);
  }
  // Include positions within large rectangular voids, not just bounding edges.
  const step=Math.max(2,span*.45);
  for(let pos=0;pos<limit-span;pos+=step)add(pos);
  return [...points].sort(axis===1?(a,b)=>a-b:(a,b)=>b-a).slice(0,130);
};

/**
 * Try moving tail parts into earlier gaps, without changing their orientation.
 * An improvement is returned only after complete local collision/clearance
 * validation; otherwise the original solver result is preserved.
 */
export function compactRollGaps(doc:Document,result:Result,ms=MAX_RUNTIME_MS):Result {
  if(doc.settings.materialType==='sheet'||result.validation.status!=='passed')return result;
  const copies=doc.parts.reduce((n,p)=>n+p.quantity,0);
  if(copies<2||copies>MAX_ITEMS||result.placements.length!==copies)return result;
  const parts=new Map(doc.parts.map(part=>[part.id,part]));
  const totalVertices=doc.parts.reduce((n,part)=>n+part.quantity*collisionRing(part).length,0);
  if(totalVertices>MAX_VERTICES||doc.parts.some(part=>collisionRing(part).length>MAX_PART_VERTICES))return result;
  const width=doc.settings.materialWidthMm,gap=doc.settings.clearanceMm;
  const items:Item[]=result.placements.map(placement=>{
    const part=parts.get(placement.partId);
    if(!part)throw Error('Unknown part in compaction.');
    const ring=transform(collisionRing(part),placement);
    return {placement:{...placement},ring,box:bounds(ring) as Box};
  });
  if(items.some(item=>!item.box.every(Number.isFinite)))return result;
  const started=performance.now();
  let checks=0,moves=0;
  const order=items.map((_,i)=>i).sort((a,b)=>items[b].box[3]-items[a].box[3]);
  for(const index of order.slice(0,Math.min(order.length,16))){
    if(checks>=MAX_CANDIDATES||performance.now()-started>ms)break;
    const item=items[index],old=item.box,spanX=old[2]-old[0],spanY=old[3]-old[1];
    const otherMax=Math.max(0,...items.filter((_,i)=>i!==index).map(item=>item.box[3]));
    const maxY=Math.min(old[1]-0.01,Math.max(0,otherMax-spanY));
    if(maxY<0||spanX>width+EPS)continue;
    const xs=candidateCoordinates(items,index,0,spanX,width,gap);
    const ys=candidateCoordinates(items,index,1,spanY,Math.max(spanY,old[1]),gap)
      .filter(y=>y<=old[1]-0.01);
    let placed=false;
    for(const y of ys){
      if(placed||performance.now()-started>ms)break;
      if(y>maxY+spanY)continue;
      for(const x of xs){
        if(++checks>MAX_CANDIDATES||performance.now()-started>ms)break;
        const dx=x-old[0],dy=y-old[1],nextBox=shiftBox(old,dx,dy);
        if(!within(nextBox[0],0,width)||!within(nextBox[2],0,width)||nextBox[1]<-EPS)continue;
        let nextRing:Ring|undefined,valid=true;
        for(let j=0;j<items.length;j++)if(j!==index){
          const other=items[j],b=other.box;
          if(boxGap(nextBox,b)>gap+EPS)continue;
          // Perform the exact geometry check even when bounding boxes overlap:
          // irregular shoe patterns can fit inside each other's concavities.
          nextRing??=shifted(item.ring,dx,dy);
          if(collisionArea(nextRing,other.ring)>1e-8){valid=false;break;}
          if(gap>0&&clearanceDistance(nextRing,other.ring,gap)+0.005<gap){valid=false;break;}
        }
        if(valid){
          item.ring=nextRing??shifted(item.ring,dx,dy);item.box=nextBox;
          item.placement={...item.placement,xMm:item.placement.xMm+dx,yMm:item.placement.yMm+dy};
          placed=true;moves++;break;
        }
      }
    }
  }
  if(!moves)return result;
  const allMinY=Math.min(...items.map(item=>item.box[1]));
  const allMaxY=Math.max(...items.map(item=>item.box[3]));
  const nextLength=allMaxY-allMinY;
  // Do not accept same-length reshuffles, or a result outside the original strip.
  if(!Number.isFinite(nextLength)||nextLength>=result.usedLengthMm-0.01||nextLength<=0)return result;
  const candidate:Result={...result,usedLengthMm:nextLength,
    placements:items.map(item=>({...item.placement,yMm:item.placement.yMm-allMinY})),
    validation:{status:'pending',overlapAreaMm2:null,maxBoundaryViolationMm:null,minClearanceMm:null,errors:[]}};
  const checked=validate(doc,candidate);
  return checked.status==='passed'?{...candidate,validation:{...checked,source:'local'}}:result;
}
