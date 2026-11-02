import {test,expect} from '@playwright/test';

// The Nesting isolation service worker proxies /api/* and can bypass Playwright route mocks.
test.use({serviceWorkers:'block'});

const published={format:'serula-design-v1',design:{background:'#113355',panel:'#223344',accent:'#556677',radius:17,spacing:16,fontSize:15,heading:'Test'}};

test('published design reaches the actual Nesting screen without changing its controls',async({page})=>{
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published})}));
  const publishedResponse=page.waitForResponse(response=>response.url().includes('/api/design/published'));
  await page.goto('/');
  const response=await publishedResponse;
  expect(response.status()).toBe(200);
  expect((await response.json()).published.design.background).toBe('#113355');
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

test('real Nesting structural panels use the editor panel order and safe per-zone styles',async({page})=>{
  const custom={...published,design:{...published.design,workspaceOrder:['material','canvas','parts'],zoneStyles:{header:{background:'#102030',radius:9},parts:{background:'#223355',shadow:12}}}};
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published:custom})}));
  await page.goto('/');
  await expect(page.locator('[data-design-zone="header"]')).toHaveCSS('background-color','rgb(16, 32, 48)');
  await expect(page.locator('[data-design-zone="parts"]')).toHaveCSS('background-color','rgb(34, 51, 85)');
  await expect(page.locator('[data-design-zone="material"]')).toHaveCSS('order','0');
  await expect(page.locator('[data-design-zone="parts"]')).toHaveCSS('order','2');
  await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
});

test('published reusable text and button are rendered in actual Nesting panels',async({page})=>{
  const blocks=[
    {id:'widget-abc12345',kind:'heading',region:'canvas',text:'Yeni üretim duyurusu',color:'#223344',devices:['desktop','tablet','mobile']},
    {id:'widget-def67890',kind:'button',region:'material',text:'Yönetimi aç',href:'/admin',devices:['desktop','tablet','mobile']}
  ];
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published:{...published,design:{...published.design,blocks}}})}));
  await page.goto('/');
  await expect(page.locator('.drawing-panel [data-design-block-id="widget-abc12345"]')).toContainText('Yeni üretim duyurusu');
  await expect(page.locator('.material-panel [data-design-block-id="widget-def67890"]')).toHaveAttribute('href','/admin');
  await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
});
