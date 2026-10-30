import {test,expect} from '@playwright/test';

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
  const download=page.waitForEvent('download',{timeout:4000}).then(()=>true,()=>false);
  await page.getByRole('button',{name:'DXF İndir',exact:true}).click();
  await expect.poll(()=>authorizationRequests).toBe(1);
  await expect(page.getByText('DXF indirmek için giriş yapmalısınız.',{exact:false}).first()).toBeVisible();
  expect(await download).toBe(false);
});
