import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

const adminUser={user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}};

test('new shadcn studio appearance preserves CAD and export actions',async({page})=>{
  await page.goto('/');
  const studio=page.locator('.app.shadcn-studio');
  await expect(studio).toBeVisible();
  await expect(page.locator('#parts-settings')).toBeAttached();
  await expect(page.locator('.drawing-panel .workspace-svg')).toBeAttached();
  await expect(page.locator('.material-panel')).toBeAttached();
  await expect(page.locator('.corel-transfer-button')).toBeAttached();
  await expect(page.locator('#parts-settings').getByRole('button',{name:'DXF İçe Aktar'})).toBeAttached();
  await expect(studio).toHaveCSS('background-color','rgb(248, 250, 252)');
});

test('shadcn admin navigation selects real API-backed pages',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  await page.goto('/admin');
  const admin=page.locator('.admin-page.shadcn-dashboard');
  await expect(admin).toBeVisible();
  await expect(page.getByRole('button',{name:'Genel Bakış'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.admin-metrics .admin-metric')).toHaveCount(4);
  const users=page.getByRole('button',{name:'Kullanıcılar'});
  await users.click();
  await expect(users).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('heading',{name:'Kullanıcı Yönetimi'})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Kullanıcı ara'})).toBeAttached();
  await expect(admin).toHaveCSS('background-color','rgb(248, 250, 252)');
});

test('shadcn navigation fits phone, tablet and desktop widths',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/admin');
    await expect(page.locator('.admin-page.shadcn-dashboard')).toBeVisible();
    await expect(page.locator('.admin-sidebar nav')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
