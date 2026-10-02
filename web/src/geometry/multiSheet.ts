import type {Document,Part,Placement,Result,Ring} from '../model';
import {collisionRing} from './validate';

type IntervalItem={placement:Placement;index:number;part:Part;minY:number;maxY:number};
type SheetChunk={items:IntervalItem[];minY:number;maxY:number};

const rotatedBounds=(ring:Ring,angleDeg:number)=>{
  const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y] of ring){
    const rx=x*c-y*s,ry=x*s+y*c;
    x0=Math.min(x0,rx);y0=Math.min(y0,ry);x1=Math.max(x1,rx);y1=Math.max(y1,ry);
  }
  return [x0,y0,x1,y1] as const;
};

function orientToStartCorner(doc:Document,result:Result):Result {
  if(!result.placements.length)return result;
  const width=doc.settings.materialWidthMm,inset=0;
  const parts=new Map(doc.parts.map(part=>[part.id,part] as const));
  const groups=new Map<number,number[]>();
  result.placements.forEach((placement,index)=>{
    const sheet=doc.settings.materialType==='sheet'?(placement.sheetIndex??0):0;
    groups.set(sheet,[...(groups.get(sheet)??[]),index]);
  });
  const placements=result.placements.map(placement=>({...placement}));
  for(const indices of groups.values()){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const index of indices){
      const placement=placements[index],part=parts.get(placement.partId);
      if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
      const b=rotatedBounds(collisionRing(part),placement.angleDeg);
      minX=Math.min(minX,placement.xMm+b[0]);maxX=Math.max(maxX,placement.xMm+b[2]);
      minY=Math.min(minY,placement.yMm+b[1]);maxY=Math.max(maxY,placement.yMm+b[3]);
    }
    const boundaryLength=doc.settings.materialType==='sheet'?doc.settings.materialLengthMm:result.usedLengthMm;
    if(!boundaryLength)throw Error('Yerleşim uzunluğu bulunamadı.');
    const dx=width-inset-maxX;
    // Workspace renders manufacturing +Y upward with an SVG Y flip:
    // y=0 is the visual bottom edge, y=boundaryLength is the visual top edge.
    const dy=(doc.settings.startCorner??'right-bottom')==='right-bottom'?inset-minY:boundaryLength-inset-maxY;
    for(const index of indices){placements[index].xMm+=dx;placements[index].yMm+=dy;}
  }
  return {...result,placements};
}


export function packResultIntoSheets(doc:Document,result:Result):Result {
  if(doc.settings.materialType!=='sheet')return orientToStartCorner(doc,result);
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm,gap=Math.max(0,doc.settings.clearanceMm);
  if(!length||!Number.isFinite(length)||length<=0)throw Error('Plaka uzunluğu pozitif bir değer olmalıdır.');
  if(result.placements.length&&result.placements.every(placement=>placement.sheetIndex!==undefined)){
    const sheetCount=Math.max(...result.placements.map(placement=>placement.sheetIndex??0))+1;
    return orientToStartCorner(doc,{...result,sheetCount,usedLengthMm:length*sheetCount});
  }

  const parts=new Map(doc.parts.map(p=>[p.id,p] as const));
  const items:IntervalItem[]=result.placements.map((placement,index)=>{
    const part=parts.get(placement.partId);if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    const b=rotatedBounds(collisionRing(part),placement.angleDeg);
    const minX=placement.xMm+b[0],maxX=placement.xMm+b[2],minY=placement.yMm+b[1],maxY=placement.yMm+b[3];
    if(minX<-1e-7||maxX>width+1e-7)throw Error(`${part.name} malzeme genişliğinin dışına taşıyor.`);
    if(maxY-minY>length+1e-7)throw Error(`${part.name} seçilen plaka uzunluğuna sığmıyor.`);
    return {placement,index,part,minY,maxY};
  }).sort((a,b)=>a.minY-b.minY||a.maxY-b.maxY);

  // Keep Sparrow/Jagua as the only nesting engine. For plate mode we only
  // paginate its continuous strip into contiguous Y chunks whose original span
  // fits one plate. Relative X/Y positions inside each chunk stay rigid, so no
  // new collisions are introduced. A chunk may split an overlapping Y "band"
  // across two physical plates; that is safe because different sheetIndex values
  // are separate materials and never collide with each other.
  const chunks:SheetChunk[]=[];
  for(const item of items){
    const current=chunks.at(-1);
    if(!current){chunks.push({items:[item],minY:item.minY,maxY:item.maxY});continue;}
    const nextMax=Math.max(current.maxY,item.maxY);
    if(nextMax-current.minY<=length+1e-7){
      current.items.push(item);current.maxY=nextMax;
    }else chunks.push({items:[item],minY:item.minY,maxY:item.maxY});
  }

  const packed=new Array<Placement>(result.placements.length);
  chunks.forEach((chunk,sheetIndex)=>{
    const offset=-chunk.minY;
    for(const item of chunk.items)packed[item.index]={...item.placement,sheetIndex,yMm:item.placement.yMm+offset};
  });

  const sheetCount=Math.max(1,chunks.length);
  return orientToStartCorner(doc,{...result,sheetCount,usedLengthMm:length*sheetCount,placements:packed});
}
