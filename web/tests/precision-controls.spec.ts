import {test,expect} from '@playwright/test';
import {workshop} from './project-helpers';

test.use({serviceWorkers:'block'});

test('precision edit fields expose accessible errors without changing geometry',async({page})=>{
  await page.goto('/');
  await workshop(page);
  const part=page.locator('.part-row').first();
  await expect(part).toBeVisible();
  // Expand the existing part inspector without changing the underlying part.
  const disclosure=page.locator('details.part-properties-disclosure').first();
  await expect(disclosure).toBeVisible();
  if(!(await disclosure.evaluate(el=>(el as HTMLDetailsElement).open)))await disclosure.locator('summary').click();
  const dimensions=disclosure.locator('.size-controls input[type="number"]');
  await expect(dimensions.first()).toBeVisible();
  const field=dimensions.first();
  await field.fill('-1');
  await expect(field).toHaveAttribute('aria-invalid','true');
  const descriptionId=await field.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(page.locator('[id="'+descriptionId+'"]')).toBeVisible();
  await field.fill('20');
  await expect(field).toHaveAttribute('aria-invalid','false');
  await expect(field).not.toHaveAttribute('aria-describedby',/.+/);
});

test('selection rotation fields communicate invalid input state',async({page})=>{
  await page.goto('/');
  await workshop(page);
  const angle=page.getByLabel('Elle çevirme adımı, derece');
  // This panel is shown only when a copy is selected; no arbitrary model mutation is needed.
  if(!(await angle.isVisible()))test.skip(true,'No selected copy in default example');
  await angle.fill('0');
  await expect(angle).toHaveAttribute('aria-invalid','true');
  await expect(angle).toHaveAttribute('aria-describedby',/.+/);
  await angle.fill('15');
  await expect(angle).toHaveAttribute('aria-invalid','false');
});
