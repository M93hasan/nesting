import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {qualityAttempts} from '../src/workers/solverQuality';

test('standard quality splits a 30 second budget across two deterministic seeds',()=>{
  const attempts=qualityAttempts('42',30,'standard');
  expect(attempts.map(a=>a.seconds)).toEqual([20,10]);
  expect(attempts.reduce((sum,a)=>sum+(a.seconds??0),0)).toBe(30);
  expect(new Set(attempts.map(a=>a.seed)).size).toBe(2);
  expect(qualityAttempts('42',30,'standard')).toEqual(attempts);
});

test('long quality runs add a third seed without exceeding the requested budget',()=>{
  const attempts=qualityAttempts('42',120,'standard');
  expect(attempts.map(a=>a.seconds)).toEqual([60,40,20]);
  expect(attempts.reduce((sum,a)=>sum+(a.seconds??0),0)).toBe(120);
  expect(new Set(attempts.map(a=>a.seed)).size).toBe(3);
});

test('fast and automatic runs remain single-attempt',()=>{
  expect(qualityAttempts('42',30,'fast')).toEqual([{seed:'42',seconds:30}]);
  expect(qualityAttempts('42',null,'standard')).toEqual([{seed:'42',seconds:null}]);
  expect(qualityAttempts('42',10,'standard')).toEqual([{seed:'42',seconds:10}]);
});

// Regression: a stop received between quality seeds must not be wiped out.
test('worker preserves stop signals between quality attempts',()=>{
  const worker=readFileSync(new URL('../src/workers/solver-runtime.worker.ts',import.meta.url),'utf8');
  expect(worker).toContain("index>0 && Atomics.load(control,0)===1");
  expect(worker).toContain("Atomics.compareExchange(control,0,-1,0)");
  expect(worker).not.toContain('if(control)Atomics.store(control,0,0);');
});
