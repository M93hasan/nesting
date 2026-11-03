import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('admin navigation adopts glass, admin data cards remain opaque',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'liquid-glass@example.test',name:'Glass QA',role:'admin',credits:0,unlimited:true}})}));
  await page.goto('/admin');
  const topbar=page.locator('.admin-topbar');
  await expect(topbar).toBeVisible();
  await expect(topbar).toHaveCSS('backdrop-filter',/blur\(10px\)/);
  await expect(page.locator('.admin-card').first()).toHaveCSS('backdrop-filter','none');
  const active=page.locator('.admin-sidebar nav button.active').first();
  await expect(active).toBeVisible();
  await expect(active).toHaveCSS('border-radius','9999px');
});

test('admin mobile navigation stays within viewport with Liquid Glass',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'liquid-glass@example.test',name:'Glass QA',role:'admin',credits:0,unlimited:true}})}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin2');
  await expect(page.locator('.admin-topbar')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('user sign-in surface stays readable and uses the new glass material tokens',async({page})=>{
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  const token=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--glass-floating').trim());
  expect(token).toContain('light-dark');
  const canvas=page.locator('.workspace-svg');
  await expect(canvas).toHaveCSS('backdrop-filter','none');
});
