import type {Document,Part,Placement,Result,Ring} from '../model';
import {collisionRing} from './validate';

type IntervalItem={placement:Placement;index:number;part:Part;minY:number;maxY:number};
type Band={items:IntervalItem[];minY:number;maxY:number};
type Sheet={used:number};

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
  const width=doc.settings.materialWidthMm,inset=Math.max(0,doc.settings.clearanceMm);
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
    const dy=(doc.settings.startCorner??'right-bottom')==='right-top'?inset-minY:boundaryLength-inset-maxY;
    for(const index of indices){placements[index].xMm+=dx;placements[index].yMm+=dy;}
  }
  return {...result,placements};
}

export function packResultIntoSheets(doc:Document,result:Result):Result {
  if(doc.settings.materialType!=='sheet')return orientToStartCorner(doc,result);
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm,gap=Math.max(0,doc.settings.clearanceMm);
  if(!length||!Number.isFinite(length)||length<=0)throw Error('Plaka uzunluğu pozitif bir değer olmalıdır.');
  if(length<=2*gap)throw Error('Plaka uzunluğu kenar boşluğu için yetersiz.');

  const parts=new Map(doc.parts.map(p=>[p.id,p] as const));
  const items:IntervalItem[]=result.placements.map((placement,index)=>{
    const part=parts.get(placement.partId);if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    const b=rotatedBounds(collisionRing(part),placement.angleDeg);
    const minX=placement.xMm+b[0],maxX=placement.xMm+b[2],minY=placement.yMm+b[1],maxY=placement.yMm+b[3];
    if(minX<-1e-7||maxX>width+1e-7)throw Error(`${part.name} malzeme genişliğinin dışına taşıyor.`);
    if(maxY-minY>length-2*gap+1e-7)throw Error(`${part.name} seçilen plaka uzunluğuna ve kenar boşluğuna sığmıyor.`);
    return {placement,index,part,minY,maxY};
  }).sort((a,b)=>a.minY-b.minY||a.maxY-b.maxY);

  const bands:Band[]=[];
  for(const item of items){
    const last=bands.at(-1);
    if(last&&item.minY<=last.maxY+gap+1e-7){
      last.items.push(item);last.maxY=Math.max(last.maxY,item.maxY);last.minY=Math.min(last.minY,item.minY);
    }else bands.push({items:[item],minY:item.minY,maxY:item.maxY});
  }

  const ordered=bands.map((band,index)=>({band,index,height:band.maxY-band.minY}))
    .sort((a,b)=>b.height-a.height||a.index-b.index);
  const packed=new Array<Placement>(result.placements.length),sheets:Sheet[]=[];
  for(const {band,height} of ordered){
    if(height>length-2*gap+1e-7)throw Error('Bir yerleşim bandı seçilen plaka uzunluğuna sığmıyor.');
    let best=-1,bestRemaining=Infinity;
    for(let i=0;i<sheets.length;i++){
      const start=sheets[i].used+(sheets[i].used>gap?gap:0);
      const remaining=length-gap-(start+height);
      if(remaining>=-1e-7&&remaining<bestRemaining){best=i;bestRemaining=remaining;}
    }
    if(best<0){best=sheets.length;sheets.push({used:gap});}
    const start=sheets[best].used+(sheets[best].used>gap?gap:0),offset=start-band.minY;
    for(const item of band.items)packed[item.index]={...item.placement,sheetIndex:best,yMm:item.placement.yMm+offset};
    sheets[best].used=start+height;
  }

  const sheetCount=Math.max(1,sheets.length);
  return orientToStartCorner(doc,{...result,sheetCount,usedLengthMm:length*sheetCount,placements:packed});
}
