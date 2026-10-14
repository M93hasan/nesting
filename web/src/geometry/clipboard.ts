import {LIMITS,newPartId,type Document,type Part,type Placement} from '../model';
import {documentPlacements,withDocumentPlacements,type CopyRef} from './placements';

export type ClipboardItem={part:Part;placement:Placement};

/** Store a snapshot, not a reference to the mutable project or active nesting result. */
export function captureClipboard(document:Document,refs:CopyRef[]):ClipboardItem[] {
  const wanted=new Set(refs.map(ref=>`${ref.partId}:${ref.copyIndex}`));
  const parts=new Map(document.parts.map(part=>[part.id,part]));
  return documentPlacements(document).filter(p=>wanted.has(`${p.partId}:${p.copyIndex}`))
    .map(placement=>({part:structuredClone(parts.get(placement.partId)!),placement:{...placement}}));
}

/** Paste copies as normal Serula parts while preserving DXF curves, colors and marks. */
export function pasteClipboard(document:Document,clipboard:ClipboardItem[],offsetMm=15):{document:Document;selection:CopyRef[]} {
  if(!clipboard.length)return {document,selection:[]};
  const existing=documentPlacements(document);
  if(existing.length+clipboard.length>LIMITS.copies)throw Error('Project exceeds 500 copies.');
  const parts=document.parts.map(part=>({...part}));
  const counts=new Map(parts.map(part=>[part.id,part.quantity]));
  const ids=new Map<string,string>();
  const pasted:Placement[]=[],selection:CopyRef[]=[];
  for(const item of clipboard){
    let id=ids.get(item.part.id);
    if(!id){
      id=counts.has(item.part.id)?item.part.id:newPartId();
      ids.set(item.part.id,id);
      if(!counts.has(id)){parts.push({...structuredClone(item.part),id,quantity:0});counts.set(id,0);}
    }
    const index=counts.get(id)!;
    if(index>=LIMITS.copies)throw Error('Parça adedi en fazla 500 olabilir.');
    counts.set(id,index+1);
    pasted.push({...item.placement,partId:id,copyIndex:index,xMm:item.placement.xMm+offsetMm,yMm:item.placement.yMm+offsetMm});
    selection.push({partId:id,copyIndex:index});
  }
  const nextParts=parts.map(part=>({...part,quantity:counts.get(part.id)!}));
  return {document:withDocumentPlacements({...document,parts:nextParts},[...existing,...pasted]),selection};
}
