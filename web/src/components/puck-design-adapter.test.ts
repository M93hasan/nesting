import {describe,it,expect} from 'vitest';
import {DEFAULT_STUDIO_DESIGN,fromPuckData,parseStudioDesign,toPuckData} from './puck-design-adapter';

describe('Puck design adapter',()=>{
  it('preserves legacy design while reordering real workspace panels',()=>{
    const baseline={...DEFAULT_STUDIO_DESIGN,hidden:['Başlık'],positions:{'Ana panel':{x:12,y:8}},zoneStyles:{downloadButton:{text:'DXF KAYDET',offsetX:23},parts:{radius:18}}};
    const data=toPuckData(baseline);
    const p=data.content.find(x=>x.props.zone==='parts');
    expect(p?.props).toMatchObject({radius:18});
    const moved=[data.content[0],data.content[3],data.content[2],data.content[1],...data.content.slice(4)];
    const after=fromPuckData({...data,content:moved},baseline);
    expect(after?.workspaceOrder).toEqual(['material','canvas','parts']);
    expect(after?.hidden).toEqual(['Başlık']);
    expect(after?.positions).toEqual({'Ana panel':{x:12,y:8}});
    expect(after?.zoneStyles?.downloadButton?.text).toBe('DXF KAYDET');
  });
  it('keeps saved drafts in the old server schema without Puck JSON',()=>{
    const data=toPuckData(DEFAULT_STUDIO_DESIGN);
    data.root.props.radius=25;
    const design=fromPuckData(data,DEFAULT_STUDIO_DESIGN);
    expect(design?.radius).toBe(25);
    expect(JSON.stringify(design)).not.toContain('"content"');
    expect(parseStudioDesign(design)).toMatchObject({radius:25,workspaceOrder:['parts','canvas','material']});
  });
  it('rejects arbitrary components, replacement ids and repeated zones',()=>{
    const data=toPuckData(DEFAULT_STUDIO_DESIGN);
    const altered=JSON.parse(JSON.stringify(data));
    altered.content[0].type='Script';
    expect(fromPuckData(altered,DEFAULT_STUDIO_DESIGN)).toBeNull();
    altered.content[0].type='Zone';
    altered.content[0].props.id='serula-other';
    expect(fromPuckData(altered,DEFAULT_STUDIO_DESIGN)).toBeNull();
    altered.content[0]=altered.content[1];
    expect(fromPuckData(altered,DEFAULT_STUDIO_DESIGN)).toBeNull();
  });
  it('drops hostile style input and will not preserve arbitrary CSS/HTML',()=>{
    const data=toPuckData(DEFAULT_STUDIO_DESIGN);
    const altered=JSON.parse(JSON.stringify(data));
    altered.content[5].props.text='<script>alert(1)</script>';
    altered.content[5].props.background='url(javascript:evil)';
    altered.content[5].props.offsetX=1000;
    const result=fromPuckData(altered,DEFAULT_STUDIO_DESIGN);
    expect(result?.zoneStyles).toEqual({});
    expect(JSON.stringify(result)).not.toMatch(/script|javascript/);
  });
  it('refuses malformed root colors and dimensions',()=>{
    const data=toPuckData(DEFAULT_STUDIO_DESIGN);
    expect(fromPuckData({...data,root:{props:{...data.root.props,background:'red'}}},DEFAULT_STUDIO_DESIGN)).toBeNull();
    expect(fromPuckData({...data,root:{props:{...data.root.props,radius:1000}}},DEFAULT_STUDIO_DESIGN)).toBeNull();
  });
});
