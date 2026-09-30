import type {Document,Part,Placement,Point,Result,Ring} from '../model';

type Box={x:number;y:number;w:number;h:number};
const rotatedBounds=(ring:Ring,angleDeg:number)=>{
  const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y] of ring){const rx=x*c-y*s,ry=x*s+y*c;x0=Math.min(x0,rx);y0=Math.min(y0,ry);x1=Math.max(x1,rx);y1=Math.max(y1,ry);}
  return [x0,y0,x1,y1] as const;
};
const fits=(candidate:Box,placed:Box[],length:number,width:number,gap:number)=>
  candidate.x>=0&&candidate.y>=0&&candidate.x+candidate.w<=length+1e-7&&candidate.y+candidate.h<=width+1e-7&&
  placed.every(p=>candidate.x+candidate.w+gap<=p.x||p.x+p.w+gap<=candidate.x||candidate.y+candidate.h+gap<=p.y||p.y+p.h+gap<=candidate.y);

export function packResultIntoSheets(doc:Document,result:Result):Result {
  if(doc.settings.materialType!=='sheet')return result;
  const length=doc.settings.materialLengthMm,width=doc.settings.materialWidthMm,gap=Math.max(0,doc.settings.clearanceMm);
  if(!length||!Number.isFinite(length)||length<=0)throw Error('Plaka uzunluğu pozitif bir değer olmalıdır.');
  const parts=new Map(doc.parts.map(p=>[p.id,p] as const));
  const items=result.placements.map((placement,index)=>{
    const part=parts.get(placement.partId);if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    const b=rotatedBounds(part.outer,placement.angleDeg);
    return {placement,index,part,b,w:b[2]-b[0],h:b[3]-b[1]};
  }).sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h);
  const sheets:{boxes:Box[]}[]=[];const packed=new Array<Placement>(items.length);
  for(const item of items){
    if(item.w>length+1e-7||item.h>width+1e-7)throw Error(`${item.part.name} seçilen plaka ölçüsüne sığmıyor.`);
    let chosen:{sheet:number;x:number;y:number}|undefined;
    for(let sheet=0;sheet<=sheets.length&&!chosen;sheet++){
      const boxes=sheet<sheets.length?sheets[sheet].boxes:[];
      const xs=[0,...boxes.map(b=>b.x+b.w+gap)].filter(x=>x+item.w<=length+1e-7);
      const ys=[0,...boxes.map(b=>b.y+b.h+gap)].filter(y=>y+item.h<=width+1e-7);
      let best:{x:number;y:number;score:number}|undefined;
      for(const y of ys)for(const x of xs){const box={x,y,w:item.w,h:item.h};if(!fits(box,boxes,length,width,gap))continue;const score=y*length+x;if(!best||score<best.score)best={x,y,score};}
      if(best)chosen={sheet,x:best.x,y:best.y};
    }
    if(!chosen)throw Error('Plaka yerleşimi oluşturulamadı.');
    if(chosen.sheet===sheets.length)sheets.push({boxes:[]});
    sheets[chosen.sheet].boxes.push({x:chosen.x,y:chosen.y,w:item.w,h:item.h});
    packed[item.index]={...item.placement,sheetIndex:chosen.sheet,xMm:chosen.x-item.b[0],yMm:chosen.y-item.b[1]};
  }
  return {...result,sheetCount:sheets.length,usedLengthMm:length*sheets.length,placements:packed};
}
