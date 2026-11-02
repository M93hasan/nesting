import {describe,it,expect} from 'vitest';
import {appearanceToPreviewTokens,SERULA_TOKEN_TARGETS} from './design-appearance-adapter';
describe('Serula appearance adapter',()=>{
  it('maps current colors without modifying the source',()=>{
    const original={background:'#AABBCC',panel:'#123456'};
    expect(appearanceToPreviewTokens(original)).toEqual({background:'#aabbcc',panel:'#123456'});
    expect(original.background).toBe('#AABBCC');
  });
  it('rejects unsafe or malformed values',()=>{
    expect(()=>appearanceToPreviewTokens({background:'red;url(x)',panel:'#111111'})).toThrow();
  });
  it('uses existing Serula appearance CSS variables',()=>{
    expect(SERULA_TOKEN_TARGETS.background).toBe('--appearance-background');
    expect(SERULA_TOKEN_TARGETS.panel).toBe('--appearance-panel');
  });
});
