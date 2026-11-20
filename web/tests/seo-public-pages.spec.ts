import { test, expect } from '@playwright/test';

const pages = [
  ['dxf-nesting','DXF nesting'],
  ['lazer-kesim-nesting','Lazer kesim'],
  ['cnc-nesting','CNC kesim'],
] as const;

for (const [slug, heading] of pages) {
  test(`SEO page /${slug}/ serves standalone HTML without editor scripts`, async ({ page }) => {
    const response=await page.goto(`/${slug}/`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading',{level:1})).toContainText(heading,{ignoreCase:true});
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',`https://serula.site/${slug}/`);
    await expect(page.getByRole('link',{name:'Nesting uygulamasını aç'})).toHaveAttribute('href','/');
    await expect(page.locator('#root')).toHaveCount(0);
    expect(await page.locator('script[src]').count()).toBe(0);
  });
}

test('crawler-visible sitemap lists the three public resources',async({request})=>{
  const response=await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const body=await response.text();
  for(const [slug] of pages)expect(body).toContain(`https://serula.site/${slug}/`);
});
