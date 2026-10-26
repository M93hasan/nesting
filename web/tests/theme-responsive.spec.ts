import { test, expect } from '@playwright/test';

test('workspace stays within supported viewport widths and keeps the empty-canvas import compact', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'DXF İndir' })).toBeVisible();

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    const emptyImport = page.locator('.app .empty-project .empty-project-actions > button').filter({ hasText: 'DXF İçe Aktar' });
    await expect(emptyImport.first()).toBeVisible();
    const bounds = await emptyImport.first().boundingBox();
    expect(bounds, `empty-canvas DXF import should be visible at ${width}px`).not.toBeNull();
    expect(bounds!.width, `empty-canvas DXF import width at ${width}px`).toBeLessThanOrEqual(220);
  }
});

test('theme choice persists after reload on the workspace and admin entry screens', async ({ page }) => {
  await page.goto('/');
  const themeToggle = page.locator('button.theme-toggle');
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/admin');
  await expect(page.locator('button.theme-toggle')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
