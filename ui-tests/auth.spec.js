// ui-tests/auth.spec.js
import { test, expect } from "@playwright/test";
import { uiLoginAsAdmin, uiLogout, clearLocalAuth } from "./fixtures/auth.js";

test.use({
  baseURL: "http://localhost:3000",
});

test.setTimeout(45000);

test.describe("Auth & Access Control (E2E UI)", () => {
  test("invalid credentials do not log in (stay on login and no session stored)", async ({
    page,
  }) => {
    await clearLocalAuth(page);
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill("yc@test.com");
    await page.getByPlaceholder(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /login/i }).click();

    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("auth"));
    expect(stored).toBeNull();
  });

  test("password input is masked and empty form does not navigate", async ({
    page,
  }) => {
    await clearLocalAuth(page);
    await page.goto("/login");

    const pwd = page.getByPlaceholder(/password/i);
    await expect(pwd).toHaveAttribute("type", /password/i);

    await page.getByRole("button", { name: /login/i }).click();
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
  });

  test("email field validation requires valid format (remains on login)", async ({
    page,
  }) => {
    await clearLocalAuth(page);
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill("invalid-email");
    await page.getByPlaceholder(/password/i).fill("password123");
    await page.getByRole("button", { name: /login/i }).click();
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
  });

  test("login form shows required fields and action", async ({ page }) => {
    await clearLocalAuth(page);
    await page.goto("/login");
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
  });

  test("multiple failed login attempts do not create a session", async ({
    page,
  }) => {
    await clearLocalAuth(page);
    await page.goto("/login");

    for (let i = 0; i < 3; i++) {
      await page.getByPlaceholder(/email/i).fill("wrong@test.com");
      await page.getByPlaceholder(/password/i).fill("wrongpass");
      await page.getByRole("button", { name: /login/i }).click();
      await page.waitForTimeout(250);
    }

    await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("auth"));
    expect(stored).toBeNull();
  });

  test("password field never reveals text", async ({ page }) => {
    await clearLocalAuth(page);
    await page.goto("/login");
    const pwd = page.getByPlaceholder(/password/i);
    await pwd.fill("secretpassword");
    await expect(pwd).toHaveAttribute("type", "password");
  });
});
