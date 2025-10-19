import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('link', { name: 'Contact' }).click();
  await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('📧 Email: www.help@ecommerceapp.com');
  await expect(page.getByText('📞 Phone: 012-')).toBeVisible();
  await expect(page.getByText('💬 Support: 1800-0000-0000 (')).toBeVisible();
  await expect(page.getByRole('img', { name: 'contactus' })).toBeVisible();
});