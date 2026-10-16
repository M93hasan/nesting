import {test,expect} from '@playwright/test';
import {workshop} from './project-helpers';

test('Corel transfer keeps its action, displays supplied icon and offers bridge repair if local service is missing',async({page})=>{
  await page.route('**/api/transfer/access',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({corel:true,rdworks:false})
  }));
  await page.route('http://127.0.0.1:43842/health',route=>route.abort('failed'));
  await page.goto('/');
  await workshop(page);
  const transfer=page.getByRole('button',{name:"CorelDRAW'a Aktar"});
  await expect(transfer).toBeVisible();
  await expect(transfer.locator('img.corel-transfer-logo')).toHaveAttribute('src',/corel-button-logo\.svg$/);
  await transfer.click();
  const prompt=page.locator('.corel-bridge-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('link',{name:'Köprüyü Kur / Onar (.cmd)'}))
    .toHaveAttribute('href',/downloads\/Serula-Kur\.cmd$/);
  await expect(prompt.getByRole('link',{name:'Köprüyü Kur / Onar (.cmd)'}))
    .toHaveAttribute('download','Serula-Kur.cmd');
  await prompt.getByRole('button',{name:'Kapat'}).click();
  await expect(prompt).toHaveCount(0);
});
