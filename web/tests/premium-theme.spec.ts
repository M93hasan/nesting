import {test,expect} from '@playwright/test';

test('Google login follows saved appearance and system preference',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await page.addInitScript(()=>{
    if(!localStorage.getItem('serula-theme'))localStorage.setItem('serula-theme','system');
  });
  await page.goto('/google-login.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.evaluate(()=>localStorage.setItem('serula-theme','dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('admin dashboard theme variables stay correct on desktop and mobile',async({page})=>{
  await page.route('**/api/auth/admin-me',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({user:{id:1,email:'theme-test@example.test',name:'Theme Test',role:'admin',credits:0,unlimited:true}})
  }));
  await page.addInitScript(()=>{if(!localStorage.getItem('serula-theme'))localStorage.setItem('serula-theme','dark');});
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/admin2');
  const admin=page.locator('.admin-page');
  await expect(admin).toBeVisible();
  const pageBackground=()=>admin.evaluate(el=>getComputedStyle(el).backgroundColor);
  const surface=()=>page.locator('.admin-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);
  const surfaceBlur=()=>page.locator('.admin-sidebar').evaluate(el=>getComputedStyle(el).backdropFilter);
  await expect.poll(pageBackground).toBe('rgb(10, 16, 32)');
  await expect.poll(surface).not.toBe('rgba(0, 0, 0, 0)');
  await expect.poll(surfaceBlur).toContain('blur(');
  await page.evaluate(()=>localStorage.setItem('serula-theme','light'));
  await page.reload();
  await expect(admin).toBeVisible();
  await expect.poll(pageBackground).toBe('rgb(242, 245, 251)');
  await expect.poll(surface).not.toBe('rgba(0, 0, 0, 0)');
  await expect.poll(surfaceBlur).toContain('blur(');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
