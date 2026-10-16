import {expect,it} from 'vitest';
import {newPart,type Document,type Result} from '../src/model';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {compactRollLayoutIntoPlates} from '../src/geometry/sheetFirstFit';
import {validate} from '../src/geometry/validate';

const box=(w:number,h:number)=>newPart([[0,0],[w,0],[w,h],[0,h]],'Footwear tile');
function base(doc:Document,placements:Result['placements']):Result{
  return {documentRevision:1,solverRevision:'roll-engine',seed:'7',
    elapsedSeconds:1,usedLengthMm:Math.max(...placements.map(p=>p.yMm))+10,
    placements,validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,
      minClearanceMm:null,errors:[]}};
}
const docFor=(width=40,length=20,gap=0):Document=>{
  const part=box(20,10);part.quantity=3;
  return {name:'same-roll-engine-fixed-plates',parts:[part],settings:{
    materialType:'sheet',materialWidthMm:width,materialLengthMm:length,
    clearanceMm:gap,timeLimitSeconds:30,startCorner:'right-bottom'}};
};
it('takes a safe 2-plate roll band split and fills the first 1400-style plate instead',()=>{
  const doc=docFor();
  const part=doc.parts[0],source=base(doc,[
    {partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0},
    {partId:part.id,copyIndex:1,xMm:20,yMm:5,angleDeg:0},
    {partId:part.id,copyIndex:2,xMm:0,yMm:15,angleDeg:0}
  ]);
  const original=packResultIntoSheets(doc,source);
  expect(original.sheetCount).toBe(2);
  const originalCheck=validate(doc,original);
  expect(originalCheck.status).toBe('passed');
  const improved=compactRollLayoutIntoPlates(doc,{...original,validation:originalCheck});
  expect(improved.sheetCount).toBe(1);
  const checked=packResultIntoSheets(doc,improved);
  expect(validate(doc,checked).status).toBe('passed');
  expect(checked.placements).toHaveLength(3);
  expect(checked.placements.map(p=>p.copyIndex).sort()).toEqual([0,1,2]);
  expect(checked.placements.every(p=>p.angleDeg===0)).toBe(true);
  expect(doc.parts[0].outer).toEqual([[0,0],[20,0],[20,10],[0,10]]);
});
it('does not invent capacity when two copies physically cannot fit one plate',()=>{
  const doc=docFor(20,10);doc.parts[0].quantity=2;
  const p=doc.parts[0];
  const source=base(doc,[
    {partId:p.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0},
    {partId:p.id,copyIndex:1,xMm:0,yMm:12,angleDeg:0}
  ]);
  const original=packResultIntoSheets(doc,source);
  expect(original.sheetCount).toBe(2);
  const checked=validate(doc,original);
  expect(checked.status).toBe('passed');
  const updated=compactRollLayoutIntoPlates(doc,{...original,validation:checked});
  expect(updated.sheetCount).toBe(2);
  expect(validate(doc,updated).status).toBe('passed');
});
it('does not modify rulo mode, user copies, geometry or angle locks',()=>{
  const doc=docFor(),p=doc.parts[0];
  const original=base(doc,[{partId:p.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,fixedAngleDeg:0}]);
  doc.settings.materialType='roll';
  expect(compactRollLayoutIntoPlates(doc,original)).toBe(original);
});
it('never reflows unverified or too-complex results',()=>{
  const doc=docFor(),part=doc.parts[0];
  const invalid=base(doc,[{partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0}]);
  expect(compactRollLayoutIntoPlates(doc,invalid)).toBe(invalid);
});
