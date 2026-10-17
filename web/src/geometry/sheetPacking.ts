import polygonClipping from 'polygon-clipping';
import type {Document,Part,Placement,Result,Ring} from '../model';
import {area,bounds} from './normalize';
import {collisionRing,ringDistance,transform,validate} from './validate';
import {packResultIntoSheets} from './multiSheet';

type Box=[number,number,number,number];
type Shape={angle:number;ring:Ring;minX:number;minY:number;width:number;height:number};
type Item={index:number;placement:Placement;part:Part;ring:Ring;area:number;shapes:Shape[]};
type Placed={item:Item;placement:Placement;ring:Ring;box:Box};
type Budget={deadline:number;segments:number};
const EPS=1e-7;
const expired=(budget:Budget)=>performance.now()>=budget.deadline||budget.segments<=0;

function angles(item:Placement,part:Part):number[]{
  if(item.fixedAngleDeg!==undefined)return [item.fixedAngleDeg];
  const allowed=part.rotations.kind==='discrete'?part.rotations.degrees:
    [item.angleDeg,item.angleDeg+90,item.angleDeg+180,item.angleDeg+270,0,90,180,270];
  return [...new Set(allowed.map(angle=>((angle%360)+360)%360))];
}

function shape(ring:Ring,placement:Placement,angle:number):Shape{
  const rotated=transform(ring,{...placement,xMm:0,yMm:0,angleDeg:angle});
  const [minX,minY,maxX,maxY]=bounds(rotated);
  return {angle,minX,minY,width:maxX-minX,height:maxY-minY,
    ring:rotated.map(([x,y])=>[x-minX,y-minY])};
}

function position(item:Item,variant:Shape,x:number,y:number,sheetIndex:number):Placed{
  return {item,placement:{...item.placement,angleDeg:variant.angle,
    xMm:x-variant.minX,yMm:y-variant.minY,sheetIndex},
    ring:variant.ring.map(([px,py])=>[px+x,py+y]),box:[x,y,x+variant.width,y+variant.height]};
}

function fits(candidate:Placed,sheet:Placed[],gap:number,budget:Budget):boolean{
  const a=candidate.box;
  for(const other of sheet){
    if(expired(budget))return false;
    const b=other.box;
    const dx=Math.max(0,a[0]-b[2],b[0]-a[2]),dy=Math.max(0,a[1]-b[3],b[1]-a[3]);
    if(Math.hypot(dx,dy)>=gap-EPS&&(dx>EPS||dy>EPS))continue;
    const overlapX=Math.min(a[2],b[2])-Math.max(a[0],b[0]);
    const overlapY=Math.min(a[3],b[3])-Math.max(a[1],b[1]);
    if(gap===0&&(overlapX<=EPS||overlapY<=EPS))continue;
    budget.segments-=candidate.ring.length*other.ring.length;
    if(expired(budget))return false;
    try{
      if(overlapX>EPS&&overlapY>EPS){
        const overlap=polygonClipping.intersection([candidate.ring],[other.ring]);
        const overlapArea=overlap.reduce((sum,polygon)=>sum+Math.abs(area(polygon[0]))-
          polygon.slice(1).reduce((holes,ring)=>holes+Math.abs(area(ring)),0),0);
        if(overlapArea>EPS)return false;
      }
      if(gap>0&&ringDistance(candidate.ring,other.ring)<gap-EPS)return false;
    }catch{return false;}
  }
  return true;
}

function anchors(sheet:Placed[],extent:number,size:number,axis:0|1,gap:number):number[]{
  const values=[0,extent-size];
  for(const placed of sheet){
    const min=placed.box[axis],max=placed.box[axis+2];
    values.push(min,max-size,min-size-gap,max+gap);
    // Contour vertices also expose notches inside overlapping bounding boxes.
    const step=Math.max(1,Math.ceil(placed.ring.length/12));
    for(let i=0;i<placed.ring.length;i+=step){
      const coordinate=placed.ring[i][axis];
      values.push(coordinate+gap,coordinate-size-gap);
    }
  }
  return [...new Set(values.filter(value=>value>=-EPS&&value+size<=extent+EPS)
    .map(value=>Math.max(0,Math.min(extent-size,value))))].sort((a,b)=>a-b);
}

function findPosition(item:Item,sheet:Placed[],sheetIndex:number,width:number,length:number,gap:number,budget:Budget):Placed|undefined{
  let best:Placed|undefined;
  for(const variant of item.shapes){
    if(expired(budget))break;
    const xs=anchors(sheet,width,variant.width,0,gap),ys=anchors(sheet,length,variant.height,1,gap);
    for(const y of ys){
      if(best&&y+variant.height>best.box[3]+EPS)break;
      let found=false;
      for(const x of xs){
        if(expired(budget))return best;
        const candidate=position(item,variant,x,y,sheetIndex);
        if(fits(candidate,sheet,gap,budget)){
          if(!best||candidate.box[3]<best.box[3]-EPS||
            (Math.abs(candidate.box[3]-best.box[3])<=EPS&&x<best.box[0]))best=candidate;
          found=true;break;
        }
      }
      if(found)break;
    }
  }
  return best;
}

