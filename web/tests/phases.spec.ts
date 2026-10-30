import {test,expect} from '@playwright/test';


// Serula's current UI uses Turkish controls. The retired Sparrow phase
// telemetry (Exploration/Compression, Skip, Diagnostics JSON) is no longer
// a valid user-facing contract and is deliberately not asserted here.
test('example project exposes the current nesting controls',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Şekil çiz',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await expect(page.locator('.part-row')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Parçaları yerleştir',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'DXF İndir',exact:true})).toBeVisible();
});

test('current solver options allow choosing worker count',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Şekil çiz',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await expect(page.locator('.part-row')).toHaveCount(1);
  await page.locator('.solver-options>summary').click();
  const threads=page.getByLabel('İşlemci iş parçacıkları');
  await expect(threads).toBeVisible();
  await threads.selectOption('1');
  await expect(threads).toHaveValue('1');
  await threads.selectOption('2');
  await expect(threads).toHaveValue('2');
});

test('nesting run exposes the stop control',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Şekil çiz',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await expect(page.locator('.part-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
  const stop=page.getByRole('button',{name:'Durdur',exact:true});
  await expect(stop).toBeVisible({timeout:20000});
  await stop.click();
  await expect(page.getByRole('status')).toContainText(/Stopped|Durduruldu/,{timeout:15000});
  await expect(page.getByRole('button',{name:'Durdur',exact:true})).toHaveCount(0);
});

test('bounded nesting finishes with a validated best solution',async({page})=>{
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button',{name:'Şekil çiz',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await expect(page.locator('.part-row')).toHaveCount(1);
  await page.getByLabel('Durdurma koşulu').selectOption('10');
  await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
  await expect(page.getByRole('status')).toContainText(/Complete|Tamamlandı/,{timeout:65_000});
  await expect(page.getByRole('button',{name:'En iyi geçerli yerleşim',exact:true})).toBeEnabled();
  await expect(page.locator('.metrics')).not.toContainText('Malzeme verimliliği —');
  await expect(page.locator('.metrics')).toContainText(/Malzeme verimliliği\s+\d/);
});

test('solver search either exposes phases or completes before observation',async({page})=>{
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button',{name:'Şekil çiz',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Şekil ekle',exact:true}).click();
  await page.getByLabel('Durdurma koşulu').selectOption('10');
  await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
  await expect(page.getByRole('status')).toContainText(/Exploration|Compression|Complete|Tamamlandı/,{timeout:30000});
  const skip=page.getByRole('button',{name:'Sıkıştırmaya geç',exact:true});
  if(await skip.count() && await skip.isEnabled()){
    await skip.click();
    await expect(page.getByRole('status')).toContainText(/Compression|Geçiliyor|Complete|Tamamlandı/,{timeout:20000});
  }
  const stop=page.getByRole('button',{name:'Durdur',exact:true});
  if(await stop.isVisible())await stop.click();
  await expect(page.getByRole('status')).toContainText(/Stopped|Durduruldu|Complete|Tamamlandı/,{timeout:15000});
});
