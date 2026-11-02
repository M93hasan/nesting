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
  it('validates individual real screen components',()=>{
    const zoneStyles={header:{background:'#112233',color:'#aabbcc',radius:8,spacing:12,fontSize:16,shadow:12}};
    const parsed=parseDesignPayload({format:'serula-design-v1',design:{...design,workspaceOrder:['material','canvas','parts'],zoneStyles}});
    expect(parsed.design.zoneStyles).toEqual(zoneStyles);
    expect(parsed.design.workspaceOrder).toEqual(['material','canvas','parts']);
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,zoneStyles:{header:{background:'url(javascript:evil)'}}}})).toThrow();
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,zoneStyles:{evil:{background:'#123456'}}}})).toThrow();
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,zoneStyles:{parts:{shadow:500}}}})).toThrow();
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,workspaceOrder:['parts','parts','canvas']}})).toThrow();
  });
  it('accepts plain label text and rejects markup',()=>{
    expect(parseDesignPayload({format:'serula-design-v1',design:{...design,zoneStyles:{downloadButton:{text:'DXF KAYDET'}}}}).design.zoneStyles.downloadButton.text).toBe('DXF KAYDET');
    expect(()=>parseDesignPayload({format:'serula-design-v1',design:{...design,zoneStyles:{downloadButton:{text:'<script>'}}}})).toThrow();
  });
  it('accepts bounded action positions but rejects panel and oversized offsets',()=>{
    const payload=(zoneStyles)=>({format:'serula-design-v1',design:{...design,zoneStyles}});
    expect(parseDesignPayload(payload({downloadButton:{offsetX:60,offsetY:-40}})).design.zoneStyles.downloadButton).toEqual({offsetX:60,offsetY:-40});
    expect(()=>parseDesignPayload(payload({downloadButton:{offsetX:81}}))).toThrow();
    expect(()=>parseDesignPayload(payload({downloadButton:{offsetY:-81}}))).toThrow();
    expect(()=>parseDesignPayload(payload({canvas:{offsetX:20}}))).toThrow();
    expect(()=>parseDesignPayload(payload({runButton:{offsetX:2.5}}))).toThrow();
  });
  it('accepts addable components and rejects executable HTML, external links and duplicate IDs',()=>{
    const block={id:'widget-aaaa1111',kind:'button',region:'canvas',text:'Hizli baglanti',href:'/admin',fontSize:16,padding:12,x:20,y:0,devices:['desktop','mobile']};
    const input=(blocks)=>({format:'serula-design-v1',design:{...design,blocks}});
    expect(parseDesignPayload(input([block])).design.blocks).toEqual([block]);
    expect(()=>parseDesignPayload(input([{...block,href:'javascript:alert(1)'}]))).toThrow();
    expect(()=>parseDesignPayload(input([{...block,text:'<script>'}]))).toThrow();
    expect(()=>parseDesignPayload(input([{...block,x:1000}]))).toThrow();
    expect(()=>parseDesignPayload(input([block,block]))).toThrow();
    expect(()=>parseDesignPayload(input([{...block,unknownStyle:'position:fixed'}]))).toThrow();
  });
  it('rejects unknown format',()=>expect(()=>parseDesignPayload({format:'other',design})).toThrow());
});
