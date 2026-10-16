import {describe,expect,it} from 'vitest';
import {compactRollGaps} from '../src/geometry/gapFill';
import {newPart,type Document,type Result} from '../src/model';
import {validate} from '../src/geometry/validate';

const sample=():{doc:Document;result:Result}=>{
  const part=newPart([[0,0],[20,0],[20,10],[0,10]],'heel');
  part.quantity=3;
  const doc:Document={name:'Gap fill',parts:[part],settings:{materialWidthMm:65,clearanceMm:0,timeLimitSeconds:null,materialType:'roll'}};
  const placements=[
    {partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0},
    {partId:part.id,copyIndex:1,xMm:20,yMm:0,angleDeg:0},
    {partId:part.id,copyIndex:2,xMm:0,yMm:20,angleDeg:0}
  ];
  const result:Result={documentRevision:1,solverRevision:'5901a79b6c5a74d8b9c356ee2916736567308108',
    seed:'1',elapsedSeconds:2,usedLengthMm:30,placements,
    validation:{status:'passed',source:'solver',errors:[],overlapAreaMm2:null,maxBoundaryViolationMm:null,minClearanceMm:null}};
  return{doc,result};
};
describe('post-nesting gap compaction',()=>{
  it('moves a tail piece into vacant space and decreases strip length',()=>{
    const {doc,result}=sample();
    const next=compactRollGaps(doc,result,5000);
    expect(next.usedLengthMm).toBeLessThan(result.usedLengthMm);
    expect(next.validation.status).toBe('passed');
    expect(validate(doc,next).status).toBe('passed');
    expect(next.placements).toHaveLength(result.placements.length);
    expect(next.placements.map(p=>p.angleDeg)).toEqual(result.placements.map(p=>p.angleDeg));
    expect(doc.parts[0].outer).toEqual([[0,0],[20,0],[20,10],[0,10]]);
  });
  it('does not touch fixed sheet layouts',()=>{
    const {doc,result}=sample();
    doc.settings.materialType='sheet';doc.settings.materialLengthMm=30;
    expect(compactRollGaps(doc,result)).toBe(result);
  });
  it('does not alter a one-part layout',()=>{
    const {doc,result}=sample();doc.parts[0].quantity=1;result.placements=result.placements.slice(0,1);
    expect(compactRollGaps(doc,result)).toBe(result);
  });
});
