import {openExamples,workshop,finishSwitch} from './project-helpers';
import {test,expect} from '@playwright/test';

test('system is the default; borders follow the theme and explicit choices persist',async({page})=>{
  await page.emulateMedia({colorScheme:'light'});await page.goto('/');
  const background=()=>page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor);
  await expect.poll(background).toBe('rgb(247, 248, 250)');
  const border=page.locator('.workspace-svg g[data-part] > path').first();
  await expect(border).toHaveCSS('stroke','rgb(100, 116, 139)');
  await page.getByRole('button',{name:'About sparrow/studio',exact:true}).click();
  await expect(page.getByLabel('Appearance')).toHaveValue('system');
  await expect.poll(background).toBe('rgb(247, 248, 250)');
  await page.emulateMedia({colorScheme:'dark'});
  await expect.poll(background).toBe('rgb(16, 17, 20)');
  await expect(border).not.toHaveCSS('stroke','rgb(100, 116, 139)');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Ghost mode',exact:true}).click();
  await expect(border).toHaveCSS('fill','rgb(255, 255, 255)');await expect(border).toHaveCSS('fill-opacity','0.1');
  await page.emulateMedia({colorScheme:'light'});await expect(border).toHaveCSS('fill','rgb(0, 0, 0)');
  await page.getByRole('button',{name:'Ghost mode',exact:true}).click();
  await page.emulateMedia({colorScheme:'dark'});
  await page.reload();
  await page.emulateMedia({colorScheme:'light'});
  await expect.poll(background).toBe('rgb(247, 248, 250)');
  await page.getByRole('button',{name:'About sparrow/studio',exact:true}).click();
  await expect(page.getByLabel('Appearance')).toHaveValue('system');
  await page.getByLabel('Appearance').selectOption('light');
  await page.emulateMedia({colorScheme:'dark'});
  await expect.poll(background).toBe('rgb(247, 248, 250)');
  await page.reload();await expect.poll(background).toBe('rgb(247, 248, 250)');
  await page.getByRole('button',{name:'About sparrow/studio',exact:true}).click();
  await page.getByLabel('Appearance').selectOption('dark');
  await page.emulateMedia({colorScheme:'light'});
  await page.reload();await expect.poll(background).toBe('rgb(16, 17, 20)');
});


test('Google login follows saved appearance and system preference',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.addInitScript(()=>localStorage.setItem('serula-theme','system'));
  await page.goto('/google-login.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.evaluate(()=>localStorage.setItem('serula-theme','dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});


test('admin dashboard uses the premium theme and stays within a mobile viewport',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'theme-test@example.test',name:'Theme Test',role:'admin',credits:0,unlimited:true}})
  }));
  await page.addInitScript(()=>localStorage.setItem('serula-theme','dark'));
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/admin2');
  await expect(page.locator('.admin-page')).toBeVisible();
  await expect(page.locator('.admin-metric').first()).toBeVisible();
  const pageBackground=()=>page.locator('.admin-page').evaluate(el=>getComputedStyle(el).backgroundColor);
  const cardBackground=()=>page.locator('.admin-card').first().evaluate(el=>getComputedStyle(el).backgroundColor);
  await expect.poll(pageBackground).toBe('rgb(16, 17, 20)');
  await expect.poll(cardBackground).toBe('rgb(25, 26, 32)');
  await page.evaluate(()=>localStorage.setItem('serula-theme','light'));
  await page.reload();
  await expect.poll(pageBackground).toBe('rgb(247, 248, 250)');
  await expect.poll(cardBackground).toBe('rgb(255, 255, 255)');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('dark palette and ghost mode remain clear on desktop and mobile',async({page},testInfo)=>{
  await page.emulateMedia({colorScheme:'dark'});await page.goto('/');
  await openExamples(page);
  await page.getByRole('button',{name:'Open and nest',exact:true}).click();await finishSwitch(page);
  await page.getByRole('button',{name:'Best valid solution',exact:true}).click({timeout:20_000});
  await expect(page.getByRole('img',{name:'Valid nesting result'})).toBeVisible();
  const stop=page.getByRole('button',{name:'Stop',exact:true});if(await stop.isVisible())await stop.click();
  const paths=page.locator('.workspace-svg g[data-part] > path');
  await expect(paths).toHaveCount(12);
  expect(await paths.evaluateAll(nodes=>new Set(nodes.map(n=>n.getAttribute('fill'))).size)).toBe(4);
  await page.screenshot({path:testInfo.outputPath('palette-dark-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:testInfo.outputPath('palette-dark-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Ghost mode',exact:true}).click();
  expect(await paths.evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>n.getAttribute('fill')==='light-dark(black, white)'&&n.getAttribute('fill-opacity')==='0.1'))).toBe(true);
  await expect(page.locator('.workspace-svg > rect').first()).toHaveAttribute('fill','none');
  await page.screenshot({path:testInfo.outputPath('ghost-dark-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({width:1280,height:720});
  await page.screenshot({path:testInfo.outputPath('ghost-dark-desktop.png'),fullPage:true});
});
