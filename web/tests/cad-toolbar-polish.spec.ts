import {test,expect} from '@playwright/test';

// Focused UI regression: toolbar behavior must not change CAD geometry or data.
test.use({serviceWorkers:'block'});

test('CAD snapping menu is keyboard-visible and stays within a narrow viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const summary=page.locator('.canvas-tools .cad-snapping > summary');
  await expect(summary).toBeVisible();
  await summary.focus();
  await expect(summary).toHaveCSS('outline-style','solid');
  await page.keyboard.press('Enter');
  const menu=page.locator('.canvas-tools .cad-snapping > div');
  await expect(menu).toBeVisible();
  const rect=await menu.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x).toBeGreaterThanOrEqual(-1);
  expect(rect!.x+rect!.width).toBeLessThanOrEqual(391);
  const toggle=menu.getByRole('checkbox');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(summary).toContainText('kapalı');
  await toggle.check();
  await expect(summary).toContainText('açık');
});

test('CAD contour button preserves pressed-state feedback',async({page})=>{
  await page.goto('/');
  const contour=page.getByRole('button',{name:'Kontur modu'});
  await expect(contour).toHaveAttribute('aria-pressed','false');
  await contour.click();
  await expect(contour).toHaveAttribute('aria-pressed','true');
  await contour.click();
  await expect(contour).toHaveAttribute('aria-pressed','false');
});
