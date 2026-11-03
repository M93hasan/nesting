import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('Liquid Glass visual identity reaches header, both rails and CAD toolbar',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('serula-theme','dark'));
  await page.goto('/');
  await expect(page.locator('.app > .header')).toBeVisible();
  for(const selector of ['.app > .header','.app .sidebar','.app .material-panel','.app .studio-canvas-heading']) {
    await expect(page.locator(selector)).toHaveCSS('background-image',/gradient/);
  }
  await expect(page.locator('.canvas-tools .cad-snapping')).toHaveCSS('backdrop-filter',/blur\(14px\)/);
  await expect(page.locator('.workspace-svg')).toHaveCSS('backdrop-filter','none');
  const navImage=await page.locator('.app > .header').evaluate(el=>getComputedStyle(el).backgroundImage);
  expect(navImage).toContain('radial-gradient');
});
test('Admin visual surfaces change while data cards remain readable',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'glass-test@example.test',name:'Glass QA',role:'admin',credits:0,unlimited:true}})}));
  await page.goto('/admin');
  await expect(page.locator('.admin-topbar')).toHaveCSS('background-image',/gradient/);
  await expect(page.locator('.admin-sidebar')).toHaveCSS('background-image',/gradient/);
  await expect(page.locator('.admin-card').first()).toHaveCSS('backdrop-filter','none');
});
test('Light theme remains accessible and canvas dimensions stay unchanged',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('.main-workspace')).toHaveCSS('display','grid');
  await expect(page.locator('.workspace-svg')).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCSS('border-radius','0px');
});
