import polygonClipping from 'polygon-clipping';
import type {Document, Part, Placement, Point, Result, Ring} from '../model';
import {bounds} from './normalize';
import {collisionRing,pointSegmentDistance,transform,validate} from './validate';

// Conservative refinement for PLATES. Sparrow itself, angles and DXF curves
// are unchanged; accepting an improvement requires full local validation.
const MAX_COPIES=110,MAX_VERTICES=9000,MAX_PER_RING=700;
const MAX_CHECKS=16000,MAX_MS=1500,EPS=0.000001;
type Box=[number,number,number,number];
type Item={placement:Placement;ring:Ring;box:Box;sheet:number};
const offsetBox=(b:Box,dx:number,dy:number):Box=>[b[0]+dx,b[1]+dy,b[2]+dx,b[3]+dy];
const offsetRing=(ring:Ring,dx:number,dy:number):Ring=>ring.map(([x,y])=>[x+dx,y+dy]);
const boxDistance=(a:Box,b:Box)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));
const ringArea=(ring:Ring)=>ring.reduce((n,p,i)=>{
  const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1];
},0)/2;
const overlaps=(a:Ring,b:Ring)=>polygonClipping.intersection([a],[b])
  .reduce((n,p)=>n+Math.abs(ringArea(p[0] as Ring))
    -p.slice(1).reduce((v,h)=>v+Math.abs(ringArea(h as Ring)),0),0)>0.000001;
