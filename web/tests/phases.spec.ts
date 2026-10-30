import {test,expect} from '@playwright/test';
import {workshop} from './project-helpers';

// Serula's current UI uses Turkish controls. The retired Sparrow phase
// telemetry (Exploration/Compression, Skip, Diagnostics JSON) is no longer
// a valid user-facing contract and is deliberately not asserted here.
test('example project exposes the current nesting controls',async({page})=>{
  await page.goto('/');
  await workshop(page);
  await expect(page.locator('.part-row')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Parçaları yerleştir',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'DXF İndir',exact:true})).toBeVisible();
});

test('current solver options allow choosing worker count',async({page})=>{
  await page.goto('/');
  await workshop(page);
  await expect(page.locator('.part-row')).toHaveCount(4);
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
  await workshop(page);
  await expect(page.locator('.part-row')).toHaveCount(4);
  await page.getByRole('button',{name:'Parçaları yerleştir',exact:true}).click();
  const stop=page.getByRole('button',{name:'Durdur',exact:true});
  await expect(stop).toBeVisible({timeout:20000});
  await stop.click();
});
