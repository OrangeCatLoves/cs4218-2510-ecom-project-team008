import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.getByRole('img', { name: 'contactus' })).toBeVisible();
  await expect(page.getByText('add privacy policyadd privacy')).toBeVisible();
  await page.getByRole('link', { name: '🛒 Virtual Vault' }).click();
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.getByRole('main')).toBeVisible();
});