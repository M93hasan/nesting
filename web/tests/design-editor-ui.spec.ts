import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('admin opens full-screen editor, selects actual layer, changes styles and undoes',async({page})=>{
  await page.route('**/api/auth/admin-me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}})}));
  await page.route('**/api/admin/design/versions',r=>r.fulfill({status:200,contentType:'application/json',body:'{"versions":[]}'}));
  await page.route('**/api/admin/design/publications',r=>r.fulfill({status:200,contentType:'application/json',body:'{"publications":[]}'}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Tasarım Editörünü Aç'}).click();
  await expect(page.getByRole('region',{name:'Serula görsel tasarım editörü'})).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Sayfalar ve katmanlar'})).toBeVisible();
  await page.screenshot({path:'test-results/design-editor-fullscreen.png',fullPage:true});
  await page.getByRole('button',{name:'Parça paneli',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Seçili öğe özellikleri'})).toContainText('Parça paneli');
  await page.getByRole('slider',{name:'Seçili öğe köşe yarıçapı'}).fill('24');
  await expect(page.getByRole('slider',{name:'Seçili öğe köşe yarıçapı'})).toHaveValue('24');
  await page.getByRole('button',{name:'Geri al'}).click();
  await expect(page.getByRole('slider',{name:'Seçili öğe köşe yarıçapı'})).toHaveValue('12');
  await page.getByRole('button',{name:'DXF indir butonu',exact:true}).click();
  await page.getByRole('textbox',{name:'Seçili bölüm başlığı'}).fill('DXF KAYDET');
  await expect(page.getByRole('textbox',{name:'Seçili bölüm başlığı'})).toHaveValue('DXF KAYDET');
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.export-actions .download-button:not(.corel-transfer-button)')).toContainText('DXF KAYDET');
  await page.getByRole('slider',{name:'Seçili buton yatay konumu'}).fill('55');
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('[data-design-zone="downloadButton"]')).toHaveCSS('transform','matrix(1, 0, 0, 1, 55, 0)');
  await page.getByRole('button',{name:'Geri al'}).click();
  await expect(page.getByRole('slider',{name:'Seçili buton yatay konumu'})).toHaveValue('0');
  // Move the actual DXF button through the non-interactive canvas overlay.
  const realButton=page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('[data-design-zone="downloadButton"]');
  await realButton.scrollIntoViewIfNeeded();
  const box=await realButton.boundingBox();
  const surface=await page.locator('.editor-click-shield').boundingBox();
  expect(box).not.toBeNull();expect(surface).not.toBeNull();
  const startX=box!.x+box!.width/2,startY=box!.y+box!.height/2;
  expect(startX).toBeGreaterThan(surface!.x);
  expect(startX).toBeLessThan(surface!.x+surface!.width);
  expect(startY).toBeGreaterThan(surface!.y);
  expect(startY).toBeLessThan(surface!.y+surface!.height);
  await page.mouse.move(startX,startY);
  await page.mouse.down();
  await page.mouse.move(startX+Math.min(25,surface!.x+surface!.width-startX-5),startY,{steps:4});
  await page.mouse.up();
  await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Seçili buton yatay konumu'}).inputValue())).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Geri al'}).click();
  await expect(page.getByRole('slider',{name:'Seçili buton yatay konumu'})).toHaveValue('0');
  await page.getByRole('button',{name:'Proje menüsü',exact:true}).click();
  await page.getByRole('slider',{name:'Seçili öğe yatay konumu'}).fill('40');
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('[data-design-zone="projectBar"]')).toHaveCSS('transform','matrix(1, 0, 0, 1, 40, 0)');
  await page.getByRole('button',{name:'Geri al'}).click();
  await expect(page.getByRole('slider',{name:'Seçili öğe yatay konumu'})).toHaveValue('0');
  await page.getByRole('button',{name:'Ekle',exact:true}).click();
  await page.getByRole('button',{name:'+ Metin'}).click();
  await expect(page.getByRole('textbox',{name:'Bileşen metni'})).toBeVisible();
  await page.getByRole('textbox',{name:'Bileşen metni'}).fill('Yeni duyuru');
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.design-widget-text')).toContainText('Yeni duyuru');
  await page.getByRole('button',{name:'Çoğalt'}).click();
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.design-widget-text')).toHaveCount(2);
  await page.getByRole('button',{name:'Sil',exact:true}).click();
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.design-widget-text')).toHaveCount(1);
  await page.getByRole('button',{name:'Taslağı kaydet'}).click();
  await page.getByRole('button',{name:'Ekle',exact:true}).click();
  await page.getByRole('button',{name:'+ Başlık'}).click();
  await page.getByRole('button',{name:'Geçmiş',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Kaydedilmemiş taslağı sıfırla'}).click();
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.design-widget-heading')).toHaveCount(0);
  await page.getByRole('button',{name:'Mobil'}).click();
  await expect(page.locator('.editor-live-mobile')).toBeVisible();
  await page.getByRole('button',{name:'Katman panelini gizle'}).click();
  await expect(page.getByRole('complementary',{name:'Sayfalar ve katmanlar'})).toBeHidden();
  await page.getByRole('button',{name:'Katman panelini göster'}).click();
  await expect(page.getByRole('complementary',{name:'Sayfalar ve katmanlar'})).toBeVisible();
  await page.getByRole('button',{name:'Önizlemeyi büyüt'}).click();
  await expect(page.locator('.editor-stage-percent')).toContainText('90%');

});

test('palette components can be dropped on the real canvas and nudged by keyboard',async({page})=>{
  await page.route('**/api/auth/admin-me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',role:'admin',credits:0,unlimited:true}})}));
  await page.route('**/api/admin/design/versions',r=>r.fulfill({status:200,contentType:'application/json',body:'{"versions":[]}'}));
  await page.route('**/api/admin/design/publications',r=>r.fulfill({status:200,contentType:'application/json',body:'{"publications":[]}'}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Tasarım Editörünü Aç'}).click();
  await page.getByRole('button',{name:'Ekle',exact:true}).click();
  await page.getByRole('button',{name:'+ Başlık'}).dragTo(page.getByRole('button',{name:'Önizlemeden bir öğe seç'}));
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.design-widget-heading')).toHaveCount(1);
  await page.locator('.editor-layer-tree').getByRole('button',{name:'Öğe: Yeni başlık'}).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider',{name:'Bileşen Yatay konum'})).toHaveValue('1');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('slider',{name:'Bileşen Yatay konum'})).toHaveValue('0');
});

