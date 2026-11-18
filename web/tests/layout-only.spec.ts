import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('studio preserves working controls without runtime theme settings',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await expect(page.locator('.main-workspace')).toBeVisible();
  await expect(page.locator('.workspace-svg')).toBeVisible();
  await expect(page.locator('.theme-toggle')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'DXF İçe Aktar'}).first()).toBeAttached();
  await expect(page.locator('.corel-transfer-button')).toBeAttached();
});

test('structural layout remains accessible at phone, tablet and desktop widths',async({page})=>{
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await expect(page.locator('.main-workspace')).toBeVisible();
    await expect(page.locator('.workspace-svg')).toBeAttached();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('admin has no appearance section',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})
  }));
  await page.goto('/admin');
  await expect(page.locator('.admin-page')).toBeVisible();
  await expect(page.getByRole('button',{name:/Görünüm/})).toHaveCount(0);
});
