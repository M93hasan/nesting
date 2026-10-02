import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('project series field supports direct keyboard entry before applying',()=>{
  const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  expect(source).toContain('aria-label="Proje seri adedi"');
  expect(source).toContain('type="text"');
  expect(source).toContain('pattern="[0-9]*"');
  expect(source).toContain("if(/^\\d*$/.test(e.target.value))setSeriesDraft(e.target.value)");
  expect(source).toContain('onBlur={finishSeriesEdit}');
  expect(source).toContain("if(e.key==='Enter')");
});
