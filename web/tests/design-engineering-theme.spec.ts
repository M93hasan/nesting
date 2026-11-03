import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('design-engineering skin preserves theme preference and input focus feedback',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('serula-theme','dark'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const tokens=await page.evaluate(()=>{
    const style=getComputedStyle(document.documentElement);
    return {speed:style.getPropertyValue('--serula-motion-quick').trim(),accent:style.getPropertyValue('--accent').trim()};
  });
  expect(tokens.speed).toBe('140ms');
  expect(tokens.accent).toBeTruthy();
  const field=page.locator('.material-panel input:not([type=checkbox]):not([type=radio])').first();
  await expect(field).toBeVisible();
  await field.focus();
  await expect(field).toHaveCSS('outline-style','solid');
  await page.evaluate(()=>localStorage.setItem('serula-theme','light'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('design-engineering theme keeps the workspace and tools usable at 390px',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('.workspace-svg')).toBeVisible();
  await expect(page.locator('.canvas-tools .cad-snapping > summary')).toBeVisible();
  await page.locator('.canvas-tools .cad-snapping > summary').click();
  await expect(page.locator('.canvas-tools .cad-snapping > div')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('reduced motion disables decorative transitions on part rows',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const reduced=await page.evaluate(()=>{
    const stylesheet=Array.from(document.styleSheets).find(s=>s.href?.includes('design-engineering-theme'));
    if(!stylesheet)return false;
    return Array.from(stylesheet.cssRules).some(rule=>rule.cssText.includes('prefers-reduced-motion'));
  });
  expect(reduced).toBe(true);
});
