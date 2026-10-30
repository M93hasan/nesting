import {test,expect} from '@playwright/test';

// The production isolation service worker intercepts same-origin API calls;
// Playwright page.route only sees network requests when it is blocked.
test.use({serviceWorkers:'block'});

// Serula no longer offers Sparrow CLI ZIP export. Verify the supported DXF
// flow does not download or charge an unauthenticated visitor.
test('DXF export requires authorization and never downloads after a 401 response',async({page})=>{
  let authorizationRequests=0;
  await page.route('**/api/export/authorize',async route=>{
    authorizationRequests++;
    await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'DXF indirmek için giriş yapmalısınız.'})});
  });
  await page.goto('/');
  await expect(page.locator('#root .app')).toBeVisible();
  await page.getByRole('button',{name:'Şekil çiz'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await expect(page.locator('.part-row')).toHaveCount(1,{timeout:20000});
  await expect(page.getByRole('button',{name:'DXF İndir',exact:true})).toBeEnabled();
  const download=page.waitForEvent('download',{timeout:4000}).then(()=>true,()=>false);
  await page.getByRole('button',{name:'DXF İndir',exact:true}).click();
  await expect.poll(async()=>{
    if(authorizationRequests)return 'authorized';
    const banner=(await page.locator('.error-banner').allTextContents()).join(' | ');
    return banner?`export-error: ${banner}`:'waiting';
  },{timeout:10000,message:'DXF export must reach authorization or report a geometry error'}).toBe('authorized');
  await expect(page.locator('.error-banner')).toContainText('DXF indirmek için giriş yapmalısınız.');
  expect(await download).toBe(false);
});
