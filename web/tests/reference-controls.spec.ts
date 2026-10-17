import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('glass pointer choices, native keyboard selection and numeric fields keep their original behavior',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();
  await page.locator('input[type=file]').first().setInputFiles({name:'controls.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20"><rect width="20" height="20"/></svg>')});
  await expect(page.locator('.part-row')).toHaveCount(1);
  const material=page.getByRole('combobox',{name:/^Malzeme tipi/});
  await material.locator('..').locator('.glass-choice').getByText('Plaka',{exact:true}).click();
  await expect(material).toHaveValue('sheet');
  await expect(page.getByLabel(/^Plaka uzunluğu/)).toBeVisible();
  await material.focus();await material.press('ArrowUp');
  await expect(material).toHaveValue('roll');
  await expect(page.getByLabel(/^Plaka uzunluğu/)).toHaveCount(0);
  await material.press('ArrowDown');await expect(material).toHaveValue('sheet');
  const width=page.getByLabel(/^Malzeme genişliği/),gap=page.getByLabel(/^Parça aralığı/);
  await width.fill('0');await expect(page.getByRole('button',{name:'Parçaları yerleştir',exact:true})).toBeDisabled();
  await width.fill('1400');await gap.fill('0');
  await expect(gap).toHaveValue('0');await expect(page.getByRole('button',{name:'Parçaları yerleştir',exact:true})).toBeEnabled();
  await page.locator('.solver-options>summary').click();
  const preset=page.getByLabel(/^Arama modu/);
  await preset.locator('..').locator('.glass-choice').getByText('Hızlı',{exact:true}).click();
  await expect(preset).toHaveValue('fast');
  await expect(page.locator('#preset-description')).toContainText('en iyi nihai yerleşimi kaçırabilir');
  await page.getByRole('button',{name:'Giriş yap',exact:true}).click();
  const dialog=page.locator('.auth-overlay');
  await dialog.getByLabel('E-posta',{exact:true}).fill('ornek@example.test');
  await dialog.getByLabel('Parola',{exact:true}).fill('preview-password');
  await expect(dialog.getByLabel('E-posta',{exact:true})).toHaveValue('ornek@example.test');
  await expect(dialog.getByLabel('Parola',{exact:true})).toHaveAttribute('type','password');
  await expect(dialog.getByLabel('Parola',{exact:true})).toHaveAttribute('minlength','8');
  const language=dialog.locator('.language-select select');
  await language.selectOption('en');
  await expect(dialog.getByRole('textbox',{name:'Email',exact:true})).toHaveValue('ornek@example.test');
  await expect(dialog.locator('.wave-field').first().locator('.wave-letters')).toHaveText('Email');
  await language.selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(dialog.locator('.wave-field').first().locator('.wave-letters')).toHaveText('البريد الإلكتروني');
  await language.selectOption('tr');
  await dialog.getByRole('button',{name:'Şimdilik kapat',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('loading indicator follows a real pending request and honors reduced motion',async({page})=>{
  let release:()=>void=()=>{};
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/admin-me')return route.fulfill({json:{user:{id:1,name:'Örnek Yönetici',email:'test@example.test',role:'admin'}}});
    if(path==='/api/admin/users'){await pending;return route.fulfill({json:{users:[]}});}
    return route.fulfill({json:{adminApi:true,auth:true,userStore:true,chats:[],logs:[]}});
  });
  try{
    await page.goto('/admin');
    await page.getByRole('button',{name:/Kullanıcılar/}).click();
    await expect(page.locator('.admin-loading')).toBeVisible();
    await expect(page.locator('.admin-loading .reference-loader-ball')).toHaveCount(9);
    await page.emulateMedia({reducedMotion:'reduce'});
    await expect(page.locator('.reference-loader-ball').first()).toHaveCSS('animation-name','none');
    release();
    await expect(page.locator('.admin-loading')).toHaveCount(0);
    await expect(page.getByText('Kullanıcı bulunamadı',{exact:true})).toBeVisible();
  }finally{release();}
});
