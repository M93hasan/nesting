import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('workspace keeps material dimensions visible before and after nesting',()=>{
  const source=readFileSync(new URL('../src/components/Workspace.tsx',import.meta.url),'utf8');
  expect(source).toContain('data-material-frame="sheet"');
  expect(source).toContain('className="material-size-badge"');
  expect(source).toContain("const showGenişlik = validMaterialWidth && (materialType==='roll' || materialWidthFocused)");
  expect(source).toContain("Plaka {sheet+1} ·");
  expect(source).toContain("Rulo · genişlik");
});