function findRowPosition(item:Item,sheet:Placed[],sheetIndex:number,width:number,length:number,gap:number,budget:Budget,fromTop:boolean):Placed|undefined{
  let best:Placed|undefined,bestDepth=Infinity;
  for(const variant of item.shapes){
    if(expired(budget))break;
    const xs=anchors(sheet,width,variant.width,0,gap).reverse();
    const ys=anchors(sheet,length,variant.height,1,gap);
    if(fromTop)ys.reverse();
    for(const y of ys){
      const depth=fromTop?length-y-variant.height:y;
      if(depth>bestDepth+EPS)break;
      let found=false;
      for(const x of xs){
        if(expired(budget))return best;
        const candidate=position(item,variant,x,y,sheetIndex);
        if(fits(candidate,sheet,gap,budget)){
          if(!best||depth<bestDepth-EPS||
            (Math.abs(depth-bestDepth)<=EPS&&candidate.box[2]>best.box[2]+EPS)){
            best=candidate;bestDepth=depth;
          }
          found=true;break;
        }
      }
      if(found)break;
    }
  }
  return best;
}

function packingItems(doc:Document,source:Result,width:number,length:number):Item[]{
  const parts=new Map(doc.parts.map(part=>[part.id,part])),rings=new Map<string,Ring>();
  const shapeCache=new Map<string,Shape>();
  return source.placements.map((placement,index):Item=>{
    const part=parts.get(placement.partId);
    if(!part)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    let ring=rings.get(part.id);
    if(!ring){ring=collisionRing(part);rings.set(part.id,ring);}
    const shapes=angles(placement,part).map(angle=>{
      const key=JSON.stringify([part.id,angle,!!placement.mirrorX,!!placement.mirrorY]);
      let variant=shapeCache.get(key);
      if(!variant){variant=shape(ring!,placement,angle);shapeCache.set(key,variant);}
      return variant;
    }).filter(variant=>variant.width<=width+EPS&&variant.height<=length+EPS)
      .sort((a,b)=>a.height-b.height||a.width-b.width);
    if(!shapes.length)throw Error(`${part.name} izin verilen dönüşlerle seçilen plakaya sığmıyor.`);
    return {index,placement,part,ring,area:Math.abs(area(ring)),shapes};
  });
}

function resultFromSheets(doc:Document,source:Result,sheets:Placed[][]):Result{
  const nonempty=sheets.filter(sheet=>sheet.length),placements=new Array<Placement>(source.placements.length);
  nonempty.forEach((sheet,sheetIndex)=>sheet.forEach(placed=>{
    placements[placed.item.index]={...placed.placement,sheetIndex};
  }));
  return packResultIntoSheets(doc,{...source,placements,sheetCount:nonempty.length,
    usedLengthMm:nonempty.length*doc.settings.materialLengthMm!});
}

/** Improve finite plates in a worker; retain the original layout unless a complete,
 * independently validated packing uses fewer sheets. Never scale or reflect parts. */
