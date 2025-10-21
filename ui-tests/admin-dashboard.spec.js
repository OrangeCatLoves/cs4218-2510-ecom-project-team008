/* eslint-disable notice/notice */
import { test, expect } from '@playwright/test';
import {adminUsers, normalUsers} from "../config/populateDb";
import {clearAndRepopulateDB} from "../config/db";

test.describe('Admin Dashboard', () => {
  const adminInDb = adminUsers[0];
  const userInDb = normalUsers[0];
  test.beforeEach(async ({ page }) => {
    await clearAndRepopulateDB();
    await page.goto('/login');
    await page.getByPlaceholder('Enter Your Email').fill(adminInDb.email);
    await page.getByPlaceholder('Enter Your Password').fill(adminInDb.password);

    await page.getByRole('button', { name: 'LOGIN' }).click();

    await page.getByRole("button", { name: adminInDb.name }).click();
    await page.getByRole("link", { name: "Dashboard" }).click();
  });

  test.describe('should display admin dashboard', () => {
    test.describe('should display admin panel', () => {
      test('should display admin menu', async ({page}) => {
        await expect(page.getByText('Admin Panel')).toBeVisible();
        await expect(page.getByRole('link', {name: 'Create Category'})).toBeVisible();
        await expect(page.getByRole('link', {name: 'Create Product'})).toBeVisible();
        await expect(page.getByRole('link', {name: 'Products'})).toBeVisible();
        await expect(page.getByRole('link', {name: 'Orders'})).toBeVisible();
        await expect(page.getByRole('link', {name: 'Users'})).toBeVisible();
      });

      test('admin panel links should be navigate correctly', async ({page}) => {
        await page.getByRole('link', {name: 'Create Category'}).click();
        await expect(page).toHaveURL(/\/dashboard\/admin\/create-category$/);
        await page.goBack();

        await page.getByRole('link', {name: 'Create Product'}).click();
        await expect(page).toHaveURL(/\/dashboard\/admin\/create-product$/);

        await page.getByRole('link', {name: 'Products'}).click();
        await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);
        await page.goBack();

        await page.getByRole('link', {name: 'Orders'}).click();
        await expect(page).toHaveURL(/\/dashboard\/admin\/orders$/);
        await page.goBack();

        await page.getByRole('link', {name: 'Users'}).click();
        await expect(page).toHaveURL(/\/dashboard\/admin\/users$/);
        await page.goBack();
      });

      test('admin panel information are displayed correctly', async ({page}) => {
        await expect(page.getByText(`Admin Name : ${adminInDb.name}`)).toBeVisible();
        await expect(page.getByText(`Admin Email : ${adminInDb.email}`)).toBeVisible();
        await expect(page.getByText(`Admin Contact : ${adminInDb.phone}`)).toBeVisible();
      });
    });

    test('should display all users for admin to check', async ({page}) => {
      await page.getByRole('link', {name: 'Users'}).click();

      await expect(page.getByRole('heading', {name: "All Users", level: 1})).toBeVisible();

      await expect(page.getByText(adminInDb.name)).toBeVisible();
      await expect(page.getByText("Email: " + adminInDb.email)).toBeVisible();
      await expect(page.getByText("Phone: " + adminInDb.phone)).toBeVisible();
      await expect(page.getByText("Address: " + adminInDb.address)).toBeVisible();

      await expect(page.getByText(userInDb.name)).toBeVisible();
      await expect(page.getByText("Email: " + userInDb.email)).toBeVisible();
      await expect(page.getByText("Phone: " + userInDb.phone)).toBeVisible();
      await expect(page.getByText("Address: " + userInDb.address)).toBeVisible();
    });

    test('should redirect non-authenticated user to login page', async({page}) => {
      await page.getByRole('button', { name: adminInDb.name }).click();
      await page.getByRole('link', { name: /LOGOUT/i }).click();

      await page.goto("/dashboard/admin");

      await expect(page.getByText(/redirecting to you in 3 second/i)).toBeVisible();

      await expect(page.getByText(/LOGIN FORM/i)).toBeVisible();
      await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible();
      await expect(page.getByPlaceholder('Enter Your Password')).toBeVisible();
    });
  });
});
