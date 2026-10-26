import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('legacy theme styles are no longer loaded by application pages',()=>{
  const entry=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const googleLogin=readFileSync(new URL('../public/google-login.html',import.meta.url),'utf8');
  const settings=readFileSync(new URL('../public/settings.html',import.meta.url),'utf8');
  const actions=readFileSync(new URL('../public/actions.html',import.meta.url),'utf8');
  const bridge=readFileSync(new URL('../bridge.html',import.meta.url),'utf8');
  for(const page of [entry,googleLogin,settings,actions,bridge]){
    expect(page).not.toContain('/theme/index.css');
  }
  expect(settings).not.toContain('<style>');
  expect(actions).not.toContain('<style>');
});

test('Liquid Glass is limited to navigation and floating controls with accessible fallbacks',()=>{
  const css=readFileSync(new URL('../public/theme/theme.css',import.meta.url),'utf8');
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
  const premium=readFileSync(new URL('../public/theme/theme.css',import.meta.url),'utf8');
  const vision=readFileSync(new URL('../public/theme/theme.css',import.meta.url),'utf8');
  const glass=readFileSync(new URL('../public/theme/theme.css',import.meta.url),'utf8');
  const shared=['--page','--panel','--ink','--muted','--border','--accent','--accent-hover','--hover','--hover-border','--selected','--secondary','--error','--error-bg','--panel-soft','--panel-raised','--brand-gradient','--brand-gradient-hover','--surface-shadow','--radius-card','--radius-control','--font-ui'];
  for(const token of shared){
    expect(premium, `central theme includes ${token}`).toContain(token+':');
    expect(vision).toContain(token+':');
  }
  expect(glass).toContain('--lg-glass-fill:');
  expect(glass).toContain('var(--panel)');
  expect(glass).toContain('var(--accent)');
});

test('phase 4 refines admin navigation, workspace hit areas, and appearance controls',()=>{
  const css=readFileSync(new URL('../public/theme/theme.css',import.meta.url),'utf8');
  expect(css).toContain('#root .admin-sidebar nav button.active');
  expect(css).toContain('box-shadow: inset 3px 0 0 var(--accent)');
  expect(css).toContain('#root .canvas-tools button');
  expect(css).toContain('min-height: 42px');
  expect(css).toContain('#root .appearance-color:focus-within');
  expect(css).toContain('@media (max-width: 699px)');
  expect(css).toContain('#root .admin-page .admin-card');
});


test('phase 5 preserves keyboard focus and accessibility preference fallbacks',()=>{
  const css=readFileSync(new URL('../public/theme/theme.css',import.meta.url),'utf8');
  expect(css).toContain('#root .admin-sidebar nav button:focus-visible');
  expect(css).toContain('#root :is(button, .button, .primary, .text-button, .result-mode, .result-mode button)');
  expect(css).toContain('#root :is(.admin-topbar, .admin-sidebar, .admin-card, .admin-metric, .admin-user-row');
  expect(css).toContain('#root .canvas-tools button:focus-visible');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('@media (prefers-contrast: more)');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('outline: 2px solid Highlight');
});
