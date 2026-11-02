import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('admin appearance has no Puck or visual design editors',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})
  }));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await expect(page.getByRole('button',{name:'Puck Editörünü Aç'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Tasarım Editörünü Aç'})).toHaveCount(0);
  await expect(page.getByText('Puck Tasarım Editörü')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Görünüm/})).toBeVisible();
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
