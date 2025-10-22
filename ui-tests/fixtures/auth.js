// ui-tests/fixtures/auth.js
import { expect } from "@playwright/test";

async function waitForAuthToken(page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem("auth");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return !!parsed?.token && !!parsed?.user;
      } catch {
        return false;
      }
    },
    { timeout }
  );
}

export async function uiLoginAsAdmin(page) {
  const email = "yc@test.com";
  const password = "Admin1234!";

  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole("button", { name: /login/i }).click();

  await waitForAuthToken(page, 15000);

  const raw = await page.evaluate(() => localStorage.getItem("auth"));
  const parsed = raw ? JSON.parse(raw) : null;
  expect(parsed?.token).toBeTruthy();
  expect(parsed?.user).toBeTruthy();

  return parsed;
}

export async function uiLogout(page) {
  const logoutControl = page
    .getByRole("link", { name: /logout|sign ?out/i })
    .first()
    .or(page.getByRole("button", { name: /logout|sign ?out/i }).first());

  if (await logoutControl.isVisible().catch(() => false)) {
    await logoutControl.click();
  } else {
    await page.evaluate(() => {
      localStorage.removeItem("auth");
      sessionStorage.clear();
    });
    await page.goto("/login");
  }

  await expect(page.getByRole("button", { name: /login/i })).toBeVisible({
    timeout: 15000,
  });
  const stored = await page.evaluate(() => localStorage.getItem("auth"));
  expect(stored).toBeNull();
}

export async function setLocalAuth(page, authObject) {
  await page.goto("/");
  await page.evaluate(
    (auth) => localStorage.setItem("auth", JSON.stringify(auth)),
    authObject
  );
}

export async function clearLocalAuth(page) {
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.removeItem("auth");
    sessionStorage.clear();
  });
  await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
}
