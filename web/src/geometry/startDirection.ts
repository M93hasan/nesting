import type {Document,Placement,Result,Ring} from '../model';
import {bounds} from './normalize';
import {collisionRing,transform} from './validate';

type Item={index:number;partOrder:number;copyIndex:number;box:number[]};
type Group={items:Item[];min:number;max:number;first:Item};
const EPS=1e-7;
const compare=(a:Item,b:Item)=>a.partOrder-b.partOrder||a.copyIndex-b.copyIndex;

/** Keep overlapping projection intervals rigid, including interlocking contours.
 * Exact edge or clearance contact separates groups, so adjoining rows remain rows. */
function groups(items:Item[],axis:0|1,gap:number):Group[]{
  const ordered=[...items].sort((a,b)=>a.box[axis]-b.box[axis]||
    a.box[axis+2]-b.box[axis+2]||compare(a,b));
  const result:Group[]=[];
  for(const item of ordered){
    const min=item.box[axis],max=item.box[axis+2],last=result.at(-1);
    if(last&&min<last.max+gap-EPS){
      last.items.push(item);last.max=Math.max(last.max,max);
      if(compare(item,last.first)<0)last.first=item;
    }else result.push({items:[item],min,max,first:item});
  }
  return result.sort((a,b)=>compare(a.first,b.first));
}

/** Format safe, separate rows from the selected corner without reflecting parts.
 * Each interlocking group stays rigid. Stable document/copy keys make repeated
 * formatting independent of placement-array order and prevent direction toggles. */
export function orientToStartCorner(doc:Document,result:Result):Result{
  if(!result.placements.length)return result;
  const width=doc.settings.materialWidthMm,gap=Math.max(0,doc.settings.clearanceMm);
  const length=doc.settings.materialType==='sheet'?doc.settings.materialLengthMm:result.usedLengthMm;
  if(!length||!Number.isFinite(length)||length<=0)throw Error('Yerleşim uzunluğu bulunamadı.');
  const parts=new Map(doc.parts.map((part,partOrder)=>[part.id,{part,partOrder}] as const));
  const rings=new Map<string,Ring>(),sheets=new Map<number,Item[]>();
  result.placements.forEach((placement,index)=>{
    const entry=parts.get(placement.partId);
    if(!entry)throw Error('Yerleşimde bilinmeyen parça bulundu.');
    let ring=rings.get(placement.partId);
    if(!ring){ring=collisionRing(entry.part);rings.set(placement.partId,ring);}
    const sheetIndex=doc.settings.materialType==='sheet'?(placement.sheetIndex??0):0;
    const item={index,partOrder:entry.partOrder,copyIndex:placement.copyIndex,
      box:bounds(transform(ring,placement))};
    const sheet=sheets.get(sheetIndex);
    if(sheet)sheet.push(item);else sheets.set(sheetIndex,[item]);
  });
  const placements:Placement[]=result.placements.map(placement=>({...placement}));
  const bottom=(doc.settings.startCorner??'right-bottom')==='right-bottom';
  for(const items of sheets.values()){
    let edge=bottom?0:length;
    for(const row of groups(items,1,gap)){
      const dy=bottom?edge-row.min:edge-row.max;
      let right=width;
      for(const block of groups(row.items,0,gap)){
        const dx=right-block.max;
        for(const item of block.items){
          placements[item.index].xMm+=dx;
          placements[item.index].yMm+=dy;
        }
        right-=block.max-block.min+gap;
      }
      edge+=(bottom?1:-1)*(row.max-row.min+gap);
    }
  }
  return {...result,placements};
}
