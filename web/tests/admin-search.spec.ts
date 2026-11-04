import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

const adminUser={user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}};
const testUsers=[
  {id:10,email:'ali@example.test',name:'Ali',role:'operator',credits:3,unlimited:false},
  {id:20,email:'zeynep@example.test',name:'Zeynep',role:'operator',credits:5,unlimited:false}
];

test.beforeEach(async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminUser)}));
  await page.route('**/api/admin/users',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({users:testUsers,onlineCount:0})}));
  await page.route('**/api/admin/settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({settings:{materialWidthMm:1400,clearanceMm:0,marginMm:0,rotation:'half',materialType:'roll',solverPreset:'standard'}})}));
});

test('global admin search finds settings and opens the matching form control',async({page})=>{
  await page.goto('/admin');
  const search=page.getByRole('searchbox',{name:'Tüm ayarlarda ara'});
  await expect(search).toBeVisible();
  await search.fill('rotasyon');
  const results=page.getByRole('group',{name:'Ayar arama sonuçları'});
  await expect(results.getByRole('button',{name:/Rotasyon – kullanıcı/})).toBeVisible();
  await results.getByRole('button',{name:/Rotasyon – sistem/}).click();
  await expect(page.getByRole('heading',{name:'Sistem Varsayılanları'}).first()).toBeVisible();
  await expect(page.locator('[data-admin-search="system-rotation"] select')).toBeFocused();
  await expect(search).toHaveValue('');
  await search.fill('bulunmayan-ayar-xyz');
  await expect(results).toContainText('Eşleşen ayar bulunamadı.');
  await search.press('Escape');
  await expect(search).toHaveValue('');
});

test('user settings searches accounts by name and email without losing the original selector',async({page})=>{
  await page.route('**/api/admin/users/20/settings',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({settings:{materialWidthMm:1400,clearanceMm:0,marginMm:0,rotation:'half',materialType:'roll',solverPreset:'standard'},custom:false})
  }));
  await page.route('**/api/admin/users/20/support',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({support:null})
  }));
  await page.goto('/admin');
  await page.getByRole('button',{name:'Kullanıcı Ayarları'}).click();
  const search=page.getByRole('searchbox',{name:'Kullanıcı ayarlarında kullanıcı ara'});
  const results=page.getByRole('group',{name:'Kullanıcı arama sonuçları'});
  await search.fill('zeynep@');
  await expect(results).toContainText('1 kullanıcı bulundu');
  await expect(results.getByRole('button',{name:/Zeynep/})).toHaveCount(1);
  await results.getByRole('button',{name:/Zeynep/}).click();
  await expect(page.getByLabel('Kullanıcı seç')).toHaveValue('20');
  await expect(page.locator('.admin-selected-user')).toContainText('Zeynep');
  await expect(search).toHaveValue('');
  await search.fill('olmayan@example.test');
  await expect(results).toContainText('0 kullanıcı bulundu');
  await expect(page.getByLabel('Kullanıcı seç')).toHaveValue('20');
});

test('admin global search stays within a phone width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/admin');
  await page.getByRole('searchbox',{name:'Tüm ayarlarda ara'}).fill('parça');
  await expect(page.getByRole('group',{name:'Ayar arama sonuçları'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
