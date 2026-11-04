import {test,expect} from '@playwright/test';

test('studio loads and Parts disclosure stays under Delete All',async({page})=>{
  await page.goto('/');
  const parts=page.locator('#parts-settings');
  const clear=parts.locator('.clear-all-parts');
  const disclosure=parts.locator('details.part-properties-disclosure');
  await expect(clear).toBeAttached();
  await expect(disclosure).toBeAttached();
  expect(await clear.evaluate((button,selector)=>{
    const panel=document.querySelector(selector);
    return Boolean(panel && (button.compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING));
  },'#parts-settings details.part-properties-disclosure')).toBe(true);
  await expect(disclosure).not.toHaveAttribute('open');
  await disclosure.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open','');
  await expect(disclosure).toContainText('Özelliklerini görmek için bir parça seçin.');
  await disclosure.locator('summary').click();
  await expect(disclosure).not.toHaveAttribute('open');
});

test('studio has no horizontal overflow at phone width',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('#parts-settings')).toBeAttached();
  const diagnostic = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    return {
      width,extra,
      overflow: [...document.querySelectorAll<HTMLElement>('body *')]
        .map(element=>({tag:element.tagName,cls:element.className && typeof element.className==='string' ? element.className.slice(0,110) : '',right:Math.round(element.getBoundingClientRect().right),left:Math.round(element.getBoundingClientRect().left)}))
        .filter(item=>item.right > width+1 || item.left < -1)
        .slice(0,16)
    };
  });
  if(diagnostic.extra>0)console.log('MOBILE_OVERFLOW_DIAGNOSTIC '+JSON.stringify(diagnostic));
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('similar-shape grouping uses a clear native checkbox and supports toggling',async({page})=>{
  await page.goto('/');
  const options=page.locator('.solver-options');
  await options.locator('summary').click();
  const checkbox=options.getByRole('checkbox',{name:/Benzer şekilleri/});
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  expect(await checkbox.evaluate(element=>getComputedStyle(element).appearance)).toMatch(/^(auto|checkbox)$/);
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
});

test('studio stays within the viewport at phone, tablet and desktop widths',async({page})=>{
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await expect(page.locator('.main-workspace')).toBeAttached();
    if(width===1440){
      const overflow=await page.evaluate(()=>{
        const viewport=document.documentElement.clientWidth;
        return {viewport,scrollWidth:document.documentElement.scrollWidth,items:[...document.querySelectorAll<HTMLElement>('body *')]
          .map(el=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);return {tag:el.tagName,cls:typeof el.className==='string'?el.className.slice(0,100):'',id:el.id,right:Math.round(r.right),left:Math.round(r.left),width:Math.round(r.width),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,display:style.display,overflowX:style.overflowX};})
          .filter(v=>v.right>viewport+1 && v.left<viewport+100).sort((a,b)=>b.right-a.right).slice(0,25)};
      });
      console.log('AUTH_OVERFLOW_DIAGNOSTIC '+JSON.stringify(overflow));
    }
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const transfer=page.locator('.corel-transfer-button');
    await expect(transfer).toBeAttached();
    await expect(transfer).toContainText("CorelDRAW'a Aktar");
    const dimensions=await transfer.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  }
});
