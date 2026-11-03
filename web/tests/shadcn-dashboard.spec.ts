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

test('user management filters online accounts and sorts by credits without changing API actions',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  const users=[
    {id:10,email:'ali@example.test',name:'Ali',role:'operator',credits:3,unlimited:false,online:false},
    {id:20,email:'zeynep@example.test',name:'Zeynep',role:'admin',credits:5,unlimited:false,online:true},
    {id:30,email:'burak@example.test',name:'Burak',role:'operator',credits:20,unlimited:false,online:true}
  ];
  await page.route('**/api/admin/users',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({users,onlineCount:2})
  }));
  await page.goto('/admin');
  await page.getByRole('button',{name:'Kullanıcılar'}).click();
  const table=page.getByRole('table',{name:'Kullanıcı listesi'});
  const rows=table.locator('.admin-user-row');
  await expect(rows).toHaveCount(3);
  await page.getByLabel('Kullanıcı durumu').selectOption('online');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Kullanıcı sıralaması').selectOption('credits');
  await expect(rows.first().locator('.admin-user-identity')).toContainText('Burak');
  await expect(rows.nth(1).locator('.admin-user-identity')).toContainText('Zeynep');
  await page.getByRole('textbox',{name:'Kullanıcı ara'}).fill('Zeynep');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Zeynep');
  await page.getByRole('button',{name:'Filtreleri temizle'}).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByLabel('Kullanıcı durumu')).toHaveValue('all');
  await expect(page.getByLabel('Kullanıcı sıralaması')).toHaveValue('name');
  await expect(page.getByRole('button',{name:'Filtreleri temizle'})).toBeDisabled();
});

test('user management table and filters remain inside the viewport at phone width',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  await page.route('**/api/admin/users',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({users:[{
      id:10,email:'long-address-for-mobile-check@example.test',name:'Mobile QA',
      role:'operator',credits:2,unlimited:false,online:false
    }],onlineCount:0})
  }));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin');
  await page.getByRole('button',{name:'Kullanıcılar'}).click();
  await expect(page.getByRole('table',{name:'Kullanıcı listesi'}).locator('.admin-user-row')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByLabel('Kullanıcı rolü')).toBeVisible();
  await expect(page.getByLabel('Kullanıcı sıralaması')).toBeVisible();
});

test('overview shows actual recent audit activity rather than a demo placeholder',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  await page.route('**/api/admin/logs',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({logs:[{
      id:901,actorType:'admin',actorEmail:'qa@example.test',
      targetEmail:'operator@example.test',action:'Kota güncellendi',
      detail:'Test action',success:true,createdAt:'2026-11-03T14:10:00Z'
    }]})
  }));
  await page.goto('/admin');
  await expect(page.getByRole('heading',{name:'Son İşlemler'})).toBeVisible();
  await expect(page.locator('.sd-activity-list')).toContainText('Kota güncellendi');
  await page.getByRole('button',{name:'Tüm loglar'}).click();
  await expect(page.getByRole('heading',{name:'Sistem Logları'}).first()).toBeVisible();
});

test('overview chart counts real registration dates, without demo metrics',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  await page.route('**/api/admin/users',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({users:[
      {id:201,email:'today@example.test',name:'Today',role:'operator',credits:0,unlimited:false,createdAt:new Date().toISOString()},
      {id:202,email:'unknown@example.test',name:'Unknown',role:'operator',credits:0,unlimited:false}
    ],onlineCount:0})
  }));
  await page.goto('/admin');
  const chart=page.getByRole('region',{name:'Haftalık yeni kullanıcı kayıtları'});
  await expect(chart).toBeVisible();
  await expect(chart.locator('.sd-chart-day')).toHaveCount(7);
  await expect(chart.locator('.sd-chart-total')).toHaveText('1 kayıt');
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label',/toplam 1 kayıt/);
});

test('Shadcn Studio surfaces preserve the desktop CAD three-column order',async({page},info)=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  const studio=page.locator('.app.shadcn-studio');
  const parts=studio.locator('#parts-settings');
  const drawing=studio.locator('.drawing-panel');
  const material=studio.locator('.material-panel');
  const [p,d,m]=await Promise.all([parts,drawing,material].map(el=>el.boundingBox()));
  expect(p).not.toBeNull();expect(d).not.toBeNull();expect(m).not.toBeNull();
  expect(p!.x+p!.width).toBeLessThanOrEqual(d!.x+2);
  expect(d!.x+d!.width).toBeLessThanOrEqual(m!.x+2);
  await expect(parts).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(drawing).toHaveCSS('border-top-style','solid');
  await expect(material).toHaveCSS('border-top-style','solid');
  await expect(studio.locator('.canvas-tools')).toHaveCSS('background-color','rgba(255, 255, 255, 0.96)');
  await expect(studio.locator('.statusbar')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.screenshot({path:info.outputPath('shadcn-studio-desktop.png'),fullPage:true});
});

test('Shadcn Studio disclosure focus and toggles remain functional on a phone',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const studio=page.locator('.app.shadcn-studio');
  const partsToggle=studio.getByRole('button',{name:'Parçalar & ayarlar'});
  if(await partsToggle.getAttribute('aria-expanded')==='false')await partsToggle.click();
  await expect(partsToggle).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#parts-settings')).toBeVisible();
  await expect(page.getByLabel('Proje seri adedi')).toBeAttached();
  const summary=studio.locator('.material-panel .solver-options > summary');
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await expect(summary).toHaveCSS('outline-style','solid');
  await summary.press('Enter');
  await expect(studio.locator('.material-panel .solver-options')).toHaveAttribute('open','');
  const contour=studio.getByRole('button',{name:'Kontur modu'});
  await contour.click();
  await expect(contour).toHaveAttribute('aria-pressed','true');
  await expect(contour).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(contour).toHaveCSS('border-top-color','rgb(39, 39, 42)');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:info.outputPath('shadcn-studio-mobile.png'),fullPage:true});
});

test('Shadcn Studio export and placement controls stay within supported viewports',async({page})=>{
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await expect(page.locator('.workspace-svg')).toBeVisible();
    await expect(page.locator('.corel-transfer-button')).toBeAttached();
    await expect(page.locator('.statusbar .run-button')).toBeVisible();
    await expect(page.locator('#parts-settings').getByRole('button',{name:'DXF İçe Aktar'})).toBeAttached();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
