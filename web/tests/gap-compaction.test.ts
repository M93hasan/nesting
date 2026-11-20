import {describe,expect,it} from 'vitest';
import {newPart,DEFAULT_SETTINGS,type Document,type Result} from '../src/model';
import {compactValidatedGaps} from '../src/geometry/gapCompaction';
import {validate} from '../src/geometry/validate';

const square=[[0,0],[1,0],[1,1],[0,1]] as [number,number][];
function fixture(clearance=0,materialType:'roll'|'sheet'='roll') {
  const part={...newPart(square),id:'square',quantity:2};
  const doc:Document={name:'gaps',parts:[part],settings:{
    ...DEFAULT_SETTINGS,materialWidthMm:12,materialType,clearanceMm:clearance,
    ...(materialType==='sheet'?{materialLengthMm:12}:{})
  }};
  const result:Result={documentRevision:1,solverRevision:'test',seed:'1',elapsedSeconds:1,
    usedLengthMm:12,
    ...(materialType==='sheet'?{sheetCount:1}:{}),
    placements:[
      {partId:'square',copyIndex:0,xMm:1,yMm:0,angleDeg:0},
      {partId:'square',copyIndex:1,xMm:8,yMm:0,angleDeg:0}
    ],
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}
  };
  result.validation=validate(doc,result);
  expect(result.validation.status).toBe('passed');
  return {doc,result};
}
describe('safe roll gap compaction',()=>{
  it('brings two separated DXF-like contours closer without changing geometry or used length',()=>{
    const {doc,result}=fixture();
    const compacted=compactValidatedGaps(doc,result);
    const beforeGap=result.placements[1].xMm-result.placements[0].xMm-1;
    const afterGap=Math.abs(compacted.placements[1].xMm-compacted.placements[0].xMm)-1;
    expect(afterGap).toBeLessThan(beforeGap);
    expect(compacted.usedLengthMm).toBe(result.usedLengthMm);
    expect(compacted.placements.map(p=>[p.partId,p.copyIndex,p.angleDeg])).toEqual(result.placements.map(p=>[p.partId,p.copyIndex,p.angleDeg]));
    expect(validate(doc,compacted).status).toBe('passed');
  });
  it('preserves positive clearance and rejects collisions',()=>{
    const {doc,result}=fixture(2);
    const compacted=compactValidatedGaps(doc,result);
    expect(validate(doc,compacted).status).toBe('passed');
    expect(Math.abs(compacted.placements[1].xMm-compacted.placements[0].xMm)).toBeGreaterThanOrEqual(3-0.01);
  });
  it('preserves concave DXF contours, fixed angles and clearance while testing two-axis gaps',()=>{
    const lShape={...newPart([[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]]),id:'concave',quantity:1};
    const insert={...newPart([[0,0],[1.5,0],[1.5,1.5],[0,1.5]]),id:'insert',quantity:1};
    const doc:Document={name:'concave DXF gap',parts:[lShape,insert],
      settings:{...DEFAULT_SETTINGS,materialWidthMm:14,clearanceMm:0.2}};
    const input:Result={documentRevision:1,solverRevision:'test',seed:'2',elapsedSeconds:1,
      usedLengthMm:14,placements:[
        {partId:'concave',copyIndex:0,xMm:2,yMm:0,angleDeg:0,orientationLocked:true},
        {partId:'insert',copyIndex:0,xMm:10,yMm:8,angleDeg:0}
      ],validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
    input.validation=validate(doc,input);
    expect(input.validation.status).toBe('passed');
    const output=compactValidatedGaps(doc,input);
    expect(validate(doc,output).status).toBe('passed');
    expect(output.usedLengthMm).toBe(input.usedLengthMm);
    expect(output.placements[0].orientationLocked).toBe(true);
    expect(output.placements.map(p=>p.angleDeg)).toEqual([0,0]);
    expect(doc.parts[0].outer).toEqual(lShape.outer);
    expect(doc.parts[1].outer).toEqual(insert.outer);
  });
  it('does not change fixed-sheet placement',()=>{
    const {doc,result}=fixture(0,'sheet');
    expect(compactValidatedGaps(doc,result)).toBe(result);
  });
  it('does not modify unvalidated candidate layouts',()=>{
    const {doc,result}=fixture();
    const pending={...result,validation:{...result.validation,status:'pending' as const}};
    expect(compactValidatedGaps(doc,pending)).toBe(pending);
  });
});
