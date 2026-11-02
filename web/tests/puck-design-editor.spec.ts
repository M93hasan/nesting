import {test,expect} from '@playwright/test';

const adminUser={user:{id:1,email:'qa@example.test',name:'QA',role:'admin',credits:0,unlimited:true}};
async function openBuilder(page:import('@playwright/test').Page){
  await page.route('**/api/auth/admin-me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(adminUser)}));
  await page.goto('/admin');
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await expect(page.getByRole('button',{name:'Bağımsız Puck taslağı'})).toBeVisible();
  await page.getByRole('button',{name:'Bağımsız Puck taslağı'}).click();
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
    await expect(preview).toHaveCSS('width','1440px');
    await expect(page.getByRole('button',{name:'Mobil'})).toHaveCount(0);
  });
  test('dragging a real palette component inserts it into Puck content',async({page})=>{
    await openBuilder(page);
    const source=page.getByTestId('drawer-item:Card');
    // Root contains components, so Puck disables direct collision there.
    // The empty Flex slot is an actual supported droppable target.
    const target=page.locator('[data-puck-dropzone="demo-insert-here:items"]');
    await expect(target).toBeVisible();
    // Puck 0.24 debounces zone changes (100ms). Hold the pointer over the
    // actual empty slot long enough to register its collision before release.
    await source.hover();
    const from=await source.boundingBox();
    const to=await target.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    const sx=from!.x+from!.width/2,sy=from!.y+from!.height/2;
    const tx=to!.x+to!.width/2,ty=to!.y+to!.height/2;
    await page.mouse.down();
    await page.mouse.move(sx+12,sy+8,{steps:5});
    await page.mouse.move(tx,ty,{steps:35});
    await page.waitForTimeout(350);
    await page.mouse.move(tx+2,ty+2,{steps:3});
    await page.waitForTimeout(160);
    await page.mouse.up();
    // The Puck editor may select the closest root component even when
    // hovering over a nested slot. Assert the actual invariant: a new
    // Card is inserted, appears in the canvas and is saved in Puck JSON.
    await expect.poll(async()=>page.evaluate(()=>{
      const doc=JSON.parse(localStorage.getItem('serula-puck-page-v1')??'null');
      return doc?.content?.filter((item:{type:string})=>item.type==='Card').length ?? 0;
    }),{timeout:10000}).toBe(1);
    const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('serula-puck-page-v1')!));
    expect(data.content).toHaveLength(6);
    expect(data.content.find((item:{type:string})=>item.type==='Card')?.props.title).toBe('Bilgi kartı');
    expect(data.content.some((item:{props:{id:string}})=>item.props.id==='demo-insert-here')).toBe(true);
    await expect(page.locator('.puck-builder-card')).toBeVisible();
    // Merely inserting an element is not sufficient: its real field must edit
    // Puck JSON, and that edit must survive opening the editor again.
    await page.locator('[data-puck-component^="Card-"]').last().click();
    const titleField=page.getByRole('textbox',{name:'Kart başlığı',exact:true});
    await expect(titleField).toBeVisible();
    await titleField.fill('Düzenlenen kart başlığı');
    await expect.poll(async()=>page.evaluate(()=>{
      const doc=JSON.parse(localStorage.getItem('serula-puck-page-v1')||'null');
      return doc?.content?.find((item:{type:string})=>item.type==='Card')?.props?.title;
    })).toBe('Düzenlenen kart başlığı');
    await page.getByRole('button',{name:'Kapat ✕'}).click();
    await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
    await page.getByRole('button',{name:'Bağımsız Puck taslağı'}).click();
    await expect(page.locator('.puck-builder-card')).toContainText('Düzenlenen kart başlığı');
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

test('native Puck desktop fields edit existing content and persist across reload',async({page})=>{
  await openBuilder(page);
  await page.locator('.puck-builder-heading').first().click();
  const textField=page.getByRole('textbox',{name:'Başlık',exact:true});
  await expect(textField).toBeVisible();
  await textField.fill('PC ile düzenlendi');
  await expect.poll(()=>page.evaluate(()=>{
    const doc=JSON.parse(localStorage.getItem('serula-puck-page-v1')||'null');
    return doc?.content?.[0]?.props?.text;
  })).toBe('PC ile düzenlendi');
  await page.reload();
  await page.getByRole('button',{name:/Görünüm/}).click();
  await page.getByRole('button',{name:'Puck Editörünü Aç'}).click();
  await page.getByRole('button',{name:'Bağımsız Puck taslağı'}).click();
  await expect(page.locator('.puck-builder-heading').first()).toContainText('PC ile düzenlendi');
});

test('PC-only view blocks the editor on narrow screens',async({page})=>{
  await page.setViewportSize({width:820,height:760});
  await openBuilder(page);
  await expect(page.getByText('Puck editörü yalnızca PC / geniş ekran için kullanılabilir.')).toBeVisible();
  await expect(page.locator('.puck-studio-desktop-content')).toBeHidden();
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
