import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('studio identity has clearly different panel and canvas chrome in light and dark modes',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.app .sidebar')).toBeVisible();
  const getColors=()=>page.evaluate(()=>{
    const header=getComputedStyle(document.querySelector('.app > .header')!).backgroundColor;
    const sidebar=getComputedStyle(document.querySelector('.app .sidebar')!).backgroundColor;
    const heading=getComputedStyle(document.querySelector('.app .studio-canvas-heading')!).backgroundColor;
    return {header,sidebar,heading};
  });
  const light=await getColors();
  expect(light.header).not.toBe(light.sidebar);
  expect(light.heading).toBe(light.header);
  await page.evaluate(()=>localStorage.setItem('serula-theme','dark'));await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const dark=await getColors();
  expect(dark.header).not.toBe(dark.sidebar);
  expect(dark.sidebar).not.toBe(light.sidebar);
});

test('admin navigation is visibly distinct while data panels stay legible',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'theme-audit@example.test',name:'Theme QA',role:'admin',credits:0,unlimited:true}})}));
  await page.goto('/admin');
  await expect(page.locator('.admin-page')).toBeVisible();
  const bar=await page.locator('.admin-topbar').evaluate(el=>getComputedStyle(el).backgroundColor);
  const rail=await page.locator('.admin-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(bar).not.toBe(rail);
  await expect(page.locator('.admin-card').first()).toHaveCSS('backdrop-filter','none');
  await expect(page.locator('.admin-page')).toHaveCSS('background-color','rgb(255, 255, 255)');
});

test('new identity maintains mobile screen width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('.workspace-svg')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
