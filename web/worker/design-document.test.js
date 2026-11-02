import {describe,it,expect} from 'vitest';
import {parseDesignPayload} from './design-document.js';
const design={background:'#121421',panel:'#242935',accent:'#5278ed',radius:12,spacing:16,fontSize:15,heading:'Demo',order:['Başlık','Ana panel','Birincil buton'],hidden:[]};
describe('isolated design document validation',()=>{
  it('accepts valid allowlisted schema',()=>expect(parseDesignPayload({format:'serula-design-v1',design}).design).toEqual(design));
  it('rejects executable or unknown fields',()=>expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,script:'alert(1)'}})).toThrow());
  it('rejects invalid styles and broken hierarchy',()=>{
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,background:'url(https://bad)'}})).toThrow();
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,order:['Birincil buton','Ana panel','Başlık']}})).toThrow();
  });
  it('validates bounded drag-and-drop coordinates',()=>{
    expect(parseDesignPayload({format:'serula-design-v1',design:{...design,positions:{'Ana panel':{x:40,y:25}}}}).design.positions).toEqual({'Ana panel':{x:40,y:25}});
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,positions:{'Ana panel':{x:999,y:25}}}})).toThrow();
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,positions:{evil:{x:1,y:1}}}})).toThrow();
  });
  it('rejects unknown format',()=>expect(()=>parseDesignPayload({format:'other',design})).toThrow());
});
