import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';

test('production series input is editable and placed in the relevant section only',()=>{
  const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  expect(source).toContain('aria-label="Proje seri adedi"');
  expect(source).toContain('type="text"');
  expect(source).toContain('pattern="[0-9]*"');
  expect(source).toContain("if(/^\\d*$/.test(e.target.value))setSeriesDraft(e.target.value)");
  expect(source).toContain('onBlur={finishSeriesEdit}');
  expect(source).toContain("if(e.key==='Enter')");
  expect(source).toContain('<section className="production-series"');
  expect(source).toContain('Toplam üretim: <strong>{displayedProductionPieces}</strong>');
  expect(source).not.toContain('className="production-series__total" role="status"');
  expect(source).toContain('Toplam malzeme: <strong>{displayedProductionMaterial}');
  const panelTitle=source.indexOf('<div className="panel-title">');
  const seriesSection=source.indexOf('<section className="production-series"');
  const partsList=source.indexOf('<div className="parts-list">');
  expect(panelTitle).toBeGreaterThan(-1);
  expect(seriesSection).toBeGreaterThan(panelTitle);
  expect(seriesSection).toBeLessThan(partsList);
  expect(source.slice(panelTitle,seriesSection)).not.toContain('series-multiplier');
  expect(source).toContain('disabled={busy||!doc.parts.length}');
});

test('series changes count as new, unexported production changes',()=>{
  const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  expect(source).toContain('String(doc.seriesMultiplier??1)!==String(exported.document.seriesMultiplier??1)');
  expect(source).toContain('commit(applySeriesMultiplier(doc,raw),false');
});
