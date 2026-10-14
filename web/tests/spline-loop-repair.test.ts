import parseString from 'dxf/lib/parseString';
import {it,expect} from 'vitest';
import {importDXF} from '../src/import/dxf';
import {exportDXF} from '../src/export/dxf';
import {worldParts} from '../src/geometry/validate';

const options={scale:1,tolerance:.01,enclosed:'holes' as const};
const dxf=(entities:string)=>`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
function spline(points:[number,number][]):string{
  const knots=[0,0,...Array.from({length:points.length-2},(_,i)=>i+1),points.length-1,points.length-1];
  return `0\nSPLINE\n8\nCUT\n70\n8\n71\n1\n72\n${knots.length}\n73\n${points.length}\n74\n0\n`+
    knots.map(k=>`40\n${k}\n`).join('')+
    points.map(([x,y])=>`10\n${x}\n20\n${y}\n30\n0\n`).join('');
}

it('repairs an open footwear-style SPLINE with a short extra lead-in and keeps native SPLINE export',()=>{
  const points:[number,number][]=[[0,0],[4,0],[10,0],[20,0],[30,0],[40,0],[50,0],
    [50,10],[50,20],[50,30],[50,40],[50,50],[40,50],[30,50],[20,50],[10,50],
    [0,50],[0,40],[0,30],[0,20],[0,10],[0,0],[2,0]];
  const review=importDXF(dxf(spline(points)),'short-spur.dxf',options);
  expect(review.issues).toEqual([]);
  expect(review.document.parts).toHaveLength(1);
  expect(review.warnings.join(' ')).toContain('1 adet açık SPLINE');
  expect(review.document.parts[0].source.dxfEntities?.[0]?.kind).toBe('spline');
  const placements=review.document.placements??[];
  const exported=exportDXF(review.document,worldParts(review.document,{placements}),placements,true);
  const parsed=parseString(exported) as {entities:{type:string;controlPoints?:unknown[]}[]};
  expect(parsed.entities).toHaveLength(1);
  expect(parsed.entities[0].type).toBe('SPLINE');
  expect(parsed.entities[0].controlPoints!.length).toBeLessThanOrEqual(points.length);
});

it('leaves unrelated open SPLINEs as non-nesting marks',()=>{
  const review=importDXF(dxf(spline([[0,0],[10,5],[20,5],[30,0]])),'open.dxf',options);
  expect(review.document.parts).toHaveLength(0);
  expect(review.issues?.join(' ')).toContain('outside every closed part');
});
