import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('Liquid Glass is limited to floating controls and not the CAD drawing',async({page})=>{
  await page.goto('/');
  const snap=page.locator('.canvas-tools .cad-snapping');
  await expect(snap).toBeVisible();
  await expect(snap).toHaveCSS('backdrop-filter',/blur\(10px\)/);
  const canvas=page.locator('.workspace-svg');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS('backdrop-filter','none');
  await expect(page.locator('.sidebar')).toHaveCSS('backdrop-filter','none');
  await snap.locator('summary').click();
  await expect(snap.locator('div').first()).toBeVisible();
});
test('glass controls preserve contrast, keyboard focus and reduced motion',async({page})=>{
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('serula-theme','dark'));
  await page.goto('/');
  const summary=page.locator('.canvas-tools .cad-snapping > summary');
  await summary.focus();
  await expect(summary).toHaveCSS('outline-style','solid');
  await expect(page.locator('.canvas-tools .cad-snapping')).toHaveCSS('transition-duration','0s');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
test('glass floating controls remain usable on a 390px device',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const summary=page.locator('.canvas-tools .cad-snapping > summary');
  await summary.click();
  const menu=page.locator('.canvas-tools .cad-snapping > div');
  await expect(menu).toBeVisible();
  const rect=await menu.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x).toBeGreaterThanOrEqual(-1);
  expect(rect!.x+rect!.width).toBeLessThanOrEqual(391);
});
