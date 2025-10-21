import { test, expect } from '@playwright/test';
import {clearAndRepopulateDB} from "../config/db";
import {normalUsers} from "../config/populateDb";

test.describe.configure({ mode: 'serial' });

const tempUser = normalUsers[0];

test.beforeEach(async({page}) => {
  await clearAndRepopulateDB();
  await page.goto('http://localhost:3000');
});

test.setTimeout(30_000);

test.describe('User Profile Page', () => {
  test('should allow logined user to view profile correctly', async({page}) => {
    // Login
    await page.getByRole('link', {name: 'Login'}).click();
    await page.getByPlaceholder('Enter Your Email').fill(tempUser.email);
    await page.getByPlaceholder('Enter Your Password').fill(tempUser.password);
    await page.getByRole('button', {name: 'Login'}).click();

    // Access User Dashboard
    await page.getByRole('button', {name: tempUser.name}).click();
    await page.getByRole('link', {name: 'Dashboard'}).click();

    // Check Profile
    await page.getByRole('link', {name: 'Profile'}).click();

    await expect(page.getByTestId("exampleInputName1")).toHaveValue(tempUser.name);
    await expect(page.getByTestId("exampleInputEmail1")).toHaveValue(tempUser.email);
    await expect(page.getByTestId("exampleInputPassword1")).toHaveValue("");
    await expect(page.getByTestId("exampleInputPhone1")).toHaveValue(tempUser.phone);
    await expect(page.getByTestId("exampleInputAddress1")).toHaveValue(tempUser.address);
  });

  test('should display error message if user attempt to update password to less than 6 characters long', async({page}) => {
    // Login
    await page.getByRole('link', {name: 'Login'}).click();
    await page.getByPlaceholder('Enter Your Email').fill(tempUser.email);
    await page.getByPlaceholder('Enter Your Password').fill(tempUser.password);
    await page.getByRole('button', {name: 'Login'}).click();

    // Access User Dashboard
    await page.getByRole('button', {name: tempUser.name}).click();
    await page.getByRole('link', {name: 'Dashboard'}).click();

    // Check Profile
    await page.getByRole('link', {name: 'Profile'}).click();

    // Update Password
    await page.getByTestId("exampleInputPassword1").fill("12345");
    await page.getByRole('button', {name: "UPDATE", exact: true}).click();

    await expect(page.getByText("Passsword is required and 6 character long")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("exampleInputPassword1")).toBeVisible();
  });

  test('should allow logined user to update profile correctly', async({page}) => {
    const updatedUser = {
      name: "Updated User",
      email: "updated_email@gmail.com",
      phone: "999999",
      address: "Updated Address",
    };

    // Login
    await page.getByRole('link', {name: 'Login'}).click();
    await page.getByPlaceholder('Enter Your Email').fill(tempUser.email);
    await page.getByPlaceholder('Enter Your Password').fill(tempUser.password);
    await page.getByRole('button', {name: 'Login'}).click();

    // Access User Dashboard
    await page.getByRole('button', {name: tempUser.name}).click();
    await page.getByRole('link', {name: 'Dashboard'}).click();

    // Check Profile
    await page.getByRole('link', {name: 'Profile'}).click();

    // Update Profile and check updated profile
    const nameField = await page.getByTestId("exampleInputName1");
    const phoneField = await page.getByTestId("exampleInputPhone1");
    const addressField = await page.getByTestId("exampleInputAddress1");

    await nameField.fill(updatedUser.name);
    await page.getByRole('button', {name: "UPDATE", exact: true}).click();
    await expect(page.getByText('Profile Updated Successfully')).toBeVisible();
    await page.reload();
    await expect(nameField).toHaveValue(updatedUser.name);

    await phoneField.fill(updatedUser.phone);
    await page.getByRole('button', {name: "UPDATE", exact: true}).click();
    await expect(page.getByText('Profile Updated Successfully')).toBeVisible();
    await page.reload();
    await expect(phoneField).toHaveValue(updatedUser.phone);

    await addressField.fill(updatedUser.address);
    await page.getByRole('button', {name: "UPDATE", exact: true}).click();
    await expect(page.getByText('Profile Updated Successfully')).toBeVisible();
    await page.reload();
    await expect(addressField).toHaveValue(updatedUser.address);
  });

  test('should redirect non-authenticated user to login page', async({page}) => {
    await page.goto('./dashboard/user/profile');

    await expect(page.getByText(/redirecting to you in 3 second/i)).toBeVisible();

    await page.waitForTimeout(4000);

    await expect(page.getByText(/LOGIN FORM/i)).toBeVisible();
    await expect(page.getByPlaceholder('Enter Your Email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter Your Password')).toBeVisible();
  });
});