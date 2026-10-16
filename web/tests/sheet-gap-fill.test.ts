import {describe,expect,it} from 'vitest';
import {fillSheetGaps} from '../src/geometry/sheetGapFill';
import {newPart,type Document,type Result} from '../src/model';
import {validate} from '../src/geometry/validate';

function scenario():{doc:Document;result:Result}{
  const part=newPart([[0,0],[20,0],[20,10],[0,10]],'Shoe part');
  part.quantity=3;
  const doc:Document={name:'Plate gap fixture',parts:[part],settings:{
    materialType:'sheet',materialWidthMm:45,materialLengthMm:20,
    clearanceMm:0,timeLimitSeconds:null,startCorner:'right-bottom'}};
  const placements=[
    {partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:part.id,copyIndex:1,xMm:20,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:part.id,copyIndex:2,xMm:0,yMm:0,angleDeg:0,sheetIndex:1}
  ];
  const result:Result={documentRevision:1,solverRevision:'5901a79b6c5a74d8b9c356ee2916736567308108',
    seed:'1',elapsedSeconds:10,placements,usedLengthMm:40,sheetCount:2,
    validation:{status:'passed',source:'local',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  expect(validate(doc,result).status).toBe('passed');
  return{doc,result};
}
describe('plate gap filling',()=>{
  it('fills an empty strip on plate one instead of wasting plate two',()=>{
    const{doc,result}=scenario();
    const next=fillSheetGaps(doc,result,5000);
    expect(next.sheetCount).toBe(1);
    expect(next.usedLengthMm).toBe(20);
    expect(validate(doc,next).status).toBe('passed');
    expect(next.placements.map(p=>p.angleDeg)).toEqual(result.placements.map(p=>p.angleDeg));
    expect(doc.parts[0].outer).toEqual([[0,0],[20,0],[20,10],[0,10]]);
  });
  it('retains a validated solution if a previous plate has no capacity',()=>{
    const{doc,result}=scenario();
    doc.settings.materialLengthMm=10;
    result.usedLengthMm=20;
    const next=fillSheetGaps(doc,result,5000);
    expect(next.sheetCount).toBe(2);
    expect(next.usedLengthMm).toBe(20);
  });
  it('rotates an allowed piece to use a free cavity on an earlier sheet',()=>{
    const horizontal=newPart([[0,0],[20,0],[20,10],[0,10]],'horizontal');
    horizontal.quantity=2;
    const vertical=newPart([[0,0],[10,0],[10,20],[0,20]],'vertical');
    vertical.rotations={kind:'discrete',degrees:[0,90]};
    const doc:Document={name:'Rotation gap',parts:[horizontal,vertical],
      settings:{materialType:'sheet',materialWidthMm:40,materialLengthMm:20,
        clearanceMm:0,timeLimitSeconds:null,startCorner:'right-bottom'}};
    const placements=[
      {partId:horizontal.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:horizontal.id,copyIndex:1,xMm:20,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:vertical.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:1}
    ];
    const base:Result={documentRevision:1,solverRevision:'5901a79b6c5a74d8b9c356ee2916736567308108',
      seed:'1',elapsedSeconds:5,usedLengthMm:40,sheetCount:2,placements,
      validation:{status:'passed',source:'local',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
    expect(validate(doc,base).status).toBe('passed');
    const improved=fillSheetGaps(doc,base,5000);
    expect(improved.sheetCount).toBe(1);
    expect(improved.placements.find(p=>p.partId===vertical.id)?.angleDeg).toBe(90);
    expect(validate(doc,improved).status).toBe('passed');
  });
  it('respects manually locked angles when filling a plate',()=>{
    const {doc,result}=scenario();
    // Make each piece 20 x 10; a locked 0-degree angle must never change.
    result.placements[2].fixedAngleDeg=0;
    const next=fillSheetGaps(doc,result,5000);
    expect(next.placements[2].angleDeg).toBe(0);
    expect(next.placements[2].fixedAngleDeg).toBe(0);
    expect(validate(doc,next).status).toBe('passed');
  });
  it('does not affect rulo mode',()=>{
    const{doc,result}=scenario();
    doc.settings.materialType='roll';
    expect(fillSheetGaps(doc,result)).toBe(result);
  });
});
