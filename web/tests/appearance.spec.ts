import {expect,test,type Page} from '@playwright/test';
test.use({serviceWorkers:'block'});
const initial={background:'#2f396b',panel:'#192142'};
async function backend(page:Page){
  const state={saved:{...initial},writes:[] as unknown[],fail:false,loadFail:false,hold:false,release:()=>{}};
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==='/api/appearance'){
      if(state.loadFail)return route.fulfill({status:503,json:{error:'unavailable'}});
      const appearance={...state.saved};
      if(state.hold){state.hold=false;await new Promise<void>(resolve=>{state.release=resolve;});}
      return route.fulfill({json:{appearance}});
    }
    if(path==='/api/admin/appearance'){
      state.writes.push(request.postDataJSON());
      if(state.fail)return route.fulfill({status:403,json:{error:'Yetkisiz.'}});
      state.saved=request.postDataJSON().appearance;return route.fulfill({json:{appearance:state.saved}});
    }
    return route.fulfill({json:path==='/api/auth/admin-me'?{user:{id:1,name:'Örnek',email:'admin@example.test',role:'admin'}}:{user:null,users:[],settings:{},logs:[],chats:[],locale:'tr'}});
  });
  return state;
}
async function editor(page:Page){
  await page.goto('/admin');await page.getByRole('button',{name:'Görünüm',exact:true}).click();await expect(page.getByLabel('Ana arka plan',{exact:true})).toBeVisible();
}
async function pick(page:Page,label:string,color:string){
  await page.getByLabel(label,{exact:true}).evaluate((element,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);
    element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));
  },color);
}

test('live colors stay private until Save, abandoned changes restore, and saved colors survive reload',async({page})=>{
  const state=await backend(page);await editor(page);
  await pick(page,'Ana arka plan','#445588');await pick(page,'Panel rengi','#223344');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(68, 85, 136)');
  await expect(page.locator('.admin-sidebar')).toHaveCSS('background-image','linear-gradient(128deg, rgb(34, 51, 68), rgb(34, 51, 68))');
  expect(state.writes).toEqual([]);expect(state.saved).toEqual(initial);
  await page.getByRole('button',{name:'Genel Bakış',exact:true}).click();await expect(page.locator('body')).toHaveCSS('background-color','rgb(47, 57, 107)');
  await page.getByRole('button',{name:'Görünüm',exact:true}).click();await expect(page.getByLabel('Ana arka plan',{exact:true})).toHaveValue(initial.background);
  await pick(page,'Ana arka plan','#445588');await pick(page,'Panel rengi','#223344');await page.getByRole('button',{name:'Herkes için kaydet',exact:true}).click();
  await expect(page.getByText(/Renkler herkes için kaydedildi/)).toBeVisible();expect(state.writes).toEqual([{appearance:{background:'#445588',panel:'#223344'}}]);
  await page.reload();await expect(page.locator('body')).toHaveCSS('background-color','rgb(68, 85, 136)');
  await page.goto('/');await expect(page.getByRole('button',{name:'Şekil çiz',exact:true})).toBeVisible();await expect(page.locator('body')).toHaveCSS('background-color','rgb(68, 85, 136)');
});

test('a denied save keeps the preview available and Restore saved discards it without another write',async({page})=>{
  const state=await backend(page);state.fail=true;await editor(page);
  await page.getByRole('button',{name:'Antrasit',exact:true}).click();await page.getByRole('button',{name:'Herkes için kaydet',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Yetkisiz.');await expect(page.getByLabel('Ana arka plan',{exact:true})).toHaveValue('#151923');expect(state.saved).toEqual(initial);
  await page.getByRole('button',{name:'Kaydedilene dön',exact:true}).click();await expect(page.locator('body')).toHaveCSS('background-color','rgb(47, 57, 107)');expect(state.writes).toHaveLength(1);
});

test('mobile preset buttons work with the keyboard and a failed initial load can be retried',async({page})=>{
  await page.setViewportSize({width:390,height:844});const state=await backend(page);state.loadFail=true;
  await page.goto('/admin2');await page.getByRole('button',{name:'Görünüm',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Renkler yüklenemedi.');
  state.loadFail=false;await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await expect(page.getByLabel('Ana arka plan',{exact:true})).toBeVisible();
  const preset=page.getByRole('button',{name:'Lacivert',exact:true});await preset.focus();await preset.press('Enter');await expect(preset).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(6, 11, 36)');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await expect(page.getByLabel('Panel rengi',{exact:true})).toHaveCSS('height','44px');expect(state.writes).toEqual([]);
});

test('a stale public read cannot overwrite a successful save; focus fetches later global updates',async({page})=>{
  const state=await backend(page);await editor(page);
  state.hold=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect.poll(()=>state.hold).toBe(false);
  try{
    await page.getByRole('button',{name:'Antrasit',exact:true}).click();await page.getByRole('button',{name:'Herkes için kaydet',exact:true}).click();await expect(page.getByText(/Renkler herkes için kaydedildi/)).toBeVisible();
    state.release();await expect(page.locator('body')).toHaveCSS('background-color','rgb(21, 25, 35)');
    await page.getByRole('button',{name:'Genel Bakış',exact:true}).click();state.saved={background:'#223355',panel:'#334466'};
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('body')).toHaveCSS('background-color','rgb(34, 51, 85)');
  }finally{state.release();}
});
