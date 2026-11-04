import {test,expect} from '@playwright/test';

test('new registration displays the supplied six-digit OTP card and blocks login until verified',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  let verified=false,verificationRequests=0,resendRequests=0;
  const user={id:987,email:'new-member@example.com',name:'New Member',role:'user',credits:5,unlimited:false};
  await page.route('**/api/auth/me',route=>route.fulfill({status:verified?200:401,contentType:'application/json',body:JSON.stringify(verified?{user}:{user:null})}));
  await page.route('**/api/auth/register',route=>route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({verificationRequired:true,email:user.email,challenge:'a'.repeat(64),expiresInSeconds:600})}));
  await page.route('**/api/auth/resend-verification',route=>{
    resendRequests++;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({verificationRequired:true,email:user.email,challenge:'b'.repeat(64)})});
  });
  await page.route('**/api/auth/verify-email',route=>{
    verificationRequests++;
    const payload=route.request().postDataJSON();
    if(payload.challenge!=='b'.repeat(64)||payload.code!=='123456')
      return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Doğrulama kodu hatalı.'})});
    verified=true;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user})});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Giriş yap',exact:true}).first().click();
  await page.getByRole('button',{name:'Kayıt ol',exact:true}).click();
  await page.getByLabel('Adınız').fill('New Member');
  await page.getByLabel('E-posta').fill(user.email);
  await page.getByLabel('Parola',{exact:true}).fill('safe-password-123');
  await page.getByRole('button',{name:'Hesap oluştur'}).click();
  const form=page.locator('.serula-otp-form');
  await expect(form).toBeVisible();
  await expect(form.getByText('E-posta doğrulama')).toBeVisible();
  await expect(form).toHaveCSS('border-radius','15px');
  const digits=form.locator('.serula-otp-digit');
  await expect(digits).toHaveCount(6);
  await expect(form.getByRole('button',{name:'Doğrula ve giriş yap'})).toBeDisabled();
  await digits.first().fill('654321');
  await expect(form.getByRole('button',{name:'Doğrula ve giriş yap'})).toBeEnabled();
  await form.getByRole('button',{name:'Doğrula ve giriş yap'}).click();
  await expect(form.getByRole('alert')).toContainText('hatalı');
  await form.getByRole('button',{name:'Yeni kod gönder'}).click();
  expect(resendRequests).toBe(1);
  await digits.first().fill('123456');
  await form.getByRole('button',{name:'Doğrula ve giriş yap'}).click();
  await expect(form).toHaveCount(0);
  expect(verificationRequests).toBe(2);
  await expect(page.getByRole('button',{name:'Giriş yap',exact:true})).toHaveCount(0);
});

test('OTP card remains within phone screen without disturbing other buttons',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,contentType:'application/json',body:'{"user":null}'}));
  await page.route('**/api/auth/register',route=>route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({verificationRequired:true,email:'phone@example.com',challenge:'a'.repeat(64)})}));
  await page.goto('/');
  await page.getByRole('button',{name:'Giriş yap',exact:true}).first().click();
  await page.getByRole('button',{name:'Kayıt ol',exact:true}).click();
  await page.getByLabel('Adınız').fill('Phone');
  await page.getByLabel('E-posta').fill('phone@example.com');
  await page.getByLabel('Parola',{exact:true}).fill('safe-password-123');
  await page.getByRole('button',{name:'Hesap oluştur'}).click();
  await expect(page.locator('.serula-otp-form')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('.serula-otp-form .serula-otp-digit')).toHaveCount(6);
  await page.getByRole('button',{name:'Giriş ekranına dön'}).click();
  await expect(page.getByRole('button',{name:'Giriş yap',exact:true}).last()).toBeVisible();
});
