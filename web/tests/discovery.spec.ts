import {test,expect} from '@playwright/test';

// These assertions cover Serula's shipped HTML rather than the retired Sparrow landing page.
test('Serula metadata, sitemap and sharing image are available without rendering',async({request})=>{
  const response=await request.get('/');
  expect(response.ok()).toBe(true);
  const html=await response.text();
  expect(html).toContain('<link rel="canonical" href="https://serula.site/">');
  expect(html).toContain('property="og:url" content="https://serula.site/"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('<title>Serula Nesting | DXF Yerleştirme</title>');
  expect(html).toContain('property="og:title" content="Serula Nesting | DXF Yerleştirme"');
  const imageUrl=html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(imageUrl).toBe('https://serula.site/sparrow-studio-social.png');
  const image=await request.get(new URL(imageUrl!).pathname);
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/png');
  const png=await image.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(726);
  expect(await(await request.get('/robots.txt')).text()).toContain('Sitemap: https://serula.site/sitemap.xml');
  expect(await(await request.get('/sitemap.xml')).text()).toContain('<loc>https://serula.site/</loc>');
});

test('JavaScript-disabled visitors receive the explicit application requirement',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
  try{
    const page=await context.newPage();
    await page.goto('/');
    // Chromium exposes noscript markup in page.content(), but Playwright's
    // locator text extraction can return empty in a no-JS browsing context.
    await expect(page.locator('noscript')).toHaveCount(1);
    expect(await page.content()).toContain('<noscript>Serula Nesting kullanmak için JavaScript etkin olmalıdır.</noscript>');
    await expect(page.locator('#root .app')).toHaveCount(0);
  }finally{await context.close();}
});

test('Serula provides its viewport and page description on mobile and desktop',async({page})=>{
  await page.goto('/');
  await expect(page).toHaveTitle('Serula Nesting | DXF Yerleştirme');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content','width=device-width,initial-scale=1');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/DXF/);
  }
});
