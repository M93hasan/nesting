import parseString from 'dxf/lib/parseString';
import {expect,it} from 'vitest';
import {importDXF} from '../src/import/dxf';
import {exportDXF} from '../src/export/dxf';
import {worldParts} from '../src/geometry/validate';

const options={scale:1,tolerance:.01,enclosed:'holes' as const};
type XY=[number,number];
const wrap=(body:string)=>`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n0\nEOF\n`;
const cubicLoop=(x:number,y:number,width=30,height=30):XY[][]=>[
  [[x,y],[x+width/3,y],[x+2*width/3,y],[x+width,y]],
  [[x+width,y],[x+width,y+height/3],[x+width,y+2*height/3],[x+width,y+height]],
  [[x+width,y+height],[x+2*width/3,y+height],[x+width/3,y+height],[x,y+height]],
  [[x,y+height],[x,y+2*height/3],[x,y+height/3],[x,y]]
];
function compositeSpline(segments:XY[][],degree:number,flags=11):string {
  const points=segments.flat(),knots=segments.flatMap((_,i)=>Array.from({length:degree+1},()=>i));
  knots.push(...Array.from({length:degree+1},()=>segments.length));
  return `0\nSPLINE\n8\nLayer 1\n70\n${flags}\n71\n${degree}\n72\n${knots.length}\n73\n${points.length}\n74\n0\n`+
    knots.map(v=>`40\n${v}\n`).join('')+
    points.map(([px,py])=>`10\n${px}\n20\n${py}\n30\n0\n`).join('');
}
it('accepts connected cubic Bezier segments encoded with degree+1 internal SPLINE knots',()=>{
  // Footwear CAD often stores a *single* closed contour in this form.
  const data=wrap(compositeSpline(cubicLoop(0,0),3));
  const review=importDXF(data,'joined-bezier.dxf',options);
  expect(review.issues).toEqual([]);
  expect(review.document.parts).toHaveLength(1);
  const native=review.document.parts[0].source.dxfSpline;
  expect(native?.degree).toBe(3);
  expect(native?.controlPoints).toHaveLength(16);
  expect(native?.knots).toHaveLength(20);
  const placements=review.document.placements??[];
  const exported=exportDXF(review.document,worldParts(review.document,{placements}),placements,true);
  const parsed=parseString(exported) as {entities:{type:string;controlPoints?:unknown[];knots?:number[]}[]};
  expect(parsed.entities).toHaveLength(1);
  expect(parsed.entities[0].type).toBe('SPLINE');
  expect(parsed.entities[0].controlPoints).toHaveLength(16);
  expect(parsed.entities[0].knots).toHaveLength(20);
});
it('imports sixteen separated connected-bezier contours in one DXF without changing their source curves',()=>{
  const entities=Array.from({length:16},(_,i)=>compositeSpline(cubicLoop((i%4)*55,Math.floor(i/4)*55),3)).join('');
  const review=importDXF(wrap(entities),'studio-multiple-bezier.dxf',options);
  expect(review.issues).toEqual([]);
  expect(review.document.parts).toHaveLength(16);
  for(const part of review.document.parts){
    expect(part.source.dxfSpline?.knots).toHaveLength(20);
    expect(part.source.dxfSpline?.controlPoints).toHaveLength(16);
  }
});
it('also accepts connected degree-two Bezier segments (but not detached segments)',()=>{
  const square:XY[][]=[
    [[0,0],[5,0],[10,0]],[[10,0],[10,5],[10,10]],
    [[10,10],[5,10],[0,10]],[[0,10],[0,5],[0,0]]
  ];
  const ok=importDXF(wrap(compositeSpline(square,2,1)),'quadratic-bezier.dxf',options);
  expect(ok.issues).toEqual([]);
  expect(ok.document.parts).toHaveLength(1);
  const broken=square.map(p=>p.map(([x,y])=>[x,y] as XY));
  broken[1][0]=[10.03,0]; // Real manufacturing gap, not a safe seam.
  const rejected=importDXF(wrap(compositeSpline(broken,2,1)),'broken-contour.dxf',options);
  expect(rejected.document.parts).toHaveLength(0);
  expect(rejected.issues.join(' ')).toContain('Discontinuous SPLINE cannot form one contour');
});
