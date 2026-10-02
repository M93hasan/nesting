import polygonClipping from 'polygon-clipping';
import type {Document,Part,Placement,Point,Result,Ring} from '../model';
import {area,bounds,intersects} from './normalize';
import {collisionRing,pointSegmentDistance,transform,validate} from './validate';

const LINEAR_TOL=0.01,OVERLAP_TOL=0.05,MAX_ANCHORS=80;

type Box=[number,number,number,number];
type PackedGeom={placement:Placement;ring:Ring;box:Box};
type Item={placement:Placement;part:Part;priority:number;boxArea:number;maxDim:number};

const rotatedBounds=(ring:Ring,angleDeg:number):Box=>{
  const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y] of ring){
    const rx=x*c-y*s,ry=x*s+y*c;
    x0=Math.min(x0,rx);y0=Math.min(y0,ry);x1=Math.max(x1,rx);y1=Math.max(y1,ry);
  }
  return [x0,y0,x1,y1];
};

const boxDistance=(a:Box,b:Box)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));

function ringDistance(a:Ring,b:Ring):number{
  let min=Infinity;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
    if(intersects(p,q,r,s))return 0;
    min=Math.min(min,pointSegmentDistance(p,r,s),pointSegmentDistance(q,r,s),pointSegmentDistance(r,p,q),pointSegmentDistance(s,p,q));
  }
  return min;
}

function overlapArea(a:Ring,b:Ring):number{
  const clipped=polygonClipping.intersection([a],[b]);
  return clipped.reduce((total,poly)=>total+Math.abs(area(poly[0]))-poly.slice(1).reduce((n,h)=>n+Math.abs(area(h)),0),0);
}

function uniqueAngles(part:Part,current:number):number[]{
  const normalize=(angle:number)=>((angle%360)+360)%360;
  const source=part.rotations.kind==='discrete'
    ? [current,...part.rotations.degrees]
    : [current,0,90,180,270];
  const result:number[]=[];
  for(const angle of source){
    const n=normalize(angle);
    if(!result.some(existing=>Math.abs(((existing-n)%360+540)%360-180)<1e-7))result.push(n);
  }
  return result;
}

function anchorValues(values:number[],limit:number):number[]{
  const unique=[...new Set(values.filter(value=>Number.isFinite(value)&&value>=-LINEAR_TOL&&value<=limit+LINEAR_TOL)
    .map(value=>Math.max(0,Math.min(limit,value))).map(value=>Math.round(value*10000)/10000))].sort((a,b)=>a-b);
  if(unique.length<=MAX_ANCHORS)return unique;
  // BLF prefers low coordinates, but retain the far boundary as a useful exact-fit anchor.
  return [...unique.slice(0,MAX_ANCHORS-1),unique.at(-1)!];
}

function anchors(placed:PackedGeom[],candidateBox:Box,width:number,length:number,gap:number):Point[]{
  const w=candidateBox[2]-candidateBox[0],h=candidateBox[3]-candidateBox[1];
  if(w>width+LINEAR_TOL||h>length+LINEAR_TOL)return [];
  const xs=[0,width-w],ys=[0,length-h];
  for(const existing of placed){
    const b=existing.box;
    xs.push(b[0],b[2]+gap,b[0]-w-gap,b[2]-w);
    ys.push(b[1],b[3]+gap,b[1]-h-gap,b[3]-h);
  }
  const xx=anchorValues(xs,Math.max(0,width-w)),yy=anchorValues(ys,Math.max(0,length-h));
  const points:Point[]=[];
  for(const y of yy)for(const x of xx)points.push([x,y]);
  return points;
}

function fits(doc:Document,part:Part,placement:Placement,placed:PackedGeom[]):PackedGeom|undefined{
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm!,gap=Math.max(0,doc.settings.clearanceMm);
  const ring=transform(collisionRing(part),placement),box=bounds(ring) as Box;
  if(box[0]<-LINEAR_TOL||box[1]<-LINEAR_TOL||box[2]>width+LINEAR_TOL||box[3]>length+LINEAR_TOL)return;
  for(const other of placed){
    const distance=boxDistance(box,other.box);
    if(distance===0&&overlapArea(ring,other.ring)>OVERLAP_TOL)return;
    if(gap>0&&distance+LINEAR_TOL<gap&&ringDistance(ring,other.ring)+LINEAR_TOL<gap)return;
  }
  return {placement,ring,box};
}

