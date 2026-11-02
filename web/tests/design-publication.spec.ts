import {test,expect} from '@playwright/test';

const published={format:'serula-design-v1',design:{background:'#113355',panel:'#223344',accent:'#556677',radius:17,spacing:16,fontSize:15,heading:'Test'}};

test('published design reaches the actual Nesting screen without changing its controls',async({page})=>{
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published})}));
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await expect(page.locator('.app')).toHaveCSS('background-color','rgb(17, 51, 85)');
  await expect(page.locator('.app .header')).toHaveCSS('background-color','rgb(34, 51, 68)');
  await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
});

test('invalid publication is ignored and the Nesting interface remains usable',async({page})=>{
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published:{design:{...published.design,background:'url(javascript:bad)'}}})}));
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
  await expect(page.locator('style').filter({hasText:'.app {background:url('})).toHaveCount(0);
});

test('preview mode uses isolated browser draft rather than published design',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('serula-design-studio-live-preview-v1',JSON.stringify({background:'#334455',panel:'#445566',accent:'#557799',radius:8,spacing:16,fontSize:15})));
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published})}));
  await page.goto('/?design-preview=1');
  await expect(page.getByText('Tasarım editörü önizlemesi')).toBeVisible();
  await expect(page.locator('.app')).toHaveCSS('background-color','rgb(51, 68, 85)');
});
