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
  await expect(studio).toHaveCSS('background-color','rgb(241, 245, 249)');
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
  await expect(admin).toHaveCSS('background-color','rgb(241, 245, 249)');
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
  await expect(studio.locator('.canvas-tools')).toHaveCSS('background-color','rgba(255, 255, 255, 0.97)');
  await expect(studio.locator('.statusbar')).toHaveCSS('background-color','rgb(248, 250, 252)');
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

test('CAD surface never falls back to black SVG rectangles after theme removal',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  const band=page.locator('.app.shadcn-studio .material-width-band > rect');
  const outside=page.locator('.app.shadcn-studio .material-width-outside > rect').first();
  await expect(band).toBeVisible();
  await expect(band).toHaveCSS('fill','rgb(255, 255, 255)');
  await expect(outside).toHaveCSS('fill','rgb(226, 232, 240)');
});

test('phone CAD toolbar and empty project message never overlap',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const tools=page.locator('.app.shadcn-studio .canvas-tools');
  const notice=page.locator('.app.shadcn-studio .empty-project');
  await expect(tools).toBeVisible();
  await expect(notice).toBeVisible();
  const [t,n]=await Promise.all([tools.boundingBox(),notice.boundingBox()]);
  expect(t).not.toBeNull();expect(n).not.toBeNull();
  expect(t!.y+t!.height).toBeLessThanOrEqual(n!.y+2);
  await expect(page.locator('.app.shadcn-studio .drawing-panel .canvas-hint')).toBeHidden();
  await page.screenshot({path:testInfo.outputPath('serula-studio-mobile-fixed.png'),fullPage:true});
});

test('mobile export footer follows workbench instead of hiding part controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const material=page.locator('.app.shadcn-studio .material-panel');
  const footer=page.locator('.app.shadcn-studio > .statusbar');
  const [m,f]=await Promise.all([material.boundingBox(),footer.boundingBox()]);
  expect(m).not.toBeNull();expect(f).not.toBeNull();
  expect(f!.y).toBeGreaterThanOrEqual(m!.y+m!.height-1);
  await expect(footer).toHaveCSS('position','static');
  await expect(page.locator('.corel-transfer-button')).toBeAttached();
});
test('visual QA captures the actual admin panel at mobile and desktop sizes',async({page},testInfo)=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/admin');
    await expect(page.locator('.admin-page.shadcn-dashboard')).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('serula-admin-'+width+'.png'),fullPage:true});
  }
});
test('visual reference capture from original Shadcn Dashboard demo',async({page},testInfo)=>{
  try {
    await page.setViewportSize({width:1440,height:900});
    await page.goto('https://shadcndashboard-demo.vercel.app/',{waitUntil:'domcontentloaded',timeout:20000});
    await page.screenshot({path:testInfo.outputPath('shadcn-original-reference.png'),fullPage:true,timeout:20000});
  } catch {
    test.skip(true,'External reference demo could not be captured from the CI runner');
  }
});

test('CAD coordinate rulers adopt Shadcn neutral surfaces rather than black SVG defaults',async({page})=>{
  await page.goto('/');
  const first=page.locator('.app.shadcn-studio .coordinate-rulers>rect').first();
  await expect(first).toBeAttached();
  await expect(first).toHaveCSS('fill','rgb(226, 232, 240)');
  await expect(page.locator('.app.shadcn-studio .coordinate-rulers>path')).toHaveCSS('stroke','rgb(148, 163, 184)');
});
test('Shadcn comparison: active admin navigation uses the reference dark treatment',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  await page.goto('/admin');
  const nav=page.getByRole('button',{name:'Genel Bakış'});
  await expect(nav).toHaveAttribute('aria-current','page');
  await expect(nav).toHaveCSS('background-color','rgb(37, 99, 235)');
  await expect(nav).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(page.getByRole('link',{name:'Shadcn Dashboard'})).toHaveAttribute('href','https://shadcndashboard.dev/');
  await expect(page.locator('.sd-chart-empty')).toContainText('Bu hafta henüz yeni kayıt yok');
});

