import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('new Serula studio surfaces are visibly distinct in light and dark mode',async({page})=>{
  await page.goto('/');
  const shell=page.locator('.app > .header'),rail=page.locator('.app .sidebar');
  await expect(shell).toBeVisible();await expect(rail).toBeVisible();
  const inspect=async()=>page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    const header=getComputedStyle(document.querySelector('.app > .header')!);
    const rail=getComputedStyle(document.querySelector('.app .sidebar')!);
    return {railToken:css.getPropertyValue('--serula-studio-rail').trim(),headerBackground:header.backgroundColor,railBackground:rail.backgroundColor};
  });
  const light=await inspect();
  expect(light.railToken).toContain('light-dark');
  expect(light.headerBackground).not.toBe(light.railBackground);
  await page.evaluate(()=>localStorage.setItem('serula-theme','dark'));await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const dark=await inspect();
  expect(dark.headerBackground).not.toBe(dark.railBackground);
  expect(dark.railBackground).not.toBe(light.railBackground);
});

test('studio side rails remain square and retain the desktop CAD workspace',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.locator('.main-workspace')).toHaveCSS('display','grid');
  await expect(page.locator('.sidebar')).toHaveCSS('border-radius','0px');
  await expect(page.locator('.workspace-svg')).toBeVisible();
});
