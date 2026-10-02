import {expect,test} from 'vitest';
import {applySeriesMultiplier,documentPlacements,maxSeriesMultiplier} from '../src/geometry/placements';
import {normalizeDocument} from '../src/geometry/normalize';
import {importProject,exportProject} from '../src/import/project';
import {solverInput} from '../src/import/sparrow';
import {newPart,type Document} from '../src/model';

const a={...newPart([[0,0],[10,0],[10,10],[0,10]],'A'),id:'a',quantity:1};
const b={...newPart([[0,0],[20,0],[20,5],[0,5]],'B'),id:'b',quantity:2};
const doc:Document={name:'series',parts:[a,b],settings:{materialWidthMm:100,clearanceMm:0,timeLimitSeconds:30}};

test('project series multiplier scales every existing part and can return to x1',()=>{
  const x3=applySeriesMultiplier(doc,3);
  expect(x3.seriesMultiplier).toBe(3);
  expect(x3.parts.map(part=>part.quantity)).toEqual([3,6]);
  expect(documentPlacements(x3)).toHaveLength(9);
  const input=JSON.parse(solverInput(x3)) as {items:{demand:number}[]};
  expect(input.items.map(item=>item.demand)).toEqual([3,6]);

  const x1=applySeriesMultiplier(x3,1);
  expect(x1.seriesMultiplier).toBeUndefined();
  expect(x1.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(documentPlacements(x1)).toHaveLength(3);
});

test('series multiplier respects the global 500-copy limit',()=>{
  expect(maxSeriesMultiplier(doc)).toBe(166);
  expect(()=>applySeriesMultiplier(doc,167)).toThrow('500');
});

test('series multiplier is validated and persists in project files',()=>{
  const x3=applySeriesMultiplier(doc,3);
  expect(()=>normalizeDocument({...x3,parts:x3.parts.map((part,index)=>index===0?{...part,quantity:4}:part)})).toThrow('Series multiplier');
  const saved=exportProject(x3,1);
  const restored=importProject(saved).document;
  expect(restored.seriesMultiplier).toBe(3);
  expect(restored.parts.map(part=>part.quantity)).toEqual([3,6]);
});
