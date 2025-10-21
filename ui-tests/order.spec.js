import { test, expect } from '@playwright/test';
import {clearAndRepopulateDB} from "../config/db";
import {normalUsers, adminUsers} from "../config/populateDb";

test.describe.configure({ mode: 'serial' });

const tempUser = normalUsers[0];
const adminInDb = adminUsers[0];

test.beforeEach(async({page}) => {
  await clearAndRepopulateDB();

  await page.goto('http://localhost:3000');
  await page.getByRole('link', {name: 'Login'}).click();
  await page.getByPlaceholder('Enter Your Email').fill(tempUser.email);
  await page.getByPlaceholder('Enter Your Password').fill(tempUser.password);
  await page.getByRole('button', {name: 'Login'}).click();
});

test.setTimeout(30_000);

test.describe("User Order Dashboard", () => {
  test("should show the orders that I have made", async({page}) => {
    // Making order
    const products = ['Laptop Pro 15', 'Wireless Mouse', 'The Great Gatsby'];
    for (const productName of products) {
      await page
        .locator('.card', { hasText: productName })
        .getByRole('button', { name: /add to cart/i })
        .click();
    }

    await page.getByRole('link', { name: 'Cart' }).click();
    await page.getByRole('button', { name: 'Paying with Card' }).click();
    await page.locator('iframe[name="braintree-hosted-field-number"]').contentFrame().getByRole('textbox', { name: 'Credit Card Number' }).click();
    await page.locator('iframe[name="braintree-hosted-field-number"]').contentFrame().getByRole('textbox', { name: 'Credit Card Number' }).fill('4000007020000003');
    await page.locator('iframe[name="braintree-hosted-field-expirationDate"]').contentFrame().getByRole('textbox', { name: 'Expiration Date' }).click();
    await page.locator('iframe[name="braintree-hosted-field-expirationDate"]').contentFrame().getByRole('textbox', { name: 'Expiration Date' }).fill('0830');
    await page.locator('iframe[name="braintree-hosted-field-cvv"]').contentFrame().getByRole('textbox', { name: 'CVV' }).click();
    await page.locator('iframe[name="braintree-hosted-field-cvv"]').contentFrame().getByRole('textbox', { name: 'CVV' }).fill('123');
    await page.getByRole('button', { name: 'Make Payment' }).click();

    await expect(page.getByTestId("order")).toHaveCount(1);
  });

  test("should show empty page if I have not made any orders yet", async({page}) => {
    await page.getByRole('button', {name: tempUser.name}).click();
    await page.getByRole('link', {name: 'Dashboard'}).click();
    await page.getByRole('link', {name: 'Orders'}).click();

    await expect(page.getByTestId("order")).not.toBeVisible();
  });

  test("should redirect non-authenticated user to login page", async({page}) => {
    await page.getByRole('button', {name: tempUser.name}).click();
    await page.getByRole('link', {name: /LOGOUT/i}).click();

    await page.goto("./dashboard/user/orders");

    await expect(page.getByText(/redirecting to you in 3 second/i)).toBeVisible();

    await page.waitForTimeout(4000);

    await expect(page.getByText(/LOGIN FORM/i)).toBeVisible();
    await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter Your Password')).toBeVisible();
  });
});

test.setTimeout(500_000);

test.describe("Admin Order Dashboard", () => {
  test("should able to view orders in the system and modify order status", async({page}) => {
    // Making order
    const products = ['Laptop Pro 15', 'Wireless Mouse', 'The Great Gatsby'];
    for (const productName of products) {
      await page
        .locator('.card', { hasText: productName })
        .getByRole('button', { name: /add to cart/i })
        .click();
    }

    await page.getByRole('link', { name: 'Cart' }).click();
    await page.getByRole('button', { name: 'Paying with Card' }).click();
    await page.locator('iframe[name="braintree-hosted-field-number"]').contentFrame().getByRole('textbox', { name: 'Credit Card Number' }).click();
    await page.locator('iframe[name="braintree-hosted-field-number"]').contentFrame().getByRole('textbox', { name: 'Credit Card Number' }).fill('4000007020000003');
    await page.locator('iframe[name="braintree-hosted-field-expirationDate"]').contentFrame().getByRole('textbox', { name: 'Expiration Date' }).click();
    await page.locator('iframe[name="braintree-hosted-field-expirationDate"]').contentFrame().getByRole('textbox', { name: 'Expiration Date' }).fill('0830');
    await page.locator('iframe[name="braintree-hosted-field-cvv"]').contentFrame().getByRole('textbox', { name: 'CVV' }).click();
    await page.locator('iframe[name="braintree-hosted-field-cvv"]').contentFrame().getByRole('textbox', { name: 'CVV' }).fill('123');
    await page.getByRole('button', { name: 'Make Payment' }).click();

    await page.getByRole('button', { name: tempUser.name }).click();
    await page.getByRole('link', { name: /LOGOUT/i }).click();

    await page.getByRole('link', {name: 'Login'}).click();
    await page.getByPlaceholder('Enter Your Email').fill(adminInDb.email);
    await page.getByPlaceholder('Enter Your Password').fill(adminInDb.password);
    await page.getByRole('button', {name: 'Login'}).click();

    await page.getByRole('button', { name: adminInDb.name }).click();
    await page.getByRole('link', {name: 'Dashboard'}).click();
    await page.getByRole('link', {name: 'Orders'}).click();
    await expect(page.getByTestId("order")).toHaveCount(1);

    await expect(page.getByTestId("order-status-option")).toHaveText("Not Process");
    await page.getByTestId("order-status-option").click();
    await page.getByText('Processing').nth(1).click();
    await page.reload();
    await expect(page.getByTestId("order-status-option")).toHaveText("Processing");
  });
})