function edgeDistance(a:Ring,b:Ring,needed:number){
  let min=Infinity;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
    min=Math.min(min,pointSegmentDistance(p,r,s),pointSegmentDistance(q,r,s),
      pointSegmentDistance(r,p,q),pointSegmentDistance(s,p,q));
    if(min<needed-EPS)return min;
  }
  return min;
}
function permittedAngles(part:Part,placement:Placement):number[] {
  if(placement.fixedAngleDeg!==undefined)return [placement.angleDeg];
  const source=part.rotations.kind==='continuous'
    ? [placement.angleDeg,0,90,180,270,45,135,225,315]
    : [placement.angleDeg,...part.rotations.degrees];
  // Keep original orientation first; equivalent 360-degree angles are redundant.
  const normalized=new Set<number>();
  return source.filter(angle=>{
    if(!Number.isFinite(angle))return false;
    const key=Math.round((((angle%360)+360)%360)*1e5);
    if(normalized.has(key))return false;
    normalized.add(key);return true;
  });
}
function positions(items:Item[],sheet:number,span:number,limit:number,axis:0|1,gap:number){
  const out=new Set<number>();
  const add=(value:number)=>{
    if(Number.isFinite(value)&&value>=-EPS&&value<=limit-span+EPS)
      out.add(Math.max(0,Math.min(limit-span,value)));
  };
  add(0);add(limit-span);
  // Try interiors of visually open regions, not only outline contacts.
  for(const ratio of [0.25,0.5,0.75])add((limit-span)*ratio);
  for(const item of items)if(item.sheet===sheet){
    const lo=item.box[axis],hi=item.box[axis+2];
    for(const v of [lo,hi-span,lo-span-gap,hi+gap])add(v);
    // CAD contours may have irregular cavities, so include vertex-aligned
    // candidates in addition to rectangular box edges.
    if(item.ring.length<=100)for(const point of item.ring) {
      add(point[axis]);add(point[axis]-span);
    }
  }
  return [...out].slice(0,150);
}
type Score={sheets:number;lastLoad:number;yFrontier:number;xFrontier:number};
function score(items:Item[],length:number,width:number,top:boolean):Score {
  const used=[...new Set(items.map(i=>i.sheet))].sort((a,b)=>a-b);
  const last=used.at(-1)??0;
  const lastLoad=items.filter(i=>i.sheet===last).length;
  let yFrontier=0,xFrontier=0;
  for(const sheet of used){
    const group=items.filter(item=>item.sheet===sheet);
    yFrontier+=top?length-Math.min(...group.map(item=>item.box[1]))
      :Math.max(...group.map(item=>item.box[3]));
    xFrontier+=width-Math.min(...group.map(item=>item.box[0]));
  }
  return {sheets:used.length,lastLoad,yFrontier,xFrontier};
}
function better(a:Score,b:Score){
  if(a.sheets!==b.sheets)return a.sheets<b.sheets;
  if(a.sheets>1&&a.lastLoad!==b.lastLoad)return a.lastLoad<b.lastLoad;
  if(Math.abs(a.yFrontier-b.yFrontier)>0.01)return a.yFrontier<b.yFrontier;
  return a.xFrontier<b.xFrontier-0.01;
}
export function fillSheetGaps(doc:Document,result:Result,ms=MAX_MS):Result {
  if(doc.settings.materialType!=='sheet'||result.validation.status!=='passed')return result;
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm??0;
  const gap=doc.settings.clearanceMm,top=doc.settings.startCorner==='right-top';
  if(length<=0||result.placements.length<2||result.placements.length>MAX_COPIES)return result;
  const parts=new Map<string,Part>(doc.parts.map(p=>[p.id,p]));
  const rings=new Map([...parts].map(([id,p])=>[id,collisionRing(p)]));
  if([...rings.values()].some(r=>r.length>MAX_PER_RING)
    ||result.placements.reduce((n,p)=>n+(rings.get(p.partId)?.length??0),0)>MAX_VERTICES)return result;
  const items:Item[]=result.placements.map(placement=>{
    const ring=rings.get(placement.partId);
    if(!ring)throw Error('Unknown part in plate refinement.');
    const transformed=transform(ring,placement);
    return {placement:{...placement},ring:transformed,
      box:bounds(transformed) as Box,sheet:placement.sheetIndex??0};
  });
  const oldScore=score(items,length,width,top);
  const start=performance.now();
  let checks=0,moves=0;
  // The most sparsely populated final sheet gets first opportunity to fill
  // an earlier sheet's gaps. Repeat a short bounded pass as spaces open.
  for(let pass=0;pass<2;pass++){
    const order=items.map((_,i)=>i).sort((a,b)=>items[b].sheet-items[a].sheet
      ||(top?items[a].box[1]-items[b].box[1]:items[b].box[3]-items[a].box[3]));
    for(const index of order){
      if(checks>MAX_CHECKS||performance.now()-start>ms)break;
      const item=items[index],from=item.sheet,old=item.box;
      const part=parts.get(item.placement.partId)!;
      let placed=false;
      for(let target=0;target<=from&&!placed;target++){
        for(const angle of permittedAngles(part,item.placement)){
          if(placed||checks>MAX_CHECKS||performance.now()-start>ms)break;
          const rotated=transform(rings.get(part.id)!,{...item.placement,
            xMm:0,yMm:0,angleDeg:angle});
          const local= bounds(rotated) as Box;
          const w=local[2]-local[0],h=local[3]-local[1];
          if(w>width+EPS||h>length+EPS)continue;
          const xs=positions(items,target,w,width,0,gap).sort((a,b)=>b-a);
          const ys=positions(items,target,h,length,1,gap)
            .sort((a,b)=>top?b-a:a-b);
          for(const y of ys){
            if(placed||checks>MAX_CHECKS||performance.now()-start>ms)break;
            for(const x of xs){
              if(++checks>MAX_CHECKS||performance.now()-start>ms)break;
              if(target===from){
                const oldDepth=top?length-old[3]:old[1];
                const newDepth=top?length-(y+h):y;
                // A move on the same sheet must favor the requested origin.
                if(newDepth>oldDepth+EPS
                  ||(Math.abs(newDepth-oldDepth)<EPS&&x<=old[0]+EPS))continue;
              }
              const tx=x-local[0],ty=y-local[1];
              const candidateBox:Box=[x,y,x+w,y+h];
              if(candidateBox[0]<-EPS||candidateBox[1]<-EPS
                ||candidateBox[2]>width+EPS||candidateBox[3]>length+EPS)continue;
              let candidateRing:Ring|undefined,valid=true;
              for(let j=0;j<items.length;j++)if(index!==j&&items[j].sheet===target){
                const other=items[j];
                if(boxDistance(candidateBox,other.box)>gap+EPS)continue;
                candidateRing??=offsetRing(rotated,tx,ty);
                if(overlaps(candidateRing,other.ring)
                  ||(gap>0&&edgeDistance(candidateRing,other.ring,gap)<gap-EPS)){
                  valid=false;break;
                }
              }
              if(!valid)continue;
              item.sheet=target;
              item.box=candidateBox;
              item.ring=candidateRing??offsetRing(rotated,tx,ty);
              item.placement={...item.placement,sheetIndex:target,
                xMm:tx,yMm:ty,angleDeg:angle};
              moves++;placed=true;break;
            }
          }
        }
      }
    }
  }
  if(!moves)return result;
  const newScore=score(items,length,width,top);
  if(!better(newScore,oldScore))return result;
  // Reindex physical plates after an emptied plate disappears.
  const occupied=[...new Set(items.map(i=>i.sheet))].sort((a,b)=>a-b);
  const sheetMap=new Map(occupied.map((value,index)=>[value,index]));
  const placements=items.map(item=>({...item.placement,sheetIndex:sheetMap.get(item.sheet)!}));
  const candidate:Result={...result,placements,sheetCount:occupied.length,
    usedLengthMm:occupied.length*length,
    validation:{status:'pending',overlapAreaMm2:null,maxBoundaryViolationMm:null,
      minClearanceMm:null,errors:[]}};
  const validation=validate(doc,candidate);
  return validation.status==='passed'?{...candidate,validation:{...validation,source:'local'}}:result;
}
