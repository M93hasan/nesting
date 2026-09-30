import {expect,test,vi} from 'vitest';
import {DEFAULT_SETTINGS,example,newPartId} from '../src/model';
import {wallClockLimitSeconds} from '../src/workers/useSolver';

test('part IDs and examples work without secure-context crypto APIs',()=>{
  const getRandomValues=crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto',{getRandomValues});
  try {
    const ids=[newPartId(),...example().parts.map(part=>part.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for(const id of ids)expect(id).toMatch(/^[0-9a-f]{32}$/);
  } finally {vi.unstubAllGlobals();}
});


test('Serula defaults to zero clearance and a 59-second automatic nesting limit',()=>{
  expect(DEFAULT_SETTINGS.clearanceMm).toBe(0);
  expect(wallClockLimitSeconds({name:'test',parts:[],settings:{...DEFAULT_SETTINGS}})).toBe(59);
  expect(wallClockLimitSeconds({name:'test',parts:[],settings:{...DEFAULT_SETTINGS,timeLimitSeconds:30}})).toBe(30);
});
