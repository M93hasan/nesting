import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('Puck opens safely and switches to the real non-interactive Nesting preview',async({page})=>{
  await page.route('**/api/auth/admin-me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})}));
  await page.route('**/api/admin/design/versions',r=>r.fulfill({status:200,contentType:'application/json',body:'{"versions":[]}'}));
  await page.route('**/api/admin/design/publications',r=>r.fulfill({status:200,contentType:'application/json',body:'{"publications":[]}'}));
  await page.route('**/api/design/published',r=>r.fulfill({status:200,contentType:'application/json',body:'{"published":null}'}));
  let savedDesign:unknown=null;
  await page.route('**/api/admin/design/draft',async route=>{
    if(route.request().method()==='POST')savedDesign=JSON.parse(route.request().postData()??'null');
    await route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await expect(page.getByRole('region',{name:'Puck görsel tasarım editörü'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Nesting Bileşenleri',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/puck-editor-fullscreen.png',fullPage:true});
  await page.getByText('Sunucu taslağını kaydet',{exact:true}).click();
  await expect.poll(()=>savedDesign).not.toBeNull();
  expect(savedDesign).toMatchObject({format:'serula-design-v1',design:{background:'#121421',radius:12}});
  expect(JSON.stringify(savedDesign)).not.toContain('"content"');
  await page.getByRole('button',{name:'Gerçek ekran'}).click();
  const preview=page.locator('iframe[title="Puck gerçek Nesting önizlemesi"]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('src',/design-preview=1/);
  await page.getByRole('button',{name:'Mobil'}).click();
  await expect(preview).toHaveCSS('width','390px');
  await page.getByRole('button',{name:'Bileşen editörü'}).click();
  await expect(page.getByRole('heading',{name:'Nesting Bileşenleri',exact:true})).toBeVisible();
});

test('a failed Puck asset shows a recovery panel rather than an unusable admin page',async({page})=>{
  await page.route('**/api/auth/admin-me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})}));
  await page.route(/\/assets\/PuckDesignStudio-[^/]+\.js(?:\?.*)?$/,route=>route.fulfill({status:503,contentType:'text/plain',body:'Temporarily unavailable'}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await expect(page.getByRole('alert',{name:'Puck editör yükleme hatası'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Puck Editor açılamadı'})).toBeVisible();
  await page.getByRole('button',{name:'Eski editöre geç'}).click();
  await expect(page.getByRole('region',{name:'Serula görsel tasarım editörü'})).toBeVisible();
});
test('opening Puck with an existing safe local draft preserves that draft',async({page})=>{
  await page.addInitScript(()=>{
    if(location.pathname==='/admin'){
      localStorage.setItem('serula-design-studio-draft-v1',JSON.stringify({
        background:'#112233',panel:'#334455',accent:'#5278ed',
        radius:20,spacing:16,fontSize:15,heading:'Önceden kayıtlı tasarım',
        zoneStyles:{downloadButton:{radius:18,text:'DXF KAYDET'}},
        workspaceOrder:['parts','canvas','material']
      }));
    }
  });
  await page.route('**/api/auth/admin-me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})}));
  await page.route('**/api/admin/design/versions',r=>r.fulfill({status:200,contentType:'application/json',body:'{"versions":[]}'}));
  await page.route('**/api/admin/design/publications',r=>r.fulfill({status:200,contentType:'application/json',body:'{"publications":[]}'}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await expect(page.getByRole('region',{name:'Puck görsel tasarım editörü'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Nesting Bileşenleri',exact:true})).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('serula-design-studio-draft-v1')||'{}'));
  expect(saved).toMatchObject({heading:'Önceden kayıtlı tasarım',radius:20,zoneStyles:{downloadButton:{radius:18,text:'DXF KAYDET'}}});
});

test.describe('production-like service worker',()=>{
  test.use({serviceWorkers:'allow'});
  test('Puck opens after isolation service worker registration',async({page})=>{
    await page.route('**/api/auth/admin-me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})}));
    await page.goto('/admin');
    // The original bug only existed after the production isolation SW took control.
    await expect.poll(()=>page.evaluate(()=>({
      controlled:!!navigator.serviceWorker?.controller,isolated:crossOriginIsolated
    })),{timeout:20000}).toEqual({controlled:true,isolated:true});
    await expect(page.getByRole('button',{name:/Görünüm/})).toBeVisible();
    await page.getByRole('button',{name:/Görünüm/}).click();
    await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
    await expect(page.getByRole('region',{name:'Puck görsel tasarım editörü'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Nesting Bileşenleri',exact:true})).toBeVisible();
  });
});
