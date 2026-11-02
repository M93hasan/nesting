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
    await expect(page.locator('.puck-builder-grid')).toBeVisible();
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
    const source=page.getByTestId('drawer-item:Card');
    // Root contains components, so Puck disables direct collision there.
    // The empty Flex slot is an actual supported droppable target.
    const target=page.locator('[data-puck-dropzone="demo-insert-here:items"]');
    await expect(target).toBeVisible();
    page.on('console',msg=>{if(msg.text().startsWith('PUCK_DOC_CHANGE'))console.log('PUCK_DOC_BROWSER',msg.text());});
    await source.dragTo(target,{targetPosition:{x:Math.min(65,(await target.boundingBox())!.width/2),y:65}});
    console.log('PUCK_DROP_RESULT',JSON.stringify({status:await page.locator('[role="status"]').allTextContents(),cardCount:await page.locator('.puck-builder-card').count(),dropZone:await target.evaluate(el=>({id:el.getAttribute('data-puck-dropzone'),box:el.getBoundingClientRect().toJSON()})),persisted:await page.evaluate(()=>localStorage.getItem('serula-puck-page-v1')),puckStatus:await page.getByRole('status').allTextContents(),topElements:await target.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+65;return {x,y,stack:document.elementsFromPoint(x,y).slice(0,8).map(n=>({tag:n.tagName,cls:n.className?.toString().slice(0,80),dnd:n.getAttribute('data-puck-dnd'),zone:n.getAttribute('data-puck-dropzone'),void:n.hasAttribute('data-puck-dnd-void')})),voidIds:[...document.querySelectorAll('[data-puck-dnd-void]')].map(n=>({id:n.getAttribute('data-puck-dnd'),box:n.getBoundingClientRect().toJSON(),parent:n.parentElement?.className?.toString().slice(0,90)}))}})}));
    await expect.poll(async()=>page.evaluate(()=>{
      const doc=JSON.parse(localStorage.getItem('serula-puck-page-v1')??'null');
      return doc?.content?.find((item:{props:{id:string}})=>item.props.id==='demo-insert-here')?.props?.items?.length ?? 0;
    }),{timeout:10000}).toBe(1);
    const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('serula-puck-page-v1')!));
    expect(data.content.find((item:{props:{id:string}})=>item.props.id==='demo-insert-here').props.items[0].type).toBe('Card');
    await expect(page.locator('.puck-builder-card')).toBeVisible();
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
