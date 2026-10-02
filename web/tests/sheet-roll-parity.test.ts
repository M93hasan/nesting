import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {DEFAULT_SETTINGS,newPart,type Document,type Result} from '../src/model';
import {solverInput} from '../src/import/sparrow';
import {packResultIntoSheets} from '../src/geometry/multiSheet';

test('sheet mode sends the same geometry, copies and solver input as roll mode',()=>{
  const part={...newPart([[0,0],[4,0],[4,3],[0,3]]),id:'copy-source',quantity:3};
  const roll:Document={name:'same-input',parts:[part],settings:{...DEFAULT_SETTINGS,materialType:'roll',materialWidthMm:20,clearanceMm:.3,timeLimitSeconds:30}};
  const sheet:Document={...roll,settings:{...roll.settings,materialType:'sheet',materialLengthMm:10}};
  expect(solverInput(sheet)).toBe(solverInput(roll));
  const input=JSON.parse(solverInput(sheet));
  expect(input.items).toHaveLength(1);
  expect(input.items[0].demand).toBe(3);
});

test('sheet post-processing preserves roll copies and only assigns plate numbers',()=>{
  const part={...newPart([[0,0],[4,0],[4,4],[0,4]]),id:'copies',quantity:3};
  const doc:Document={name:'plates',parts:[part],settings:{...DEFAULT_SETTINGS,materialType:'sheet',materialWidthMm:20,materialLengthMm:10,clearanceMm:0,startCorner:'right-bottom'}};
  const result:Result={documentRevision:1,solverRevision:'test',seed:'1',elapsedSeconds:1,usedLengthMm:18,
    placements:[
      {partId:part.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0},
      {partId:part.id,copyIndex:1,xMm:0,yMm:7,angleDeg:0},
      {partId:part.id,copyIndex:2,xMm:0,yMm:14,angleDeg:0}
    ],
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  const packed=packResultIntoSheets(doc,result);
  expect(packed.placements).toHaveLength(3);
  expect(packed.placements.map(p=>p.copyIndex)).toEqual([0,1,2]);
  expect(packed.placements.map(p=>p.partId)).toEqual([part.id,part.id,part.id]);
  expect(packed.placements.map(p=>p.sheetIndex)).toEqual([0,0,1]);
  expect(packed.sheetCount).toBe(2);
});

test('solver runtime has no sheet-only batching or second nesting path',()=>{
  const runtime=readFileSync(new URL('../src/workers/solver-runtime.worker.ts',import.meta.url),'utf8');
  expect(runtime).not.toContain('solveSheetMode');
  expect(runtime).not.toContain('batchCounts');
  expect(runtime).not.toContain("materialType==='sheet'");
  expect(runtime).toContain('const input=doc?solverInput(doc)');
});
