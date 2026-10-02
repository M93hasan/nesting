import {expect,test} from 'vitest';
import {DEFAULT_SETTINGS,newPart,type Document,type Result} from '../src/model';
import {improveSheetPacking} from '../src/geometry/sheetOptimizer';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {validate} from '../src/geometry/validate';

test('sheet BLF can remove a sparsely used final plate while preserving allowed rotations',()=>{
  const parts=[
    {...newPart([[0,0],[6,0],[6,4],[0,4]],'A'),id:'a',quantity:1,rotations:{kind:'discrete' as const,degrees:[0,180]}},
    {...newPart([[0,0],[4,0],[4,4],[0,4]],'B'),id:'b',quantity:1,rotations:{kind:'discrete' as const,degrees:[0,180]}},
    {...newPart([[0,0],[4,0],[4,4],[0,4]],'C'),id:'c',quantity:1,rotations:{kind:'discrete' as const,degrees:[0,180]}},
    {...newPart([[0,0],[2,0],[2,4],[0,4]],'D'),id:'d',quantity:1,rotations:{kind:'discrete' as const,degrees:[0,180]}},
  ];
  const doc:Document={name:'sheet-blf',parts,settings:{...DEFAULT_SETTINGS,materialType:'sheet',materialWidthMm:10,materialLengthMm:8,clearanceMm:0,startCorner:'right-bottom'}};
  const baseline:Result={documentRevision:1,solverRevision:'test',seed:'1',elapsedSeconds:1,usedLengthMm:24,sheetCount:3,
    placements:[
      {partId:'a',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:'b',copyIndex:0,xMm:6,yMm:0,angleDeg:0,sheetIndex:0},
      {partId:'c',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:1},
      {partId:'d',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:2},
    ],
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  expect(validate(doc,baseline).status).toBe('passed');
  const improved=improveSheetPacking(doc,baseline);
  expect(improved.sheetCount).toBe(2);
  expect(improved.usedLengthMm).toBe(16);
  expect(improved.placements.every(p=>p.angleDeg===0||p.angleDeg===180)).toBe(true);
  expect(validate(doc,packResultIntoSheets(doc,improved)).status).toBe('passed');
});

test('sheet BLF never broadens a restricted rotation rule',()=>{
  const part={...newPart([[0,0],[9,0],[9,6],[0,6]],'Restricted'),id:'restricted',quantity:1,
    rotations:{kind:'discrete' as const,degrees:[0,180]}};
  const doc:Document={name:'restricted',parts:[part],settings:{...DEFAULT_SETTINGS,materialType:'sheet',materialWidthMm:8,materialLengthMm:10,clearanceMm:0}};
  const result:Result={documentRevision:1,solverRevision:'test',seed:'1',elapsedSeconds:1,usedLengthMm:10,sheetCount:1,
    placements:[{partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0}],
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  // Baseline is intentionally invalid for the selected width. The optimizer must
  // not rotate 90° just to make it fit.
  const improved=improveSheetPacking(doc,result);
  expect(improved.placements[0].angleDeg).toBe(0);
});

test('roll mode is returned byte-for-byte without sheet BLF changes',()=>{
  const part={...newPart([[0,0],[2,0],[2,2],[0,2]]),id:'roll',quantity:1};
  const doc:Document={name:'roll',parts:[part],settings:{...DEFAULT_SETTINGS,materialType:'roll',materialWidthMm:10}};
  const result:Result={documentRevision:1,solverRevision:'test',seed:'1',elapsedSeconds:1,usedLengthMm:2,
    placements:[{partId:'roll',copyIndex:0,xMm:0,yMm:0,angleDeg:0}],
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  expect(improveSheetPacking(doc,result)).toBe(result);
});
