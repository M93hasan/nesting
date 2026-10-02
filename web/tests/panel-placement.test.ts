import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('rotation stays in Material and Layout while part properties stay inside Parts',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

  const partsStart=app.indexOf('<aside id="parts-settings"');
  const clearAll=app.indexOf('className="danger-button clear-all-parts"',partsStart);
  const properties=app.indexOf('className="part-properties-inline"',partsStart);
  const drawing=app.indexOf('<section className="drawing-panel">',partsStart);
  expect(partsStart).toBeGreaterThanOrEqual(0);
  expect(clearAll).toBeGreaterThan(partsStart);
  expect(properties).toBeGreaterThan(clearAll);
  expect(drawing).toBeGreaterThan(properties);

  const materialStart=app.indexOf('<aside className="material-panel" aria-label="Malzeme ve Yerleşim">');
  const rotation=app.indexOf('<RotationControl',materialStart);
  expect(materialStart).toBeGreaterThanOrEqual(0);
  expect(rotation).toBeGreaterThan(materialStart);

  expect(app).not.toContain('part-properties-flyout');
  expect(app).not.toContain('aria-label="Clear selection"');
  expect(styles).toContain('.sidebar>.part-properties-inline');
  expect(styles).not.toContain('.sidebar>.part-properties-flyout');
});
