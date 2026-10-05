import parseString from 'dxf/lib/parseString';
import {expect,it} from 'vitest';
import {newPart,type Document} from '../src/model';
import {documentPlacements,mirrorPlacements,setPlacementAngles} from '../src/geometry/placements';
import {worldParts} from '../src/geometry/validate';
import {exportDXF} from '../src/export/dxf';

function fixture(){
  const part={...newPart([[0,0],[10,0],[10,4],[0,4]],'manual'),id:'manual',quantity:2,
    source:{format:'dxf' as const,dxfEntities:[{kind:'polyline' as const,points:[[0,0],[10,0],[10,4],[0,4]] as [number,number][],bulges:[1,0,0,0],closed:true,sourceType:'LWPOLYLINE' as const,layer:'CUT'}]}};
  const doc:Document={name:'manual-transform',parts:[part],settings:{materialWidthMm:200,clearanceMm:0,timeLimitSeconds:30},
    placements:[{partId:part.id,copyIndex:0,xMm:20,yMm:30,angleDeg:0},{partId:part.id,copyIndex:1,xMm:60,yMm:30,angleDeg:0}]};
  return {doc,part};
}

it('sets an exact angle only on selected copies and preserves their center',()=>{
  const {doc,part}=fixture(),before=worldParts(doc,{placements:documentPlacements(doc)})[0].outer;
  const next=setPlacementAngles(doc,[{partId:part.id,copyIndex:0}],37.5),placements=documentPlacements(next);
  expect(placements[0].angleDeg).toBe(37.5);
  expect(placements[1].angleDeg).toBe(0);
  const after=worldParts(next,{placements})[0].outer;
  const center=(ring:[number,number][])=>ring.reduce((sum,p)=>[sum[0]+p[0]/ring.length,sum[1]+p[1]/ring.length] as [number,number],[0,0] as [number,number]);
  expect(center(after)[0]).toBeCloseTo(center(before)[0],9);
  expect(center(after)[1]).toBeCloseTo(center(before)[1],9);
});

it('mirrors only the selected copy and keeps its center fixed',()=>{
  const {doc,part}=fixture(),before=worldParts(doc,{placements:documentPlacements(doc)});
  const next=mirrorPlacements(doc,[{partId:part.id,copyIndex:0}],'x'),placements=documentPlacements(next),after=worldParts(next,{placements});
  expect(placements[0].mirrorX).toBe(true);
  expect(placements[1].mirrorX).toBeUndefined();
  const ringBounds=(ring:[number,number][])=>[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
  expect(ringBounds(after[0].outer)).toEqual(ringBounds(before[0].outer));
  expect(after[1].outer).toEqual(before[1].outer);
});

it('exports mirrored native DXF geometry without polygonizing or adding vertices',()=>{
  const {doc,part}=fixture();
  const next=mirrorPlacements(doc,[{partId:part.id,copyIndex:0}],'x'),placements=documentPlacements(next);
  const text=exportDXF(next,worldParts(next,{placements}),placements,true);
  const parsed=parseString(text) as {entities:{type:string;vertices?:{x:number;y:number;bulge?:number}[]}[]};
  expect(parsed.entities).toHaveLength(2);
  expect(parsed.entities.every(entity=>entity.type==='LWPOLYLINE')).toBe(true);
  expect(parsed.entities[0].vertices).toHaveLength(4);
  expect(parsed.entities[1].vertices).toHaveLength(4);
  expect(parsed.entities[0].vertices?.[0].bulge??0).toBeLessThan(0);
});
