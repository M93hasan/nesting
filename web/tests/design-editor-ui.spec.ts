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
  console.log('EDITOR_PREVIEW_DIAGNOSTIC',JSON.stringify({
    parent:await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('serula-design-studio-live-preview-v1')||'null');return d?.zoneStyles?.downloadButton??null;}),
    child:await page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('body').evaluate(()=>{const d=JSON.parse(localStorage.getItem('serula-design-studio-live-preview-v1')||'null');return {style:d?.zoneStyles?.downloadButton??null,preview:new URLSearchParams(location.search).get('design-preview')}})
  }));
  await page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('body').evaluate(()=>window.dispatchEvent(new Event('storage')));
  await expect(page.frameLocator('iframe[title="Gerçek Serula Nesting ekranı"]').locator('.export-actions .download-button:not(.corel-transfer-button)')).toContainText('DXF KAYDET');
  await page.getByRole('button',{name:'Mobil'}).click();
  await expect(page.locator('.editor-live-mobile')).toBeVisible();
});
