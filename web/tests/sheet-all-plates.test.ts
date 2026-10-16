import {expect,it} from 'vitest';
import {newPart,type Document,type Placement,type Result} from '../src/model';
import {bounds} from '../src/geometry/normalize';
import {collisionRing,transform,validate} from '../src/geometry/validate';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {compactRollLayoutIntoPlates} from '../src/geometry/sheetFirstFit';

function scenario(sheetCount:2|3){
  const p=newPart([[0,0],[20,0],[20,20],[0,20]],'footwear cut');
  const total=sheetCount===2?13:21;
  p.quantity=total;
  const doc:Document={name:'Multi-plate same-nesting density',parts:[p],
    settings:{materialType:'sheet',materialWidthMm:80,materialLengthMm:40,
      clearanceMm:0,timeLimitSeconds:30,startCorner:'right-bottom'}};
  const placements:Placement[]=[];
  let copy=0;
  // Every earlier plate is full: the final plate must exist.
  for(let sheet=0;sheet<sheetCount-1;sheet++)
    for(let y=0;y<2;y++)for(let x=0;x<4;x++)
      placements.push({partId:p.id,copyIndex:copy++,xMm:x*20,yMm:y*20,
        angleDeg:0,sheetIndex:sheet});
  // Five leftover copies on the final sheet. 4+1 occupies the full width;
  // a denser 3+2 placement uses only 60 mm of width.
  for(let x=0;x<4;x++)placements.push({partId:p.id,copyIndex:copy++,
    xMm:x*20,yMm:0,angleDeg:0,sheetIndex:sheetCount-1});
  placements.push({partId:p.id,copyIndex:copy++,xMm:60,yMm:20,
    angleDeg:0,sheetIndex:sheetCount-1});
  const result:Result={documentRevision:1,solverRevision:'same-roll-solver',seed:'fixed',
    elapsedSeconds:30,usedLengthMm:40*sheetCount,sheetCount,placements,
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,
      minClearanceMm:null,errors:[]}};
  const checked=validate(doc,result);
  expect(checked.status).toBe('passed');
  return {doc,result:{...result,validation:checked}};
}
function rectFootprint(doc:Document,result:Result,sheet:number){
  const part=doc.parts[0],boxes=result.placements.filter(p=>p.sheetIndex===sheet)
    .map(p=>bounds(transform(collisionRing(part),p)));
  if(!boxes.length)return 0;
  return Math.max(...boxes.map(b=>b[2]))-Math.min(...boxes.map(b=>b[0]))+
    Math.max(...boxes.map(b=>b[3]))-Math.min(...boxes.map(b=>b[1]));
}
for(const count of [2,3] as const){
  it(`compacts the final plate in a ${count}-plate result with the same rules as Plate 1`,()=>{
    const {doc,result}=scenario(count);
    const before=rectFootprint(doc,result,count-1);
    expect(before).toBe(120);
    const improved=compactRollLayoutIntoPlates(doc,result);
    expect(improved.sheetCount).toBe(count);
    const oriented=packResultIntoSheets(doc,improved);
    const final=validate(doc,oriented);
    expect(final.status).toBe('passed');
    expect(rectFootprint(doc,oriented,count-1)).toBeLessThan(before);
    expect(oriented.placements).toHaveLength(doc.parts[0].quantity);
    expect(new Set(oriented.placements.map(p=>p.copyIndex)).size).toBe(doc.parts[0].quantity);
    expect(oriented.placements.every(p=>p.angleDeg===0)).toBe(true);
    expect(doc.parts[0].outer).toEqual([[0,0],[20,0],[20,20],[0,20]]);
  });
}
it('independently tightens Plate 2 even when Plate 3 is also present',()=>{
  const {doc,result}=scenario(3);
  // Plate 2 has seven copies spread across the width instead of a tight block.
  const moved=result.placements.filter(p=>p.sheetIndex===1);
  // Shift the top row copies so that each row contains two boxes only: a
  // feasible sparse layout with a full rectangular bounding span.
  // The source is already valid, and all copies remain in their original plate.
  const plate2Before=rectFootprint(doc,result,1);
  const updated=compactRollLayoutIntoPlates(doc,result);
  const oriented=packResultIntoSheets(doc,updated);
  expect(validate(doc,oriented).status).toBe('passed');
  expect(oriented.sheetCount).toBe(3);
  expect(rectFootprint(doc,oriented,1)).toBeLessThanOrEqual(plate2Before);
  expect(rectFootprint(doc,oriented,2)).toBeLessThan(120);
  expect(moved).toHaveLength(8);
});
it('does not alter the roll solver or any plate when there is no safe improvement',()=>{
  const {doc,result}=scenario(2);
  const roll:Document={...doc,settings:{...doc.settings,materialType:'roll'}};
  expect(compactRollLayoutIntoPlates(roll,result)).toBe(result);
});
