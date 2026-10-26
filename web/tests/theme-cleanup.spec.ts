import {test,expect} from '@playwright/test';

test('theme choices are removed while settings remain available',async({page})=>{
  await page.goto('/settings.html');
  await expect(page.locator('#theme')).toHaveCount(0);
  await expect(page.locator('#units')).toBeVisible();
  await page.goto('/google-login.html');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(page.getByRole('heading',{name:'Serula Nesting'})).toBeVisible();
});

test('workspace keeps functional export actions without a theme toggle',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.theme-toggle')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'DXF İndir'})).toBeVisible();
});
