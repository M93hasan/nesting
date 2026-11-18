import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.use({serviceWorkers:'block'});
const rectangle=(x:number,y:number,w:number,h:number,layer:string)=>[
 '0','LWPOLYLINE','8',layer,'90','4','70','1',
 ...[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].flatMap(([px,py])=>['10',String(px),'20',String(py)])
].join('\n')+'\n';
const input=['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC',
 '0','SECTION','2','ENTITIES',
 (rectangle(0,0,80,50,'CUT')+rectangle(20,10,15,12,'INNER')).trimEnd(),
 '0','ENDSEC','0','EOF'].join('\n')+'\n';

test('anonymous imported DXF download calls the stubbed authorization API and produces a file',async({page})=>{
 test.setTimeout(90000);
 const errors:string[]=[],api:string[]=[];
 let authorizedPayload:{dxf:string;projectJson:string}|undefined;
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/export/authorize',async route=>{
   api.push(route.request().method());
   authorizedPayload=route.request().postDataJSON() as {dxf:string;projectJson:string};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exportId:4242})});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.add-shape').getByRole('button',{name:'DXF İçe Aktar',exact:true})).toBeVisible();
 const clear=page.getByRole('button',{name:'Tümünü sil'});
 if(await clear.isEnabled())await clear.click();
 await expect(page.locator('.part-row')).toHaveCount(0);
 await page.locator('input[type="file"][accept*=".dxf"]').first().setInputFiles({name:'qa-export.dxf',mimeType:'application/dxf',buffer:Buffer.from(input)});
 const row=page.locator('.part-row').filter({hasText:'80 × 50'});
 await expect(row).toHaveCount(1);
 await row.locator('input').first().fill('2');
 await page.getByLabel('Malzeme genişliği').fill('85');
 await page.getByLabel('Durdurma koşulu').selectOption('10');
 await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
 await expect(page.locator('.run-state')).toContainText('Tamamlandı',{timeout:25000});
 await page.getByRole('button',{name:'En iyi geçerli yerleşim',exact:true}).click();
 const button=page.getByRole('button',{name:'DXF İndir',exact:true});
 await expect(button).toBeEnabled();
 const downloadPromise=page.waitForEvent('download',{timeout:16000}).catch(()=>null);
 await button.click();
 const downloaded=await downloadPromise;
 console.log('DXF_EXPORT_QA '+JSON.stringify({errors,authCalls:api.length,download:!!downloaded,errorBanners:await page.locator('.error-banner').allTextContents()}));
 expect(errors).toEqual([]);
 expect(api).toEqual(['POST']);
 expect(downloaded,'Download should be emitted after authorizing').not.toBeNull();
 if(downloaded){
   const dxf=await readFile(await downloaded.path(),'utf8');
   expect(dxf).toContain('$INSUNITS');
   expect(dxf).toContain('LWPOLYLINE');
   expect(dxf.match(/LWPOLYLINE/g)?.length).toBeGreaterThanOrEqual(2);
   expect(authorizedPayload?.dxf).toBe(dxf);
   expect(JSON.parse(authorizedPayload!.projectJson)).toHaveProperty('parts');
   expect(downloaded.suggestedFilename()).toMatch(/\.dxf$/i);
 }
});
