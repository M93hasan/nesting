import {expect,test} from 'vitest';
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
