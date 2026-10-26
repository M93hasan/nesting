import {test,expect} from '@playwright/test';

test('settings retain measurement units after presentation cleanup',async({page})=>{
  await page.goto('/settings.html');
  await expect(page.locator('#units')).toBeVisible();
});

test('Google sign-in page remains available',async({page})=>{
  await page.goto('/google-login.html');
  await expect(page.getByRole('heading',{name:'Serula Nesting'})).toBeVisible();
});

test('workspace retains DXF export action',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'DXF İndir'})).toBeVisible();
});