export function improveSheetPacking(doc:Document,source:Result,options:{timeLimitMs?:number}={}):Result{
  if(doc.settings.materialType!=='sheet')return packResultIntoSheets(doc,source);
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm!,gap=doc.settings.clearanceMm;
  if(!Number.isFinite(length)||length<=0)throw Error('Plaka uzunluğu pozitif bir değer olmalıdır.');
  const budget:Budget={deadline:performance.now()+Math.max(0,options.timeLimitMs??200),segments:2_000_000};
  let best:Result|undefined,originalError:unknown;
  try{
    const original=packResultIntoSheets(doc,source),checked=validate(doc,original);
    if(checked.status==='passed')best={...original,validation:{...checked,source:'local'}};
    else originalError=Error(checked.errors.join(' '));
  }catch(error){originalError=error;}
  if(best?.sheetCount===1)return best;

  const items=packingItems(doc,source,width,length);
  const lowerBound=Math.max(1,Math.ceil((items.reduce((sum,item)=>sum+item.area,0)-EPS)/(width*length)));
  const accept=(sheets:Placed[][])=>{
    const count=sheets.filter(sheet=>sheet.length).length;
    if(best&&count>=(best.sheetCount??1))return;
    const candidate=resultFromSheets(doc,source,sheets),checked=validate(doc,candidate);
    if(checked.status==='passed')best={...candidate,validation:{...checked,source:'local'}};
  };
  if(best&&(best.sheetCount??1)<=lowerBound)return best;

  // Keep Sparrow's dense, interlocking groups and try to empty later plates into
  // earlier free space before attempting new complete layouts.
  if(best&&!expired(budget)){
    const sheets:Placed[][]=Array.from({length:best.sheetCount!},()=>[]);
    best.placements.forEach((placement,index)=>{
      const item=items[index],ring=transform(item.ring,placement);
      sheets[placement.sheetIndex??0].push({item,placement,ring,box:bounds(ring) as Box});
    });
    for(let from=sheets.length-1;from>0&&!expired(budget);from--){
      for(const placed of [...sheets[from]].sort((a,b)=>b.item.area-a.item.area)){
        if(expired(budget))break;
        for(let to=0;to<from;to++){
          const moved=findPosition(placed.item,sheets[to],to,width,length,gap,budget);
          if(moved){sheets[to].push(moved);sheets[from].splice(sheets[from].indexOf(placed),1);break;}
        }
      }
    }
    accept(sheets);
  }

  const orders=[
    [...items].sort((a,b)=>b.area-a.area||b.shapes[0].height-a.shapes[0].height),
    [...items].sort((a,b)=>b.shapes[0].height-a.shapes[0].height||b.area-a.area),
    [...items].sort((a,b)=>b.shapes[0].width-a.shapes[0].width||b.area-a.area),
  ];
  for(const order of orders){
    if(expired(budget)||(best&&(best.sheetCount??1)<=lowerBound))break;
    const sheets:Placed[][]=[];
    let complete=true;
    for(const item of order){
      if(expired(budget)){complete=false;break;}
      let placed:Placed|undefined;
      for(let index=0;index<sheets.length&&!placed;index++){
        placed=findPosition(item,sheets[index],index,width,length,gap,budget);
        if(placed)sheets[index].push(placed);
      }
      if(!placed){
        if(best&&sheets.length+1>=(best.sheetCount??1)){complete=false;break;}
        placed=findPosition(item,[],sheets.length,width,length,gap,budget);
        if(!placed){complete=false;break;}
        sheets.push([placed]);
      }
    }
    if(complete)accept(sheets);
  }
  if(!best)throw originalError??Error('Seçilen plaka ölçülerinde geçerli bir yerleşim bulunamadı.');
  return best;
}

/** Try physical horizontal rows even when Sparrow already found one plate.
 * A dense interlocking solution remains the fallback if a complete directional
 * packing cannot fit in the same number of sheets within the worker budget. */
export function arrangeSheetRows(doc:Document,source:Result,options:{timeLimitMs?:number}={}):Result{
  if(doc.settings.materialType!=='sheet'||!source.placements.length)return source;
  const budget:Budget={deadline:performance.now()+Math.max(0,options.timeLimitMs??200),segments:2_000_000};
  if(expired(budget))return source;
  const width=doc.settings.materialWidthMm,length=doc.settings.materialLengthMm!,gap=doc.settings.clearanceMm;
  const items=packingItems(doc,source,width,length),partOrder=new Map(doc.parts.map((part,index)=>[part.id,index]));
  const byCopy=(a:Item,b:Item)=>partOrder.get(a.part.id)!-partOrder.get(b.part.id)!||a.placement.copyIndex-b.placement.copyIndex;
  const orders=[
    [...items].sort(byCopy),
    [...items].sort((a,b)=>b.shapes[0].height-a.shapes[0].height||b.area-a.area||byCopy(a,b)),
    [...items].sort((a,b)=>b.area-a.area||byCopy(a,b)),
  ];
  const fromTop=doc.settings.startCorner==='right-top',maxSheets=source.sheetCount??1;
  for(const order of orders){
    if(expired(budget))break;
    const sheets:Placed[][]=[];
    let complete=true;
    for(const item of order){
      if(expired(budget)){complete=false;break;}
      let placed:Placed|undefined;
      for(let sheetIndex=0;sheetIndex<sheets.length&&!placed;sheetIndex++){
        placed=findRowPosition(item,sheets[sheetIndex],sheetIndex,width,length,gap,budget,fromTop);
        if(placed)sheets[sheetIndex].push(placed);
      }
      if(!placed){
        if(sheets.length>=maxSheets){complete=false;break;}
        placed=findRowPosition(item,[],sheets.length,width,length,gap,budget,fromTop);
        if(!placed){complete=false;break;}
        sheets.push([placed]);
      }
    }
    if(complete){
      const candidate=resultFromSheets(doc,source,sheets),checked=validate(doc,candidate);
      if(checked.status==='passed')return {...candidate,validation:{...checked,source:'local'}};
    }
  }
  return source;
}
