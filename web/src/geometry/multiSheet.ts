import type {Document,Part,Placement,Point,Result,Ring} from '../model';

type IntervalItem={placement:Placement;index:number;part:Part;minY:number;maxY:number};
type Band={items:IntervalItem[];minY:number;maxY:number};

const rotatedBounds=(ring:Ring,angleDeg:number)=>{
  const a=angleDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const [x,y] of ring){
    const rx=x*c-y*s,ry=x*s+y*c;
    x0=Math.min(x0,rx);y0=Math.min(y0,ry);x1=Math.max(x1,rx);y1=Math.max(y1,ry);
  }
  return [x0,y0,x1,y1] as const;
};

export function packResultIntoSheets(doc:Document,result:Result):Result {
  if(doc.settings.materialType!=='sheet')return result;
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm,gap=Math.max(0,doc.settings.clearanceMm);
  if(!length||!Number.isFinite(length)||length<=0)throw Error('Plaka uzunluğu pozitif bir değer olmalıdır.');

  const parts=new Map(doc.parts.map(p=>[p.id,p] as const));
  const items:IntervalItem[]=result.placements.map((placement,index)=>{
    const part=parts.get(placement.partId);if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    const b=rotatedBounds(part.outer,placement.angleDeg);
    const minX=placement.xMm+b[0],maxX=placement.xMm+b[2],minY=placement.yMm+b[1],maxY=placement.yMm+b[3];
    if(minX<-1e-7||maxX>width+1e-7)throw Error(`${part.name} malzeme genişliğinin dışına taşıyor.`);
    if(maxY-minY>length+1e-7)throw Error(`${part.name} seçilen plaka uzunluğuna sığmıyor.`);
    return {placement,index,part,minY,maxY};
  }).sort((a,b)=>a.minY-b.minY||a.maxY-b.maxY);

  // Preserve the irregular nesting produced by Sparrow. Consecutive parts that
  // overlap in the material-length direction form one rigid band; moving a full
  // band keeps all interlocking relationships intact instead of repacking parts
  // as bounding-box rectangles.
  const bands:Band[]=[];
  for(const item of items){
    const last=bands.at(-1);
    if(last&&item.minY<=last.maxY+gap+1e-7){
      last.items.push(item);last.maxY=Math.max(last.maxY,item.maxY);last.minY=Math.min(last.minY,item.minY);
    }else bands.push({items:[item],minY:item.minY,maxY:item.maxY});
  }

  const packed=new Array<Placement>(result.placements.length);
  let sheet=0,cursor=0;
  for(const band of bands){
    const height=band.maxY-band.minY;
    if(height>length+1e-7)throw Error('Bir yerleşim bandı seçilen plaka uzunluğuna sığmıyor.');
    if(cursor>0&&cursor+height>length+1e-7){sheet++;cursor=0;}
    const offset=cursor-band.minY;
    for(const item of band.items)packed[item.index]={...item.placement,sheetIndex:sheet,yMm:item.placement.yMm+offset};
    cursor+=height+gap;
  }

  const sheetCount=packed.length?sheet+1:1;
  return {...result,sheetCount,usedLengthMm:length*sheetCount,placements:packed};
}
