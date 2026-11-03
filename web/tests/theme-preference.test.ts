import {afterEach,describe,expect,it,vi} from 'vitest';
import {readThemePreference} from '../src/theme-preference';

afterEach(()=>vi.unstubAllGlobals());
describe('Serula theme preference',()=>{
  it('defaults to light when storage is absent, inaccessible or invalid',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>null});
    expect(readThemePreference()).toBe('light');
    vi.stubGlobal('localStorage',{getItem:()=>'{corrupt}'});
    expect(readThemePreference()).toBe('light');
    vi.stubGlobal('localStorage',{getItem:()=>{throw Error('storage unavailable')}});
    expect(readThemePreference()).toBe('light');
  });
  it('retains all supported stored preferences without resetting user choice',()=>{
    for(const choice of ['light','dark','system'] as const){
      vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='serula-theme'?choice:null});
      expect(readThemePreference()).toBe(choice);
    }
  });
});
