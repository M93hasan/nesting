import {describe,expect,it} from 'vitest';
import {chooseAutomaticSolverThreads} from '../src/workers/autoThreads';

describe('automatic CPU worker selection',()=>{
  it.each([
    [1,1],[2,1],[3,1],[4,2],[5,2],[6,3],[8,3],[12,3],[24,3]
  ])('uses %i logical cores to select %i solver threads', (cores,threads)=>{
    expect(chooseAutomaticSolverThreads(cores,true,true)).toBe(threads);
  });
  it('requires both cross-origin isolation and shared WASM memory',()=>{
    for(const cores of [2,4,8,16]){
      expect(chooseAutomaticSolverThreads(cores,false,true)).toBe(1);
      expect(chooseAutomaticSolverThreads(cores,true,false)).toBe(1);
      expect(chooseAutomaticSolverThreads(cores,false,false)).toBe(1);
    }
  });
  it('falls back to one worker for unknown or invalid CPU counts',()=>{
    for(const cores of [undefined,0,-1,NaN,Infinity,3.5]){
      expect(chooseAutomaticSolverThreads(cores,true,true)).toBe(1);
    }
  });
});
