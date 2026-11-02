import {expect,test} from 'vitest';
import {productionTotals} from '../src/geometry/production';
import {applySeriesMultiplier,documentPlacements} from '../src/geometry/placements';
import {normalizeDocument} from '../src/geometry/normalize';
import {importProject,exportProject} from '../src/import/project';
import {solverInput} from '../src/import/sparrow';
import {newPart,type Document,type Result} from '../src/model';

const a={...newPart([[0,0],[10,0],[10,10],[0,10]],'A'),id:'a',quantity:1};
const b={...newPart([[0,0],[20,0],[20,5],[0,5]],'B'),id:'b',quantity:2};
const doc:Document={name:'series',parts:[a,b],settings:{materialWidthMm:100,clearanceMm:0,timeLimitSeconds:30}};
const exampleResult={usedLengthMm:12.345,sheetCount:2} as Result;

test('production series changes real production counts, while keeping one layout for the solver',()=>{
  const x3=applySeriesMultiplier(doc,'3');
  expect(x3.seriesMultiplier).toBe('3');
  expect(x3.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(documentPlacements(x3)).toHaveLength(3);
  const input=JSON.parse(solverInput(x3)) as {items:{demand:number}[]};
  expect(input.items).toHaveLength(3);
  expect(input.items.every(item=>item.demand===1)).toBe(true);
  expect(productionTotals(doc).totalPieces).toBe('3');
  expect(productionTotals(x3).totalPieces).toBe('9');
  expect(productionTotals(x3,exampleResult).material).toEqual({amount:'37.035',unit:'mm'});
  expect(productionTotals({...x3,settings:{...x3.settings,materialType:'sheet'}},exampleResult).material)
    .toEqual({amount:'6',unit:'plaka'});

  const hugeCount='12345678901234567890123456789012345678901234567890';
  const huge=applySeriesMultiplier(x3,hugeCount);
  expect(huge.seriesMultiplier).toBe(hugeCount);
  expect(productionTotals(huge).totalPieces).toBe((3n*BigInt(hugeCount)).toString());
  expect(huge.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(documentPlacements(huge)).toHaveLength(3);
  expect(()=>applySeriesMultiplier(doc,'0')).toThrow();
});

test('series count is validated and persists in project files',()=>{
  const x3=applySeriesMultiplier(doc,'3');
  expect(()=>normalizeDocument({...x3,seriesMultiplier:0})).toThrow();
  const saved=exportProject(x3,1);
  const restored=importProject(saved).document;
  expect(restored.seriesMultiplier).toBe('3');
  expect(restored.seriesCountMode).toBe('production');
  expect(restored.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(productionTotals(restored).totalPieces).toBe('9');
});

test('production totals account for imported source entity groups',()=>{
  const withEntities={...doc,parts:[{...a,source:{...a.source,dxfSourceEntityCount:4}}]};
  expect(productionTotals(applySeriesMultiplier(withEntities,'5')).totalPieces).toBe('20');
});

test('legacy projects migrate expanded quantities into one series',()=>{
  const legacy={...doc,seriesMultiplier:3,parts:doc.parts.map(part=>({...part,quantity:part.quantity*3}))};
  const migrated=normalizeDocument(legacy);
  expect(migrated.seriesCountMode).toBe('production');
  expect(migrated.seriesMultiplier).toBe('3');
  expect(migrated.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(productionTotals(migrated).totalPieces).toBe('9');
});
