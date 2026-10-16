import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {fillSheetGaps} from '../src/geometry/sheetGapFill';
import {validate} from '../src/geometry/validate';
import {newPart,type Document,type Result,type Ring} from '../src/model';

const circle=(segments:number):Ring=>Array.from({length:segments},(_,i)=>{
  const radians=2*Math.PI*i/segments;
  return [5+5*Math.cos(radians),5+5*Math.sin(radians)];
});

it('compacts dense DXF-style circles that previously disabled plate gap filling at >700 vertices',()=>{
  const part=newPart(circle(740),'Dense spline-derived contour');part.quantity=3;
  const doc:Document={name:'Heavy CAD sheet packing',parts:[part],
    settings:{materialType:'sheet',materialWidthMm:32,materialLengthMm:22,
      clearanceMm:0,startCorner:'right-bottom',timeLimitSeconds:null}};
  const original:Result={documentRevision:1,solverRevision:'regression',seed:'123',
    elapsedSeconds:1,usedLengthMm:44,sheetCount:2,
    placements:[
      {partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:part.id,copyIndex:1,xMm:12,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:part.id,copyIndex:2,xMm:0,yMm:0,angleDeg:0,sheetIndex:1}
    ],
    validation:{status:'passed',source:'local',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  expect(validate(doc,original).status).toBe('passed');
  const packed=fillSheetGaps(doc,original,1200);
  expect(packed.sheetCount).toBe(1);
  expect(packed.usedLengthMm).toBe(22);
  expect(packed.placements).toHaveLength(3);
  expect(packed.placements.map(x=>x.copyIndex)).toEqual([0,1,2]);
  expect(packed.placements.every(p=>p.sheetIndex===0)).toBe(true);
  expect(validate(doc,packed).status).toBe('passed');
  expect(part.outer).toEqual(circle(740));
});

it('never compacts a physical plate when the bounding boxes have no safe room',()=>{
  const part=newPart(circle(740),'Large ring');part.quantity=2;
  const doc:Document={name:'Full sheet',parts:[part],settings:{
    materialType:'sheet',materialWidthMm:10,materialLengthMm:10,
    clearanceMm:0,startCorner:'right-bottom',timeLimitSeconds:null}};
  const original:Result={documentRevision:1,solverRevision:'regression',seed:'1',
    elapsedSeconds:2,usedLengthMm:20,sheetCount:2,
    placements:[
      {partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:part.id,copyIndex:1,xMm:0,yMm:0,angleDeg:0,sheetIndex:1}
    ],
    validation:{status:'passed',source:'local',overlapAreaMm2:0,
      maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  expect(validate(doc,original).status).toBe('passed');
  const improved=fillSheetGaps(doc,original,1000);
  expect(improved.sheetCount).toBe(2);
  expect(improved.placements.map(p=>p.sheetIndex)).toEqual([0,1]);
  doc.settings.materialType='roll';
  expect(fillSheetGaps(doc,original)).toBe(original);
});

it('shows plate 1 above plate 2 without modifying solver sheet indices',()=>{
  const code=readFileSync(new URL('../src/components/Workspace.tsx',import.meta.url),'utf8');
  expect(code).toContain('(result.sheetCount??1)-1-(placement.sheetIndex??0)');
  expect(code).toContain('((result!.sheetCount??1)-1-sheet)');
});
