import {expect,test} from 'vitest';
import {applySeriesMultiplier,documentPlacements} from '../src/geometry/placements';
import {normalizeDocument} from '../src/geometry/normalize';
import {importProject,exportProject} from '../src/import/project';
import {solverInput} from '../src/import/sparrow';
import {newPart,type Document} from '../src/model';

const a={...newPart([[0,0],[10,0],[10,10],[0,10]],'A'),id:'a',quantity:1};
const b={...newPart([[0,0],[20,0],[20,5],[0,5]],'B'),id:'b',quantity:2};
const doc:Document={name:'series',parts:[a,b],settings:{materialWidthMm:100,clearanceMm:0,timeLimitSeconds:30}};

test('production series count can grow without expanding the nesting layout',()=>{
  const x3=applySeriesMultiplier(doc,3);
  expect(x3.seriesMultiplier).toBe(3);
  expect(x3.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(documentPlacements(x3)).toHaveLength(3);
  const input=JSON.parse(solverInput(x3)) as {items:{demand:number}[]};
  expect(input.items).toHaveLength(3);
  expect(input.items.every(item=>item.demand===1)).toBe(true);

  const huge=applySeriesMultiplier(x3,1_000_000_000);
  expect(huge.seriesMultiplier).toBe(1_000_000_000);
  expect(huge.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(documentPlacements(huge)).toHaveLength(3);
  expect(()=>applySeriesMultiplier(doc,Number.MAX_SAFE_INTEGER+1)).toThrow();
});

test('series count is validated and persists in project files',()=>{
  const x3=applySeriesMultiplier(doc,3);
  expect(()=>normalizeDocument({...x3,seriesMultiplier:0})).toThrow();
  const saved=exportProject(x3,1);
  const restored=importProject(saved).document;
  expect(restored.seriesMultiplier).toBe(3);
  expect(restored.seriesCountMode).toBe('production');
  expect(restored.parts.map(part=>part.quantity)).toEqual([1,2]);
});

test('legacy projects migrate expanded quantities into one series',()=>{
  const legacy={...doc,seriesMultiplier:3,parts:doc.parts.map(part=>({...part,quantity:part.quantity*3}))};
  const migrated=normalizeDocument(legacy);
  expect(migrated.seriesCountMode).toBe('production');
  expect(migrated.seriesMultiplier).toBe(3);
  expect(migrated.parts.map(part=>part.quantity)).toEqual([1,2]);
});
