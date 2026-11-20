import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS, type Document } from '../src/model';
import { hasInvalidNestingSettings, reconcileExpandedSeries } from '../src/domain/project/nestingDocumentRules';

const part=(quantity:number)=>({
  id:'a',name:'a',source:{format:'drawn' as const},outer:[[0,0],[10,0],[10,10],[0,10]] as [number,number][],
  holes:[],approximationToleranceMm:0,quantity,
  rotations:{kind:'discrete' as const,degrees:[0,180]},preparationPosition:[0,0] as [number,number],
});
const doc:Document={name:'d',parts:[part(2)],settings:{...DEFAULT_SETTINGS,materialWidthMm:100,clearanceMm:1}};

test('settings validation preserves roll and sheet manufacturing boundaries',()=>{
  expect(hasInvalidNestingSettings(doc,true)).toBe(false);
  expect(hasInvalidNestingSettings(doc,false)).toBe(true);
  expect(hasInvalidNestingSettings({...doc,settings:{...doc.settings,materialType:'sheet'}},true)).toBe(true);
  expect(hasInvalidNestingSettings({...doc,settings:{...doc.settings,materialType:'sheet',materialLengthMm:200}},true)).toBe(false);
  expect(hasInvalidNestingSettings({...doc,settings:{...doc.settings,clearanceMm:100}},true)).toBe(true);
  expect(hasInvalidNestingSettings({...doc,parts:[part(501)]},true)).toBe(true);
});

test('editing an expanded series resets the prior multiplier without mutating source',()=>{
  const original={...doc,seriesCountMode:'expanded' as const,seriesMultiplier:3};
  const edited={...original,parts:[part(7)]};
  const reconciled=reconcileExpandedSeries(original,edited);
  expect(reconciled.seriesMultiplier).toBeUndefined();
  expect(edited.seriesMultiplier).toBe(3);
  expect(reconciled.parts).toBe(edited.parts);
});

test('no quantity edit keeps the same document reference',()=>{
  const original={...doc,seriesCountMode:'expanded' as const,seriesMultiplier:3};
  expect(reconcileExpandedSeries(original,{...original,settings:{...original.settings,clearanceMm:2}}).seriesMultiplier).toBe(3);
  expect(reconcileExpandedSeries(original,original)).toBe(original);
});
