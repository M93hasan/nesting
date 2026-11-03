import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('calm studio eliminates glow and uses a coherent panel hierarchy',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('serula-theme','dark'));
  await page.goto('/');
  const header=page.locator('.app > .header');
  const rail=page.locator('.app .sidebar');
  await expect(header).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(header).toHaveCSS('background-image','none');
  await expect(rail).toHaveCSS('background-image','none');
  await expect(rail).toHaveCSS('box-shadow','none');
  await expect(page.locator('.canvas-tools .cad-snapping')).toHaveCSS('backdrop-filter','none');
  await expect(page.locator('.workspace-svg')).toHaveCSS('backdrop-filter','none');
  const colors=await page.evaluate(()=>({
    header:getComputedStyle(document.querySelector('.app > .header')!).backgroundColor,
    rail:getComputedStyle(document.querySelector('.app .sidebar')!).backgroundColor
  }));
  expect(colors.header).not.toBe(colors.rail);
});

test('calm UI respects light mode and narrow screens',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('.workspace-svg')).toBeVisible();
  await expect(page.locator('.app .sidebar')).toHaveCSS('background-image','none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('admin also uses restrained surfaces instead of gradients',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'visual-qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})
  }));
  await page.goto('/admin');
  await expect(page.locator('.admin-topbar')).toBeVisible();
  await expect(page.locator('.admin-topbar')).toHaveCSS('background-image','none');
  await expect(page.locator('.admin-sidebar')).toHaveCSS('background-image','none');
  await expect(page.locator('.admin-card').first()).toHaveCSS('box-shadow','none');
});
