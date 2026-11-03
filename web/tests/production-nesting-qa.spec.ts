import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// The application's isolation Service Worker intercepts same-origin API calls.
// Use Serula's supported serial fallback here so Playwright can safely mock billing.
test.use({serviceWorkers:'block'});

const LIVE_URL='https://serula.site/';
const EXPECTED_DEPLOY_SHA=process.env.NESTING_EXPECTED_LIVE_SHA;
const rectangle=(x:number,y:number,w:number,h:number,layer:string)=>[
  '0','LWPOLYLINE','8',layer,'90','4','70','1',
  ...[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].flatMap(([px,py])=>['10',String(px),'20',String(py)])
].join('\n')+'\n';
const TEST_DXF=[
  '0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC',
  '0','SECTION','2','ENTITIES',
  (rectangle(0,0,80,50,'CUT')+rectangle(20,10,15,12,'INNER')).trimEnd(),
  '0','ENDSEC','0','EOF'
].join('\n')+'\n';

test('live release marker and headless browser access diagnostic',async({page,request})=>{
  const version=await request.get(new URL('/deploy-version.txt',LIVE_URL).toString(),{timeout:30000});
  expect(version.status()).toBe(200);
  const release=await version.text();
  const deploySha=release.match(/Git commit:\s*([a-f0-9]{40})\b/)?.[1];
  expect(deploySha,'A published Git SHA must be available').toBeTruthy();
  if(EXPECTED_DEPLOY_SHA)expect(deploySha).toBe(EXPECTED_DEPLOY_SHA);
  const response=await page.goto(LIVE_URL,{waitUntil:'domcontentloaded',timeout:45000});
  const httpStatus=response?.status();
  if(httpStatus===403){
    const responseHeaders=response?.headers()??{};
    console.log('NESTING_QA '+JSON.stringify({event:'live-browser',status:'blocked-by-http-403',assetStatus:version.status(),deploySha,httpStatus,
      cfMitigated:responseHeaders['cf-mitigated']??null,server:responseHeaders.server??null,
      rayPresent:Boolean(responseHeaders['cf-ray']),contentType:responseHeaders['content-type']??null}));
    // GitHub's headless CI address can be denied by Cloudflare. This is not a
    // successful functional smoke; local-preview acceptance runs separately.
    return;
  }
  expect(httpStatus).toBe(200);
  await expect(page.locator('.add-shape').getByRole('button',{name:'DXF İçe Aktar',exact:true})).toBeVisible({timeout:30000});
  console.log('NESTING_QA '+JSON.stringify({event:'live-browser',status:'accessible',url:LIVE_URL,version:deploySha,httpStatus}));
});

test('anonymous local preview DXF import, real WASM nesting and safe mocked export authorization',async({page})=>{
  test.setTimeout(115000);
  const response=await page.goto('/',{waitUntil:'domcontentloaded',timeout:45000});
  expect(response?.status()).toBe(200);
  await expect(page.locator('.add-shape').getByRole('button',{name:'DXF İçe Aktar',exact:true})).toBeVisible({timeout:30000});
  const clear=page.getByRole('button',{name:'Tümünü sil'});
  if(await clear.isEnabled())await clear.click();
  await expect(page.locator('.part-row')).toHaveCount(0,{timeout:10000});
  const started=Date.now();
  await page.locator('input[type="file"][accept*=".dxf"]').first().setInputFiles({
    name:'qa-simple-with-hole.dxf',mimeType:'application/dxf',buffer:Buffer.from(TEST_DXF,'utf8')
  });
  const row=page.locator('.part-row').filter({hasText:'80 × 50'});
  await expect(row).toHaveCount(1,{timeout:30000});
  await row.locator('input').first().fill('2');
  await page.getByLabel('Malzeme genişliği').fill('85');
  await page.getByLabel('Durdurma koşulu').selectOption('10');
  await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
  await expect(page.getByRole('button',{name:'En iyi geçerli yerleşim',exact:true}))
    .toBeEnabled({timeout:75000});
  const metrics=await page.locator('.metrics').innerText();
  expect(metrics).toMatch(/Malzeme verimliliği\s+\d/);
  console.log('NESTING_QA '+JSON.stringify({event:'local-dxf-nesting',elapsedMs:Date.now()-started,parts:2,hasHole:true,metrics}));
  await page.getByRole('button',{name:'En iyi geçerli yerleşim',exact:true}).click();
  const exportButton=page.getByRole('button',{name:'DXF İndir',exact:true});
  await expect(exportButton).toBeEnabled({timeout:30000});
  // Only the local preview runs this; the real billed API never receives a request.
  let posted:{dxf:string;projectJson:string}|undefined;
  await page.route('**/api/export/authorize',async route=>{
    posted=route.request().postDataJSON() as {dxf:string;projectJson:string};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,exportId:4242})});
  });
  const downloadPromise=page.waitForEvent('download',{timeout:30000});
  await exportButton.click();
  await expect.poll(async()=>{
    const error=await page.locator('.error-banner').first().textContent().catch(()=>'');
    if(error)throw Error('Export UI error before authorization: '+error);
    return Boolean(posted);
  },{timeout:10000,message:'Export UI must POST to the mocked authorization endpoint'}).toBe(true);
  expect(posted).toBeDefined();
  console.log('NESTING_QA '+JSON.stringify({event:'local-export-authorization',called:true,
    dxfBytes:Buffer.byteLength(posted!.dxf),projectJsonBytes:Buffer.byteLength(posted!.projectJson)}));
  const downloaded=await downloadPromise;
  const exported=await readFile(await downloaded.path(),'utf8');
  expect(exported).toContain('$INSUNITS');
  expect(exported.match(/LWPOLYLINE/g)?.length).toBeGreaterThanOrEqual(2);
  expect(posted!.dxf).toBe(exported);
  expect(JSON.parse(posted!.projectJson)).toHaveProperty('parts');
  expect(downloaded.suggestedFilename()).toMatch(/\.dxf$/i);
  console.log('NESTING_QA '+JSON.stringify({event:'local-mocked-auth-export',downloadBytes:Buffer.byteLength(exported),
    entities:exported.match(/LWPOLYLINE/g)?.length,charged:false,authorizationIntercepted:true}));
});
