import {test,expect} from '@playwright/test';

test('public sign-in template keeps password, registration and Google actions', async ({page}) => {
  await page.goto('/');

  const trigger=page.locator('#serula-account-slot .auth-login-header');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveClass(/auth-login-header/);
  await trigger.click();

  const dialog=page.locator('.auth-overlay .auth-card--serula-login');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Serula Nesting'})).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'E-posta'})).toBeVisible();
  await expect(dialog.getByLabel('Parola',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Google ile devam et'})).toBeVisible();
  await expect(dialog.locator('form .auth-login-submit')).toContainText('Giriş yap');

  await dialog.getByRole('button',{name:'Kayıt ol'}).click();
  await expect(dialog.getByRole('textbox',{name:'Adınız'})).toBeVisible();
  await expect(dialog.locator('form .auth-login-submit')).toContainText('Hesap oluştur');

  await dialog.getByRole('button',{name:'Şimdilik kapat'}).click();
  await expect(dialog).toBeHidden();
});

test('public sign-in is usable on a 390px viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('#serula-account-slot .auth-login-header').click();

  const dialog=page.locator('.auth-overlay .auth-card--serula-login');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Google ile devam et'})).toBeAttached();
  const box=await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(390);
});
