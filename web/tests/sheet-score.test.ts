import {describe,it,expect} from 'vitest';
import {newPart,type Document,type Result} from '../src/model';
import {isBetterSheetResult,sheetLayoutScore} from '../src/geometry/sheetScore';
it('selects a more compact validated same-count plate solution',()=>{
  const p=newPart([[0,0],[10,0],[10,10],[0,10]],'tile');p.quantity=2;
  const doc:Document={name:'Sheets',parts:[p],settings:{materialType:'sheet',
    materialWidthMm:40,materialLengthMm:40,clearanceMm:0,timeLimitSeconds:null}};
  const result=(y:number):Result=>({documentRevision:1,solverRevision:'x',seed:'1',elapsedSeconds:1,sheetCount:1,usedLengthMm:40,
    placements:[{partId:p.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:p.id,copyIndex:1,xMm:20,yMm:y,angleDeg:0,sheetIndex:0}],
    validation:{status:'passed',source:'local',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}});
  expect(sheetLayoutScore(doc,result(0))).toBe(10);
  expect(sheetLayoutScore(doc,result(20))).toBe(30);
  expect(isBetterSheetResult(doc,result(0),result(20),70,60)).toBe(true);
  expect(isBetterSheetResult(doc,result(20),result(0),60,70)).toBe(false);
});
describe('plate count priority',()=>{
  it('prefers fewer sheets before occupancy',()=>{
    const p=newPart([[0,0],[10,0],[10,10],[0,10]]);
    const doc:Document={name:'P',parts:[p],settings:{materialType:'sheet',materialWidthMm:50,materialLengthMm:40,clearanceMm:0,timeLimitSeconds:null}};
    const base:Result={documentRevision:1,solverRevision:'x',seed:'1',elapsedSeconds:1,sheetCount:2,usedLengthMm:80,placements:[{partId:p.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:1}],validation:{status:'passed',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
    const next={...base,sheetCount:1,usedLengthMm:40};
    expect(isBetterSheetResult(doc,next,base)).toBe(true);
  });
});