function placeOnSheet(doc:Document,item:Item,sheetIndex:number,placed:PackedGeom[]):PackedGeom|undefined{
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm!;
  for(const angle of uniqueAngles(item.part,item.placement.angleDeg)){
    const local=rotatedBounds(collisionRing(item.part),angle);
    const w=local[2]-local[0],h=local[3]-local[1];
    if(w>width+LINEAR_TOL||h>length+LINEAR_TOL)continue;
    for(const [x,y] of anchors(placed,local,width,length,Math.max(0,doc.settings.clearanceMm))){
      const candidate:Placement={partId:item.placement.partId,copyIndex:item.placement.copyIndex,
        angleDeg:angle,xMm:x-local[0],yMm:y-local[1],sheetIndex};
      const accepted=fits(doc,item.part,candidate,placed);
      if(accepted)return accepted;
    }
  }
}

function buildItems(doc:Document,result:Result):Item[]{
  const parts=new Map(doc.parts.map(part=>[part.id,part] as const));
  return result.placements.map(placement=>{
    const part=parts.get(placement.partId);
    if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    const b=rotatedBounds(collisionRing(part),placement.angleDeg),w=b[2]-b[0],h=b[3]-b[1];
    const ring=collisionRing(part);
    const boxArea=w*h,diameter=Math.hypot(w,h);
    return {placement,part,priority:Math.abs(area(ring))*diameter,boxArea,maxDim:Math.max(w,h)};
  });
}

type OrderKind='sparrow'|'bbox'|'maxdim';

function packOrder(doc:Document,items:Item[],orderKind:OrderKind):Result|undefined{
  const order=[...items].sort((a,b)=>{
    if(orderKind==='bbox')return b.boxArea-a.boxArea||b.priority-a.priority;
    if(orderKind==='maxdim')return b.maxDim-a.maxDim||b.boxArea-a.boxArea;
    return b.priority-a.priority||b.boxArea-a.boxArea;
  });
  const sheets:PackedGeom[][]=[],placements:Placement[]=[];
  for(const item of order){
    let accepted:PackedGeom|undefined,target=-1;
    for(let sheetIndex=0;sheetIndex<sheets.length&&!accepted;sheetIndex++){
      accepted=placeOnSheet(doc,item,sheetIndex,sheets[sheetIndex]);
      if(accepted)target=sheetIndex;
    }
    if(!accepted){
      target=sheets.length;
      const sheet:PackedGeom[]=[];
      accepted=placeOnSheet(doc,item,target,sheet);
      if(!accepted)return;
      sheets.push(sheet);
    }
    sheets[target].push(accepted);
    placements.push(accepted.placement);
  }
  const sheetCount=Math.max(1,sheets.length),length=doc.settings.materialLengthMm!;
  const candidate:Result={...docResultShell(doc),placements,sheetCount,usedLengthMm:length*sheetCount};
  const checked=validate(doc,candidate);
  if(checked.status!=='passed')return;
  return {...candidate,validation:{...checked,source:'local'}};
}

function docResultShell(doc:Document):Result{
  return {documentRevision:0,solverRevision:'sheet-blf',seed:'sheet-blf',elapsedSeconds:0,usedLengthMm:doc.settings.materialLengthMm??0,
    placements:[],validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
}

function spanScore(doc:Document,result:Result):[number,number,number]{
  const parts=new Map(doc.parts.map(part=>[part.id,part] as const));
  const count=result.sheetCount??1,spans=Array.from({length:count},()=>({min:Infinity,max:-Infinity}));
  for(const placement of result.placements){
    const part=parts.get(placement.partId);if(!part)continue;
    const b=bounds(transform(collisionRing(part),placement)) as Box,sheet=placement.sheetIndex??0;
    spans[sheet].min=Math.min(spans[sheet].min,b[1]);spans[sheet].max=Math.max(spans[sheet].max,b[3]);
  }
  const values=spans.map(s=>Number.isFinite(s.min)?s.max-s.min:0);
  return [count,values.at(-1)??0,values.reduce((a,b)=>a+b,0)];
}

const better=(a:[number,number,number],b:[number,number,number])=>a[0]<b[0]||(a[0]===b[0]&&(a[1]<b[1]-LINEAR_TOL||(Math.abs(a[1]-b[1])<=LINEAR_TOL&&a[2]<b[2]-LINEAR_TOL)));

export function improveSheetPacking(doc:Document,result:Result):Result{
  if(doc.settings.materialType!=='sheet'||!doc.settings.materialLengthMm||!result.placements.length)return result;
  const items=buildItems(doc,result);
  let best=result,bestScore=spanScore(doc,result);
  for(const order of ['sparrow','bbox','maxdim'] as const){
    const candidate=packOrder(doc,items,order);
    if(!candidate)continue;
    const score=spanScore(doc,candidate);
    if(better(score,bestScore)){best=candidate;bestScore=score;}
  }
  return best;
}
