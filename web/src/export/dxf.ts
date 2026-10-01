import parseString from 'dxf/lib/parseString';
import type {Document,DxfAuxEntity,DxfSpline,Placement,Point,Ring} from '../model';
import type {WorldPart} from '../geometry/validate';

export const STUDIO_CREDIT='nested with sparrow/studio · https://sparrowstudio.app';

export function exportDXF(doc:Document,world:WorldPart[],placements:Placement[]=[],preserveSourceCurves=true):string {
  let nextHandle=0x100;
  const handle=()=> (nextHandle++).toString(16).toUpperCase();
  const colorGroup=(color?:number)=>color!==undefined&&color>=1&&color<=255?`62\n${color}\n`:'';
  const polyline=(ring:Ring,layer:string,color?:number)=>`0\nLWPOLYLINE\n5\n${handle()}\n330\n21\n100\nAcDbEntity\n8\n${layer}\n${colorGroup(color)}100\nAcDbPolyline\n90\n${ring.length}\n70\n1\n${ring.map(([x,y])=>`10\n${x}\n20\n${y}\n`).join('')}`;
  const transformPoint=([x,y]:Point,p:Placement):Point=>{
    const angle=p.angleDeg*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    return [x*cos-y*sin+p.xMm,x*sin+y*cos+p.yMm];
  };
  const aux=(entity:DxfAuxEntity,p:Placement)=>{
    const [x,y]=transformPoint(entity.point,p),layer=entity.layer||'MARKS',color=colorGroup(entity.colorNumber);
    if(entity.kind==='point') return `0\nPOINT\n5\n${handle()}\n330\n21\n100\nAcDbEntity\n8\n${layer}\n${color}100\nAcDbPoint\n10\n${x}\n20\n${y}\n30\n0\n`;
    const rotation=entity.rotationDeg+p.angleDeg;
    if(entity.kind==='mtext') return `0\nMTEXT\n5\n${handle()}\n330\n21\n100\nAcDbEntity\n8\n${layer}\n${color}100\nAcDbMText\n10\n${x}\n20\n${y}\n30\n0\n40\n${entity.heightMm}\n1\n${entity.text}\n50\n${rotation}\n`;
    return `0\nTEXT\n5\n${handle()}\n330\n21\n100\nAcDbEntity\n8\n${layer}\n${color}100\nAcDbText\n10\n${x}\n20\n${y}\n30\n0\n40\n${entity.heightMm}\n1\n${entity.text}\n50\n${rotation}\n100\nAcDbText\n`;
  };
  const spline=(curve:DxfSpline,p:Placement,layer:string,color?:number)=>{
    const points=curve.controlPoints.map(point=>transformPoint(point,p));
    return `0\nSPLINE\n5\n${handle()}\n330\n21\n100\nAcDbEntity\n8\n${layer}\n${colorGroup(color)}100\nAcDbSpline\n210\n0\n220\n0\n230\n1\n70\n${curve.flags}\n71\n${curve.degree}\n72\n${curve.knots.length}\n73\n${points.length}\n74\n0\n42\n0.0000000001\n43\n0.0000000001\n${curve.knots.map(k=>`40\n${k}\n`).join('')}${curve.weights?.map(w=>`41\n${w}\n`).join('')??''}${points.map(([x,y])=>`10\n${x}\n20\n${y}\n30\n0\n`).join('')}`;
  };
  const parts=new Map(doc.parts.map(part=>[part.id,part]));
  const layerNames=[...new Set(['0','PARTS','HOLES',...doc.parts.flatMap(part=>[
    ...(part.source.dxfAux??[]).map(entity=>entity.layer||'MARKS'),
    ...(part.source.dxfDetails??[]).map(detail=>detail.layer||'DETAILS')
  ])])];
  const layers=layerNames.map(layer=>`0\nLAYER\n5\n${handle()}\n330\n10\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n${layer}\n70\n0\n62\n7\n6\nCONTINUOUS\n`).join('');
  const entities=world.map((p,i)=>{
    const part=parts.get(p.partId),placement=placements[i];
    const compact=preserveSourceCurves&&part?.source.dxfSpline&&placement&&placement.partId===p.partId&&placement.copyIndex===p.copyIndex
      ?spline(part.source.dxfSpline,placement,'PARTS',part.source.dxfColorNumber):polyline(p.outer,'PARTS',part?.source.dxfColorNumber);
    const details=part&&placement?(part.source.dxfDetails??[]).map(detail=>polyline(detail.ring.map(point=>transformPoint(point,placement)),detail.layer||'DETAILS',detail.colorNumber)).join(''):'';
    const marks=part&&placement?(part.source.dxfAux??[]).map(entity=>aux(entity,placement)).join(''):'';
    return compact+p.holes.map((h,holeIndex)=>polyline(h,'HOLES',part?.source.dxfHoleColorNumbers?.[holeIndex])).join('')+details+marks;
  }).join('');
  // R2000 readers such as QCAD require explicit model/paper-space ownership.
  const spaces=[['*Model_Space','21','23','24'],['*Paper_Space','22','25','26']];
  const records=spaces.map(([name,id])=>`0\nBLOCK_RECORD\n5\n${id}\n330\n20\n100\nAcDbSymbolTableRecord\n100\nAcDbBlockTableRecord\n2\n${name}\n70\n0\n`).join('');
  const blocks=spaces.map(([name,id,begin,end])=>`0\nBLOCK\n5\n${begin}\n330\n${id}\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockBegin\n2\n${name}\n70\n0\n10\n0\n20\n0\n30\n0\n3\n${name}\n1\n\n0\nENDBLK\n5\n${end}\n330\n${id}\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockEnd\n`).join('');
  const text=`0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n9\n$HANDSEED\n5\n${nextHandle.toString(16).toUpperCase()}\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n5\n10\n330\n0\n100\nAcDbSymbolTable\n70\n${layerNames.length}\n${layers}0\nENDTAB\n0\nTABLE\n2\nBLOCK_RECORD\n5\n20\n330\n0\n100\nAcDbSymbolTable\n70\n2\n${records}0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n${blocks}0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
  const parsed=parseString(text) as {header:{insUnits:number};entities:{type:string;closed?:boolean;layer:string;vertices?:{x:number;y:number}[];controlPoints?:{x:number;y:number}[];knots?:number[];degree?:number;weights?:number[]}[]};
  if(parsed.header.insUnits!==4)throw Error('Serialized DXF lost its millimeter units.');
  let at=0;
  for(let i=0;i<world.length;i++){
    const p=world[i],part=parts.get(p.partId),placement=placements[i],curve=part?.source.dxfSpline;
    const entity=parsed.entities[at++];
    if(curve&&placement&&placement.partId===p.partId&&placement.copyIndex===p.copyIndex){
      if(entity?.type!=='SPLINE'||entity.layer!=='PARTS'||entity.degree!==curve.degree)throw Error('Serialized DXF lost its compact spline.');
      const expected=curve.controlPoints.map(point=>transformPoint(point,placement)),actual=(entity.controlPoints??[]).map(q=>[q.x,q.y] as Point);
      if(JSON.stringify(entity.knots??[])!==JSON.stringify(curve.knots)||JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Serialized DXF changed spline control points.');
    }else{
      if(entity?.type!=='LWPOLYLINE'||!entity.closed||entity.layer!=='PARTS')throw Error('Serialized DXF lost a closed contour or layer.');
      const outer=(entity.vertices??[]).map(q=>[q.x,q.y] as Point);
      if(JSON.stringify(outer)!==JSON.stringify(p.outer))throw Error('Serialized DXF changed canvas coordinates.');
    }
    for(const hole of p.holes){
      const h=parsed.entities[at++];
      if(h?.type!=='LWPOLYLINE'||!h.closed||h.layer!=='HOLES')throw Error('Serialized DXF lost a closed hole.');
      const ring=(h.vertices??[]).map(q=>[q.x,q.y] as Point);
      if(JSON.stringify(ring)!==JSON.stringify(hole))throw Error('Serialized DXF changed canvas coordinates.');
    }
    for(const detail of part?.source.dxfDetails??[]){
      const entity=parsed.entities[at++];
      if(entity?.type!=='LWPOLYLINE'||!entity.closed||entity.layer!==(detail.layer||'DETAILS'))throw Error('Serialized DXF lost an attached detail contour.');
      const expected=detail.ring.map(point=>transformPoint(point,placement!)),actual=(entity.vertices??[]).map(q=>[q.x,q.y] as Point);
      if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Serialized DXF changed an attached detail contour.');
    }
    for(const mark of part?.source.dxfAux??[]){
      const entity=parsed.entities[at++];
      const expectedType=mark.kind==='point'?'POINT':mark.kind==='mtext'?'MTEXT':'TEXT';
      if(entity?.type!==expectedType)throw Error('Serialized DXF lost an attached point or text mark.');
    }
  }
  if(at!==parsed.entities.length)throw Error('Serialized DXF changed contour count.');
  return text;
}
