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
  expect(css).toContain('#root .canvas-tools button:not(:disabled):hover');
  expect(css).toContain('#root .cad-snapping summary:focus-visible');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('@media (prefers-contrast: more)');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('#root .admin-card');
  expect(css).toContain('backdrop-filter: none');
});

test('shared theme tokens have one owner and Liquid Glass only adds namespaced tokens',()=>{
  const premium=readFileSync(new URL('../src/premium-theme.css',import.meta.url),'utf8');
  const vision=readFileSync(new URL('../src/vision.css',import.meta.url),'utf8');
  const glass=readFileSync(new URL('../src/liquid-glass.css',import.meta.url),'utf8');
  const shared=['--page','--panel','--ink','--muted','--border','--accent','--accent-hover','--hover','--hover-border','--selected','--secondary','--error','--error-bg','--panel-soft','--panel-raised','--brand-gradient','--brand-gradient-hover','--surface-shadow','--radius-card','--radius-control','--font-ui'];
  for(const token of shared){
    expect(premium, `premium-theme.css owns ${token}`).toContain(token+':');
    expect(vision.split(String.fromCharCode(10)).some(line=>line.trimStart().startsWith(token+':')), `vision.css must not redeclare ${token}`).toBe(false);
  }
  expect(glass).toContain('--lg-glass-fill:');
  expect(glass).toContain('var(--panel)');
  expect(glass).toContain('var(--accent)');
});

test('phase 4 refines admin navigation, workspace hit areas, and appearance controls',()=>{
  const css=readFileSync(new URL('../src/liquid-glass.css',import.meta.url),'utf8');
  expect(css).toContain('#root .admin-sidebar nav button.active');
  expect(css).toContain('box-shadow: inset 3px 0 0 var(--accent)');
  expect(css).toContain('#root .canvas-tools button');
  expect(css).toContain('min-height: 42px');
  expect(css).toContain('#root .appearance-color:focus-within');
  expect(css).toContain('@media (max-width: 699px)');
  expect(css).toContain('#root .admin-page .admin-card');
});
