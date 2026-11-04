import {LIMITS,type Document,type Part,type Point} from '../model';
import {bounds} from './normalize';
import {netArea} from './validate';

/** Conservative, bounded sheet capacity for a selected part without deleting any others. */
export function safeFullPlateQuantity(document:Document,selected:Part):number {
  if(document.settings.materialType!=='sheet')throw Error('Tam plaka için malzeme tipini Plaka seçin.');
  const length=document.settings.materialLengthMm,width=document.settings.materialWidthMm;
  const gap=document.settings.clearanceMm;
  if(!length||!Number.isFinite(length)||length<=0||!Number.isFinite(width)||width<=0||!Number.isFinite(gap)||gap<0)
    throw Error('Geçerli plaka ölçüleri ve parça aralığı girin.');
  const usableWidth=width-2*gap,usableLength=length-2*gap;
  const area=netArea(selected);
  if(usableWidth<=0||usableLength<=0||!Number.isFinite(area)||area<=0)
    throw Error('Tam plaka için parça geometrisini ve plaka ölçülerini kontrol edin.');
  const other=document.parts.filter(part=>part.id!==selected.id);
  const otherCount=other.reduce((sum,part)=>sum+part.quantity,0);
  const otherVertices=other.reduce((sum,part)=>sum+part.quantity*(part.outer.length+part.holes.reduce((n,r)=>n+r.length,0)),0);
  const chosenVertices=selected.outer.length+selected.holes.reduce((n,r)=>n+r.length,0);
  const copyBudget=LIMITS.copies-otherCount;
  const vertexBudget=Math.floor((LIMITS.verticesTotal-otherVertices)/chosenVertices);
  if(copyBudget<=0||vertexBudget<=0)throw Error('Yeni kopyalar için proje sınırı dolu.');
  const usedOtherArea=other.reduce((sum,part)=>sum+netArea(part)*part.quantity,0);
  const areaBudget=Math.floor(Math.max(0,usableWidth*usableLength-usedOtherArea)/area);
  // A box grid is conservative: its slots never overlap even for concave DXF
  // contours. Allowed orientations are considered, but user-locked angles win.
  const locked=document.placements?.find(copy=>copy.partId===selected.id&&copy.orientationLocked);
  const angles=locked?[locked.angleDeg]
    :selected.rotations.kind==='discrete'?selected.rotations.degrees:[0,90];
  const possible=angles.map(degrees=>{
    const rad=degrees*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
    const rotated=selected.outer.map(([x,y]):Point=>[x*c-y*s,x*s+y*c]);
    const [minX,minY,maxX,maxY]=bounds(rotated);
    const w=maxX-minX,h=maxY-minY;
    if(!(w>0&&h>0))return 0;
    const across=Math.floor((usableWidth+gap+1e-7)/(w+gap));
    const down=Math.floor((usableLength+gap+1e-7)/(h+gap));
    return Math.max(0,across*down);
  });
  const conservative=Math.min(copyBudget,vertexBudget,areaBudget,Math.max(0,...possible));
  if(!conservative||conservative<selected.quantity)
    throw Error('Mevcut parçalar ve ölçüler bu plakaya sığmıyor. Parça adetlerini veya malzeme boyutunu kontrol edin.');
  return conservative;
}
