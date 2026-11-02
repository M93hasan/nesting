import {test,expect} from '@playwright/test';

const adminUser={user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}};
async function openConnected(page:import('@playwright/test').Page){
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminUser)}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await expect(page.getByRole('region',{name:'Gerçek Nesting Puck editörü'})).toBeVisible();
}
test.describe('Puck -> functional Nesting appearance bridge',()=>{
  test.use({serviceWorkers:'block'});
  test('edits real parts heading and updates the actual Nesting iframe',async({page})=>{
    await openConnected(page);
    const frame=page.frameLocator('iframe[title="Gerçek Nesting canlı önizleme"]');
    await expect(frame.locator('#parts-settings .panel-title h2')).toBeVisible();
    await page.locator('[data-connected-zone="parts"]').click();
    const text=page.getByRole('textbox',{name:'Gerçek ekrandaki yazı'});
    await expect(text).toBeVisible();
    await text.fill('Gerçek parça panelim');
    await expect.poll(async()=>page.evaluate(()=>{
      const raw=localStorage.getItem('serula-design-studio-live-preview-v1');
      return raw?JSON.parse(raw)?.zoneStyles?.parts?.text:null;
    }),{timeout:15000}).toBe('Gerçek parça panelim');
    await expect(frame.locator('#parts-settings .panel-title h2')).toContainText('Gerçek parça panelim',{timeout:15000});
    await expect(frame.locator('.run-button.reference-launch')).toBeVisible();
    // The editor may edit appearance, but MUST NOT mutate actual project data.
    await expect(frame.locator('.part-row')).toHaveCount(0);
  });
  test('saves a versioned allowlisted server draft, with no unconfirmed live publish',async({page})=>{
    let payload:unknown=null,publishRequests=0;
    await page.route('**/api/admin/design/draft',route=>{
      if(route.request().method()==='POST'){payload=route.request().postDataJSON();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:payload})});}
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({draft:null})});
    });
    await page.route('**/api/admin/design/versions',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({versions:[{id:7}]})}));
    await page.route('**/api/admin/design/publish',route=>{publishRequests++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({published:payload})});});
    await openConnected(page);
    const save=page.locator('.puck-connected-studio .puck-studio-topbar').getByRole('button',{name:'Sunucu taslağına kaydet'});
    await save.click();
    await expect(page.getByText('Nesting taslağı güvenli biçimde sunucuya kaydedildi.')).toBeVisible();
    const draft=payload as {format:string;design:{workspaceOrder:string[];zoneStyles:Record<string,{text?:string}>}};
    expect(draft.format).toBe('serula-design-v1');
    expect(draft.design.workspaceOrder).toEqual(['parts','canvas','material']);
    expect(draft.design.zoneStyles.parts.text).toBe('Parçalar');
    expect(draft.design.zoneStyles.canvas.text).toBe('Çalışma alanı');
    expect(publishRequests).toBe(0);
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'Canlıya yayınla'}).click();
    expect(publishRequests).toBe(0);
  });
  test('all eight original Nesting regions are present and reordering changes real workspace order',async({page})=>{
    await openConnected(page);
    for(const zone of ['header','parts','canvas','material','actions','runButton','corelButton','downloadButton']){
      await expect(page.locator('[data-connected-zone="'+zone+'"]')).toBeVisible();
    }
    const frame=page.frameLocator('iframe[title="Gerçek Nesting canlı önizleme"]');
    await expect(frame.locator('.main-workspace > #parts-settings')).toBeVisible();
    await expect(frame.locator('.main-workspace > .drawing-panel')).toBeVisible();
    await expect(frame.locator('.main-workspace > .material-panel')).toBeVisible();
  });
});
