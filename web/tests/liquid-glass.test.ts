import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('Liquid Glass layer is loaded after the existing theme layers',()=>{
  const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  expect(entry.indexOf("import './premium-theme.css'")).toBeGreaterThanOrEqual(0);
  expect(entry.indexOf("import './liquid-glass.css'")).toBeGreaterThan(entry.indexOf("import './premium-theme.css'"));
});

test('Liquid Glass is limited to navigation and floating controls with accessible fallbacks',()=>{
  const css=readFileSync(new URL('../src/liquid-glass.css',import.meta.url),'utf8');
  expect(css).toContain('#root .header');
  expect(css).toContain('#root .admin-topbar');
  expect(css).toContain('#root .canvas-tools');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('@media (prefers-contrast: more)');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('#root .admin-card');
  expect(css).toContain('backdrop-filter: none');
});
