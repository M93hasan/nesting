import {test,expect} from '@playwright/test';

const adminUser={user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}};
async function openBuilder(page:import('@playwright/test').Page){
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminUser)}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await expect(page.getByRole('region',{name:'Puck görsel tasarım editörü'})).toBeVisible();
}

test.describe('real Puck visual builder',()=>{
  test.use({serviceWorkers:'block'});
  test('shows upstream-style insertable component palette, nested layouts and local-only save',async({page})=>{
    await openBuilder(page);
    await expect(page.getByText('Nesting Tasarım Taslağı',{exact:true})).toBeVisible();
    for(const kind of ['Heading','Grid','Flex','Button','PartsPanel','NestingCanvas']){
      await expect(page.getByTestId('drawer-item:'+kind)).toBeVisible();
    }
    await expect(page.getByTestId('drawer-item:Heading')).not.toHaveClass(/disabled/i);
    await expect(page.frameLocator('iframe').locator('.puck-builder-grid')).toBeVisible();
    await page.screenshot({path:'test-results/puck-editor-fullscreen.png',fullPage:true});
    await page.getByText('Taslağı kaydet',{exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('serula-puck-page-v1'))).not.toBeNull();
    const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('serula-puck-page-v1')??'null'));
    expect(data.root.props.title).toBe('Serula Nesting çalışma alanı');
    expect(data.content[0].type).toBe('Heading');
    expect(data.content.some((item:{type:string})=>item.type==='Grid')).toBeTruthy();
    await page.getByRole('button',{name:'Gerçek Nesting ekranı'}).click();
    const preview=page.locator('iframe[title="Gerçek Nesting ekranı"]');
    await expect(preview).toBeVisible();
    await page.getByRole('button',{name:'Mobil'}).click();
    await expect(preview).toHaveCSS('width','390px');
  });
  test('dragging a real palette component inserts it into Puck content',async({page})=>{
    await openBuilder(page);
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('serula-puck-page-v1')??'null')?.content?.length ?? 4);
    const source=page.getByTestId('drawer-item:Card');
    const target=page.frameLocator('iframe').locator('.puck-builder-page-content');
    await source.dragTo(target,{targetPosition:{x:110,y:220}});
    console.log('PUCK_DND_DIAGNOSTIC',JSON.stringify({status:await page.locator('[role="status"]').allTextContents(),cardCount:await page.frameLocator('iframe').locator('.puck-builder-card').count(),dropTargets:await page.frameLocator('iframe').locator('[data-puck-dnd]').count(),storage:await page.evaluate(()=>localStorage.getItem('serula-puck-page-v1'))}));
    await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('serula-puck-page-v1')??'null')?.content?.length ?? 0),{timeout:10000}).toBe(before+1);
  });
  test('failed editor import shows recovery controls, not a blank app',async({page})=>{
    await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminUser)}));
    await page.route(/\/assets\/PuckDesignStudio-[^/]+\.js(?:\?.*)?$/,route=>route.fulfill({status:503,contentType:'text/plain',body:'Asset unavailable'}));
    await page.goto('/admin');
    await page.getByRole('button',{name:/Görünüm/}).click();
    await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
    await expect(page.getByRole('alert',{name:'Puck editör yükleme hatası'})).toBeVisible();
    await page.getByRole('button',{name:'Eski editöre geç'}).click();
    await expect(page.getByRole('region',{name:'Serula görsel tasarım editörü'})).toBeVisible();
  });
  test('opens previously saved real Puck data, without overwriting legacy draft',async({page})=>{
    await page.addInitScript(()=>{
      if(location.pathname==='/admin'){
        localStorage.setItem('serula-puck-page-v1',JSON.stringify({
          root:{props:{title:'Kendi Puck düzenim',background:'#112233',panel:'#ffffff',accent:'#405dd7'}},
          content:[{type:'Heading',props:{id:'saved-head',text:'KAYITLI',level:'h2',align:'center'}}]
        }));
        localStorage.setItem('serula-design-studio-draft-v1','legacy-intact');
      }
    });
    await openBuilder(page);
    const value=await page.evaluate(()=>JSON.parse(localStorage.getItem('serula-puck-page-v1')??'null'));
    expect(value.root.props.title).toBe('Kendi Puck düzenim');
    expect(value.content[0].props.text).toBe('KAYITLI');
    expect(await page.evaluate(()=>localStorage.getItem('serula-design-studio-draft-v1'))).toBe('legacy-intact');
  });
});

test.describe('production isolation worker',()=>{
  test.use({serviceWorkers:'allow'});
  test('opens Puck and still creates a Nesting shape with isolation enabled',async({page})=>{
    await openBuilder(page);
    await expect.poll(()=>page.evaluate(()=>({controlled:!!navigator.serviceWorker?.controller,isolated:crossOriginIsolated})),{timeout:20000}).toEqual({controlled:true,isolated:true});
    await expect(page.getByTestId('drawer-item:Grid')).toBeVisible();
    await page.getByRole('button',{name:'Kapat ✕'}).click();
    await page.goto('/');
    await page.getByRole('button',{name:'Şekil çiz',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Şekil ekle',exact:true}).click();
    await expect(page.locator('.part-row')).toHaveCount(1);
  });
});