test('imported DXF stays in front of the material outside-mask instead of looking like a background layer',async({page})=>{
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles('tests/fixtures/blocks.dxf');
  // Valid DXF parts are now added automatically; no preview modal is shown.
  await expect(page.getByRole('dialog',{name:'İçe aktarmayı gözden geçir'})).toHaveCount(0);
  const drawing=page.locator('.workspace-svg g[data-part][data-copy-index]');
  await expect(drawing).toHaveCount(2);
  await expect(page.locator('.workspace-svg .material-width-outside')).toBeAttached();
  const order=await page.locator('.workspace-svg').evaluate(svg=>{
    const mask=svg.querySelector('.material-width-outside');
    const copies=[...svg.querySelectorAll('g[data-part][data-copy-index]')];
    return !!mask&&copies.length===2&&copies.every(copy=>
      Boolean(mask.compareDocumentPosition(copy)&Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(order).toBe(true);
  await expect(drawing.first().locator('path').first()).toHaveAttribute('d',/./);
});

test('Parçalar panel keeps its actions accessible in a compact layout',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  const parts=page.locator('#parts-settings');
  await expect(parts.locator('.add-shape>button')).toHaveCount(2);
  await expect(parts.locator('.add-shape>button').first()).toHaveCSS('min-height','34px');
  await expect(parts.locator('.production-series')).toHaveCSS('padding-top','5px');
  const order=await parts.evaluate(panel=>{
    const series=panel.querySelector('.production-series');
    const list=panel.querySelector('.parts-list');
    return !!series&&!!list&&Boolean(series.compareDocumentPosition(list)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await page.getByRole('button',{name:'Şekil çiz'}).click();
  await page.getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await expect(parts.locator('.part-row')).toHaveCount(1);
  await expect(parts.locator('.part-select svg')).toHaveCSS('width','28px');
  await expect(parts.locator('.part-row>input')).toHaveCSS('width','39px');
  await expect(page.getByLabel('Proje seri adedi')).toBeEnabled();
  await expect(page.getByRole('button',{name:'Geri al'})).toBeEnabled();
});


test('mobile keeps the original Serula palette while desktop uses neutral workspace appearance',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('.app.shadcn-studio')).toHaveCSS('background-color','rgb(248, 250, 252)');
  await expect(page.locator('.canvas-tools')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('#parts-settings .add-shape>button')).toHaveCount(2);
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(adminUser)
  }));
  await page.goto('/admin');
  await expect(page.locator('.admin-page.shadcn-dashboard')).toHaveCSS('background-color','rgb(255, 255, 255)');
});

test('compact desktop controls give the nesting canvas more visible room',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  const app=page.locator('.app.shadcn-studio');
  const parts=app.locator('#parts-settings');
  const material=app.locator('.material-panel');
  const canvas=app.locator('.drawing-panel');
  const header=app.locator(':scope > .header');
  const footer=app.locator(':scope > .statusbar');
  const [p,m,c,h,f]=await Promise.all([
    parts.boundingBox(),material.boundingBox(),canvas.boundingBox(),header.boundingBox(),footer.boundingBox()
  ]);
  expect(p&&m&&c&&h&&f).toBeTruthy();
  expect(p!.width).toBeLessThanOrEqual(240);
  expect(m!.width).toBeLessThanOrEqual(275);
  expect(c!.width).toBeGreaterThan(900);
  expect(h!.height).toBeLessThanOrEqual(62);
  expect(f!.height).toBeLessThanOrEqual(72);
  await expect(canvas.locator('.studio-canvas-heading')).toHaveCSS('min-height','52px');
  await expect(parts.getByRole('button',{name:'DXF İçe Aktar'})).toHaveCSS('min-height','34px');
  await expect(app.locator('.canvas-tools>button').first()).toHaveCSS('min-height','34px');
  await expect(material.getByLabel(/Malzeme genişliği/)).toHaveCSS('min-height','34px');
  await expect(app.locator('.statusbar .run-button')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});

test('compact desktop workbench leaves phone-size touch controls intact',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const button=page.locator('#parts-settings .add-shape>button').first();
  await expect(button).toBeAttached();
  const minHeight=await button.evaluate(element=>parseFloat(getComputedStyle(element).minHeight));
  expect(minHeight).toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('desktop canvas description stays on one line without horizontal overflow',async({page})=>{
  await page.goto('/');
  const caption=page.locator('.app.shadcn-studio .studio-canvas-context');
  for(const width of [1100,1280]){
    await page.setViewportSize({width,height:900});
    await expect(caption).toBeHidden();
  }
  for(const width of [1301,1440,1920]){
    await page.setViewportSize({width,height:900});
    await expect(caption).toBeVisible();
    await expect(caption).toHaveCSS('white-space','nowrap');
    const geometry=await caption.evaluate(element=>({height:element.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(element).lineHeight),scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}));
    expect(geometry.height).toBeLessThanOrEqual(geometry.lineHeight+1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
