import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('admin has no appearance customization or visual design editors',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})
  }));
  await page.goto('/admin');
  await expect(page.getByRole('button',{name:'Puck Editörünü Aç'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Tasarım Editörünü Aç'})).toHaveCount(0);
  await expect(page.getByText('Puck Tasarım Editörü')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Görünüm/})).toHaveCount(0);
});

test('Nesting does not fetch or apply retired published visual designs',async({page})=>{
  let attempted=0;
  await page.route('**/api/design/published',route=>{
    attempted++;
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({published:{format:'serula-design-v1',
        design:{background:'#113355',panel:'#223344',accent:'#556677',radius:17,spacing:16,fontSize:15,heading:'Retired'}}})});
  });
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  expect(attempted).toBe(0);
  await expect(page.locator('.app')).not.toHaveCSS('background-color','rgb(17, 51, 85)');
  await expect(page.locator('.app > .header .tagline')).toContainText('Akıllı DXF yerleştirme');
  await expect(page.locator('.main-workspace > .drawing-panel')).toBeVisible();
  await expect(page.locator('.main-workspace > #parts-settings')).toBeVisible();
  await expect(page.locator('.main-workspace > .material-panel')).toBeVisible();
});

test('only obsolete editor browser drafts are cleared, unrelated project storage stays untouched',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('serula-puck-page-v1','old puck draft');
    localStorage.setItem('serula-puck-real-nesting-v1','old connected draft');
    localStorage.setItem('serula-design-studio-draft-v1','old design draft');
    localStorage.setItem('serula-design-studio-live-preview-v1','old preview');
    localStorage.setItem('serula-project-data-safety-test','preserve');
  });
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  const values=await page.evaluate(()=>({
    removed:[
      'serula-puck-page-v1','serula-puck-real-nesting-v1',
      'serula-design-studio-draft-v1','serula-design-studio-live-preview-v1'
    ].map(k=>localStorage.getItem(k)),
    preserved:localStorage.getItem('serula-project-data-safety-test')
  }));
  expect(values.removed).toEqual([null,null,null,null]);
  expect(values.preserved).toBe('preserve');
});
