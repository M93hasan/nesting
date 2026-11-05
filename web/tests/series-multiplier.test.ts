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

test('production series multiplies actual solver and DXF copy quantities',()=>{
  const x2=applySeriesMultiplier(doc,'2');
  expect(x2.seriesMultiplier).toBe('2');
  expect(x2.seriesCountMode).toBe('expanded');
  expect(x2.parts.map(part=>part.quantity)).toEqual([2,4]);
  expect(documentPlacements(x2)).toHaveLength(6);
  const input=JSON.parse(solverInput(x2)) as {items:{demand:number}[]};
  expect(input.items).toHaveLength(6);
  expect(input.items.every(item=>item.demand===1)).toBe(true);
  expect(productionTotals(doc).totalPieces).toBe('3');
  expect(productionTotals(x2)).toMatchObject({piecesPerSeries:'3',totalPieces:'6'});
  // The material amount comes from the new, full 6-copy nesting result.
  expect(productionTotals(x2,exampleResult).material).toEqual({amount:'12.345',unit:'mm'});
  expect(productionTotals({...x2,settings:{...x2.settings,materialType:'sheet'}},exampleResult).material)
    .toEqual({amount:'2',unit:'plaka'});
  const x3=applySeriesMultiplier(x2,'3');
  expect(x3.parts.map(part=>part.quantity)).toEqual([3,6]);
  expect(documentPlacements(x3)).toHaveLength(9);
  expect(productionTotals(x3).totalPieces).toBe('9');
  const backToOne=applySeriesMultiplier(x3,'1');
  expect(backToOne.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(documentPlacements(backToOne)).toHaveLength(3);
  expect(productionTotals(backToOne).totalPieces).toBe('3');
  expect(()=>applySeriesMultiplier(doc,'167')).toThrow(/500/);
  expect(()=>applySeriesMultiplier(doc,'0')).toThrow();
});

test('series count is validated and persists in project files',()=>{
  const x3=applySeriesMultiplier(doc,'3');
  expect(()=>normalizeDocument({...x3,seriesMultiplier:0})).toThrow();
  const saved=exportProject(x3,1);
  const restored=importProject(saved).document;
  expect(restored.seriesMultiplier).toBe('3');
  expect(restored.seriesCountMode).toBe('expanded');
  expect(restored.parts.map(part=>part.quantity)).toEqual([3,6]);
  expect(productionTotals(restored).totalPieces).toBe('9');
});

test('production totals account for imported source entity groups',()=>{
  const withEntities={...doc,parts:[{...a,source:{...a.source,dxfSourceEntityCount:4}}]};
  expect(productionTotals(applySeriesMultiplier(withEntities,'5')).totalPieces).toBe('20');
  expect(applySeriesMultiplier(withEntities,'5').parts[0].quantity).toBe(5);
});

test('legacy projects migrate expanded quantities into one series',()=>{
  const legacy={...doc,seriesMultiplier:3,parts:doc.parts.map(part=>({...part,quantity:part.quantity*3}))};
  const migrated=normalizeDocument(legacy);
  expect(migrated.seriesCountMode).toBe('production');
  expect(migrated.seriesMultiplier).toBe('3');
  expect(migrated.parts.map(part=>part.quantity)).toEqual([1,2]);
  expect(productionTotals(migrated).totalPieces).toBe('9');
  const expanded=applySeriesMultiplier(migrated,'3');
  expect(expanded.parts.map(part=>part.quantity)).toEqual([3,6]);
  expect(productionTotals(expanded).totalPieces).toBe('9');
});
