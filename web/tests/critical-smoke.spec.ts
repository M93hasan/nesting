import {test,expect} from '@playwright/test';

test('studio loads and Parts disclosure stays under Delete All',async({page})=>{
  await page.goto('/');
  const parts=page.locator('#parts-settings');
  const clear=parts.locator('.clear-all-parts');
  const disclosure=parts.locator('details.part-properties-disclosure');
  await expect(clear).toBeAttached();
  await expect(disclosure).toBeAttached();
  expect(await clear.evaluate((button,selector)=>{
    const panel=document.querySelector(selector);
    return Boolean(panel && (button.compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING));
  },'#parts-settings details.part-properties-disclosure')).toBe(true);
  await expect(disclosure).not.toHaveAttribute('open');
  await disclosure.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open','');
  await expect(disclosure).toContainText('Özelliklerini görmek için bir parça seçin.');
  await disclosure.locator('summary').click();
  await expect(disclosure).not.toHaveAttribute('open');
});

test('studio has no horizontal overflow at phone width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#parts-settings')).toBeAttached();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
