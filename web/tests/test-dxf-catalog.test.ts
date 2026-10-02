import {readdirSync,readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('generated Test DXF catalog always matches every DXF in the folder',()=>{
  const root=new URL('../public/examples/test klasoru dxf/',import.meta.url);
  const expected=readdirSync(root).filter(name=>/\.dxf$/i.test(name))
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
  const catalog=JSON.parse(readFileSync(new URL('catalog.json',root),'utf8')) as {files:string[]};
  expect(catalog.files).toEqual(expected);
  expect(catalog.files).toContain('1006.dxf');
  expect(catalog.files).toContain('bez.dxf');
});
