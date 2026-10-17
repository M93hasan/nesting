import {expect,test,type Page} from '@playwright/test';

test.use({serviceWorkers:'block'});
const user={id:123,name:'Yeni Kullanıcı',email:'new@example.test',role:'user',credits:5,unlimited:false};
async function mockAccount(page:Page,{signedIn=false,pending=false}:{signedIn?:boolean;pending?:boolean}={}){
  const statuses:string[]=[],writes:string[]=[];
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(request.method()==='POST')writes.push(path);
    if(path==='/api/auth/register'){signedIn=true;pending=true;return route.fulfill({status:201,json:{user}});}
    if(path==='/api/auth/me')return route.fulfill({json:{user:signedIn?user:null}});
    if(path==='/api/onboarding'){
      if(request.method()==='POST'){statuses.push(request.postDataJSON().status);pending=false;return route.fulfill({json:{ok:true}});}
      return route.fulfill({json:{pending}});
    }
    return route.fulfill({json:{locale:'tr',settings:{},allowed:false,corel:false,user:null,support:null}});
  });
  return{statuses,writes};
}

test('new email registration starts a keyboard accessible tour and completion stays saved on reload',async({page})=>{
  const state=await mockAccount(page);await page.goto('/');
  await page.getByRole('button',{name:'Giriş yap',exact:true}).click();
  const auth=page.locator('.auth-overlay');await auth.getByRole('button',{name:'Kayıt ol',exact:true}).click();
  await auth.getByLabel('Adınız',{exact:true}).fill(user.name);await auth.getByLabel('E-posta',{exact:true}).fill(user.email);await auth.getByLabel('Parola',{exact:true}).fill('valid-password');
  await auth.getByRole('button',{name:'Hesap oluştur',exact:true}).click();
  const tour=page.locator('.welcome-tour');await expect(tour).toBeVisible();
  await expect(page.locator('#tour-title')).toBeFocused();
  await expect(tour).toHaveCSS('font-size','12px');await expect(tour).toHaveCSS('font-weight','500');
  await tour.getByRole('button',{name:'Tura başla',exact:true}).click();await expect(page.locator('#tour-title')).toHaveText('1. Parçalarınızı ekleyin');
  await tour.getByRole('button',{name:'Geri',exact:true}).click();await expect(page.locator('#tour-title')).toHaveText("Serula'ya hoş geldiniz");
  await tour.getByRole('button',{name:'Tura başla',exact:true}).click();
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('.welcome-tour'))).toBe(true);
  await page.keyboard.press('r');await expect(page.locator('.part-row')).toHaveCount(0);
  for(let step=1;step<7;step++)await tour.getByRole('button',{name:'İleri',exact:true}).click();
  await expect(page.locator('#tour-title')).toHaveText('7. DXF olarak indirin');
  await tour.getByRole('button',{name:'Tamamla',exact:true}).click();await expect(tour).toHaveCount(0);
  await expect.poll(()=>state.statuses).toEqual(['completed']);
  expect(state.writes.filter(path=>!['/api/auth/register','/api/onboarding'].includes(path))).toEqual([]);
  await page.evaluate(()=>localStorage.removeItem('serula-tour-v1:123'));await page.reload();
  await expect(page.getByRole('button',{name:'Yardım',exact:true})).toBeVisible();await expect(tour).toHaveCount(0);
});

test('existing accounts can replay from Help, Escape dismisses, and a later login does not repeat it',async({page})=>{
  const state=await mockAccount(page,{signedIn:true});await page.goto('/');
  await expect(page.getByRole('button',{name:'Yardım',exact:true})).toBeVisible();await expect(page.locator('.welcome-tour')).toHaveCount(0);
  await page.getByRole('button',{name:'Yardım',exact:true}).click();await page.getByRole('button',{name:'Tanıtım turunu başlat',exact:true}).click();
  await expect(page.locator('.welcome-tour')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.locator('.welcome-tour')).toHaveCount(0);await expect.poll(()=>state.statuses).toEqual(['dismissed']);
  await expect(page.getByRole('button',{name:'Yardım',exact:true})).toBeFocused();await page.reload();
  await expect(page.getByRole('button',{name:'Yardım',exact:true})).toBeVisible();await expect(page.locator('.welcome-tour')).toHaveCount(0);
});

test('first-login tour fits mobile viewports in every step and does not create or edit a project',async({page})=>{
  await page.setViewportSize({width:390,height:844});const state=await mockAccount(page,{signedIn:true,pending:true});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('/');
  const tour=page.locator('.welcome-tour');await expect(tour).toBeVisible();
  for(let step=0;step<8;step++){
    await expect.poll(async()=>page.locator('.tour-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})).toBe(true);
    if(step>0)await expect(page.locator('.tour-spotlight')).toBeVisible();
    await expect(page.locator('.part-row')).toHaveCount(0);
    if(step===7)await tour.getByRole('button',{name:'Tamamla',exact:true}).click();
    else await tour.getByRole('button',{name:step===0?'Tura başla':'İleri',exact:true}).click();
  }
  await expect.poll(()=>state.statuses).toEqual(['completed']);expect(state.writes).toEqual(['/api/onboarding']);expect(errors).toEqual([]);
});

test('Arabic tour remains usable on a small screen without local storage and Skip is saved to the account',async({page})=>{
  await page.setViewportSize({width:360,height:640});
  const state=await mockAccount(page,{signedIn:true,pending:true});
  await page.route('**/api/preferences',route=>route.fulfill({json:{locale:'ar'}}));
  await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage unavailable');};Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
  await page.goto('/');const tour=page.locator('.welcome-tour');await expect(tour).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('#tour-title')).toHaveText('مرحباً بك في Serula');
  await tour.getByRole('button',{name:'ابدأ الجولة',exact:true}).click();
  for(let step=1;step<5;step++)await tour.getByRole('button',{name:'التالي',exact:true}).click();
  await expect.poll(async()=>page.locator('.tour-card').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})).toBe(true);
  await tour.getByRole('button',{name:'تخطي الجولة',exact:true}).click();await expect(tour).toHaveCount(0);
  await expect.poll(()=>state.statuses).toEqual(['dismissed']);
  await page.reload();await expect(page.locator('.auth-account-menu')).toBeVisible();await expect(tour).toHaveCount(0);
});
