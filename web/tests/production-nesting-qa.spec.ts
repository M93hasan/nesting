import {test,expect} from '@playwright/test';

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
    // Capture only non-sensitive response diagnostics, never challenge cookies or full HTML.
    const headers=response?.headers()??{};
    const diagnostic={event:'live-browser',status:'blocked-by-http-403',assetStatus:version.status(),deploySha,httpStatus,
      cfRay:headers['cf-ray']??null,cfMitigated:headers['cf-mitigated']??null,server:headers['server']??null,
      contentType:headers['content-type']??null,cacheStatus:headers['cf-cache-status']??null};
    console.log('NESTING_QA '+JSON.stringify(diagnostic));
    // GitHub's headless CI address can be denied by Cloudflare. This is not a
    // successful functional smoke; local-preview acceptance runs separately.
    return;
  }
  expect(httpStatus).toBe(200);
  await expect(page.locator('.add-shape').getByRole('button',{name:'DXF İçe Aktar',exact:true})).toBeVisible({timeout:30000});
  console.log('NESTING_QA '+JSON.stringify({event:'live-browser',status:'accessible',url:LIVE_URL,version:deploySha,httpStatus}));
});

test('anonymous local preview DXF import and real WASM nesting; no chargeable export',async({page})=>{
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
  // Intentionally do not click DXF İndir: this POST may debit a user's credits.
});
