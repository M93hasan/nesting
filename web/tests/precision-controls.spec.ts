import {test,expect,type Page} from '@playwright/test';
import {workshop} from './project-helpers';

test.use({serviceWorkers:'block'});

async function selectFirstVisibleCopy(page:Page) {
  const copy=page.locator('.workspace-svg g[data-part][data-copy-index]').first();
  await expect(copy).toBeVisible();
  const position=await copy.evaluate(element=>{
    const path=element.querySelector('path') as (SVGGeometryElement&SVGGraphicsElement)|null;
    if(!path||typeof path.isPointInFill!=='function')throw new Error('No clickable geometry path');
    const box=path.getBBox(),matrix=path.getScreenCTM();
    if(!matrix)throw new Error('No geometry screen transform');
    for(let row=0;row<15;row++)for(let col=0;col<15;col++){
      const point=new DOMPoint(box.x+box.width*(col+.5)/15,box.y+box.height*(row+.5)/15);
      if(!path.isPointInFill(point))continue;
      const screen=point.matrixTransform(matrix);
      if(document.elementFromPoint(screen.x,screen.y)?.closest('g[data-part][data-copy-index]')===element)
        return {x:screen.x,y:screen.y};
    }
    throw new Error('No visible click point');
  });
  await page.mouse.click(position.x,position.y);
  const inspector=page.locator('details.part-properties-disclosure');
  if(!(await inspector.evaluate(el=>(el as HTMLDetailsElement).open)))await inspector.locator('summary').click();
  await expect(inspector.locator('.size-controls')).toBeVisible();
  return inspector;
}

test('invalid precision measurements explain the issue without changing geometry',async({page})=>{
  await page.goto('/');
  await workshop(page);
  const inspector=await selectFirstVisibleCopy(page);
  const field=inspector.locator('.size-controls input[type="number"]').first();
  const initial=await field.inputValue();
  const geometry=await page.locator('.workspace-svg g[data-part][data-copy-index]').first().getAttribute('transform');
  await field.fill('');
  await expect(field).toHaveAttribute('aria-invalid','true');
  const descriptionId=await field.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(page.locator('[id="'+descriptionId+'"]')).toBeVisible();
  await field.fill(initial);
  await expect(field).toHaveAttribute('aria-invalid','false');
  await expect(field).not.toHaveAttribute('aria-describedby',/.+/);
  expect(await page.locator('.workspace-svg g[data-part][data-copy-index]').first().getAttribute('transform')).toBe(geometry);
});

test('manual rotation step communicates invalid range and recovers',async({page})=>{
  await page.goto('/');
  await workshop(page);
  const inspector=await selectFirstVisibleCopy(page);
  const step=inspector.getByLabel('Elle çevirme adımı, derece');
  await expect(step).toBeVisible();
  await step.fill('0');
  await expect(step).toHaveAttribute('aria-invalid','true');
  const descriptionId=await step.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(page.locator('[id="'+descriptionId+'"]')).toBeVisible();
  await step.fill('15');
  await expect(step).toHaveAttribute('aria-invalid','false');
});