test('admin can open already published component layout as an editable draft without publishing',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:1,email:'qa@example.test',role:'admin',credits:0,unlimited:true}})}));
  await page.route('**/api/admin/design/versions',route=>route.fulfill({status:200,contentType:'application/json',body:'{"versions":[]}'}));
  await page.route('**/api/admin/design/publications',route=>route.fulfill({status:200,contentType:'application/json',body:'{"publications":[]}'}));
  let publicationMutations=0;
  await page.route('**/api/admin/design/publish',route=>{publicationMutations++;return route.fulfill({status:403,body:'{"error":"not allowed"}'});});
  await page.route('**/api/design/published',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    published:{format:'serula-design-v1',design:{
      background:'#121421',panel:'#242935',accent:'#5278ed',radius:12,spacing:16,fontSize:15,heading:'Canlı Serula',
      blocks:[{id:'widget-live12345',kind:'heading',region:'canvas',text:'Canlı Başlık'}]
    }}
  })}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Tasarım Editörünü Aç'}).click();
  await page.getByRole('button',{name:'Geçmiş',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Canlı tasarımı düzenlemeye aç'}).click();
  await expect(page.getByRole('button',{name:'Öğe: Canlı Başlık'})).toHaveCount(0);
  await page.getByRole('button',{name:'Katmanlar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Öğe: Canlı Başlık'})).toBeVisible();
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.design-widget-heading')).toContainText('Canlı Başlık');
  expect(publicationMutations).toBe(0);
});
