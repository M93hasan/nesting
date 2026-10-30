import {test,expect} from '@playwright/test';

// UI and mocked-auth regressions must not involve the isolation worker's
// asynchronous registration or reload; worker isolation is tested separately.
test.use({serviceWorkers:'block'});

test('Google login follows saved appearance and system preference',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.addInitScript(()=>{
    if(!localStorage.getItem('serula-theme'))localStorage.setItem('serula-theme','system');
  });
  await page.goto('/google-login.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.evaluate(()=>localStorage.setItem('serula-theme','dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('admin dashboard shares neutral surfaces and actions on desktop and mobile',async({page},testInfo)=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'theme-test@example.test',name:'Theme Test',role:'admin',credits:0,unlimited:true}})
  }));
  await page.addInitScript(()=>{if(!localStorage.getItem('serula-theme'))localStorage.setItem('serula-theme','dark');});
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/admin');
  const admin=page.locator('.admin-page');
  await expect(admin).toBeVisible();
  await expect(admin).not.toHaveClass(/admin-mobile-page/);
  await expect(page.locator('.admin-sidebar')).toHaveCSS('border-radius','0px');
  const pageBackground=()=>admin.evaluate(el=>getComputedStyle(el).backgroundColor);
  const surface=()=>page.locator('.admin-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);
  await expect.poll(pageBackground).toBe('rgb(12, 13, 15)');
  await expect.poll(surface).toBe('rgb(23, 24, 27)');
  await page.screenshot({path:testInfo.outputPath('admin-dark.png')});
  await page.evaluate(()=>localStorage.setItem('serula-theme','light'));
  await page.reload();
  await expect(admin).toBeVisible();
  await expect.poll(pageBackground).toBe('rgb(250, 250, 250)');
  await expect.poll(surface).toBe('rgb(255, 255, 255)');
  const metric=page.locator('.admin-metric').first();
  const icon=metric.locator('.admin-metric-icon');
  const cardRight=await metric.evaluate(el=>el.getBoundingClientRect().right);
  const iconRight=await icon.evaluate(el=>el.getBoundingClientRect().right);
  expect(cardRight-iconRight).toBeLessThan(28);
  await page.screenshot({path:testInfo.outputPath('admin-light.png')});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin2');
  await expect(admin).toHaveClass(/admin-mobile-page/);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('.admin-workspace-link')).toHaveCSS('font-size','0px');
  await page.screenshot({path:testInfo.outputPath('admin-mobile.png')});
});

test('studio buttons share one radius and About stays readable on narrow screens',async({page},testInfo)=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('.studio-canvas-heading h1')).toHaveText('Çalışma alanı');
  await expect(page.locator('.main-workspace')).toHaveCSS('display','grid');
  await expect(page.locator('.sidebar')).toHaveCSS('border-radius','0px');
  const rail=await page.locator('.sidebar').boundingBox();
  const brand=await page.locator('.brand-block').boundingBox();
  expect(rail?.width).toBe(brand?.width);
  const radius=await page.locator('.header nav button').first().evaluate(element=>getComputedStyle(element).borderRadius);
  expect(radius).toBe('9px');
  for(const selector of ['.add-shape button','.statusbar button','.auth-login-header']){
    await expect(page.locator(selector).first()).toHaveCSS('border-radius',radius);
  }
  await expect(page.locator('.run-controls .reference-launch')).toHaveCSS('background-color','rgb(24, 24, 27)');
  await page.screenshot({path:testInfo.outputPath('studio-dashboard-light.png')});
  await page.getByRole('button',{name:'Serula Nesting Hakkında'}).click();
  await expect(page.locator('.about-layout')).toHaveCSS('grid-template-areas','"overview overview" "preferences download" "bridge bridge"');
  await page.screenshot({path:testInfo.outputPath('about-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.about-layout')).toHaveCSS('grid-template-areas','"overview" "preferences" "download" "bridge"');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:testInfo.outputPath('about-mobile.png')});
});

test('account menu stays opaque and keeps its account actions',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({user:{id:1,email:'member@example.test',name:'Test Member',role:'user',credits:5,unlimited:false}})}));
  await page.goto('/');
  await page.locator('#serula-account-slot > details > summary').click();
  const dropdown=page.locator('#serula-account-slot .auth-account-dropdown');
  await expect(dropdown).toBeVisible();
  await expect(dropdown).toContainText('member@example.test');
  await expect(dropdown).toContainText('5 hak kaldı');
  await expect(dropdown.getByRole('button',{name:'Çıkış yap'})).toBeVisible();
  await expect(dropdown.locator('select')).toHaveCount(1);
  const languages=await dropdown.locator('select option').allTextContents();
  for(const label of ['Türkçe','English','العربية','فارسی'])expect(languages.some(option=>option.includes(label))).toBe(true);
  expect(await dropdown.evaluate(element=>getComputedStyle(element).backgroundColor)).toMatch(/^rgb\(/);
  await page.setViewportSize({width:390,height:844});
  await expect(dropdown).toBeVisible();
});

test('Google sign-in keeps the credential callback and locale',async({page})=>{
  let posted='';
  await page.route('**/api/auth/google-config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({clientId:'test-client'})}));
  await page.route('**/api/auth/google',async route=>{posted=route.request().postData()||'';await route.fulfill({contentType:'application/json',body:'{"user":{}}'});});
  await page.route('https://accounts.google.com/gsi/client**',route=>route.fulfill({contentType:'application/javascript',body:'window.google={accounts:{id:{initialize(options){window.testGoogleCallback=options.callback},renderButton(parent,options){parent.dataset.shape=options.shape;parent.textContent="Google"}}}};'}));
  await page.goto('/google-login.html?locale=en');
  await expect(page.locator('#google')).toHaveAttribute('data-shape','rectangular');
  await page.evaluate(()=>((window as unknown as {testGoogleCallback:(value:{credential:string})=>void}).testGoogleCallback)({credential:'test-token'}));
  await page.waitForURL('/?google=ok');
  expect(JSON.parse(posted)).toEqual({credential:'test-token',locale:'en'});
});
