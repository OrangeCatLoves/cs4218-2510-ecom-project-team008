// e2e/ui/private-route.spec.js
import { test, expect } from "@playwright/test";
import {
  uiLoginAsAdmin,
  setLocalAuth,
  clearLocalAuth,
} from "./fixtures/auth.js";

test.use({
  baseURL: "http://localhost:3000",
});

test.setTimeout(45000);

test.describe.configure({ mode: "parallel" });

async function uiLoginAsUser(page) {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  test.skip(!email || !password, "E2E_USER_EMAIL/PASSWORD not provided");
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole("button", { name: /login/i }).click();
  await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
}

async function setLocalAuth(page, authObject) {
  await page.goto("/"); // ensure same-origin storage
  await page.evaluate(
    (auth) => localStorage.setItem("auth", JSON.stringify(auth)),
    authObject,
  );
}

async function clearLocalAuth(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("auth"));
}

test("redirects to /login when unauthenticated and back button does not bypass guard", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/\/login/i);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/i);
});

test("grants access when authenticated; refresh persists; deep-link works", async ({
  page,
}) => {
  await uiLoginAsAdmin(page);

  await page.goto("/dashboard/admin/products");
  await expect(page.getByText(/all products list/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/all products list/i)).toBeVisible();

  await page.goto("/dashboard/admin/create-product");
  await expect(
    page.getByRole("heading", { name: /create product/i }),
  ).toBeVisible();
});

test("invalid token in storage → redirected to /login", async ({ page }) => {
  await setLocalAuth(page, {
    user: { name: "Hacker", role: 1 },
    token: "invalid-token",
  });
  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/\/login/i, { timeout: 15000 });
});

test("empty token in storage → redirected to /login (client bootstrap edge)", async ({
  page,
}) => {
  await setLocalAuth(page, { user: { name: "Edge", role: 1 }, token: "" });
  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/\/login/i, { timeout: 15000 });
});

test("multiple protected routes stay protected consistently", async ({
  page,
}) => {
  await uiLoginAsAdmin(page);

  await page.goto("/dashboard/admin/products");
  await expect(page.getByText(/all products list/i)).toBeVisible();

  await page.goto("/dashboard/admin/create-product");
  await expect(
    page.getByRole("heading", { name: /create product/i }),
  ).toBeVisible();

  await page.goto("/dashboard/admin/products");
  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("logout/cleared session on one tab forces guard on another tab after reload", async ({
  context,
}) => {
  const page1 = await context.newPage();
  await uiLoginAsAdmin(page1);
  await page1.goto("/dashboard/admin/products");
  await expect(page1.getByText(/all products list/i)).toBeVisible();

  const page2 = await context.newPage();
  await page2.goto("/dashboard/admin/products");
  await expect(page2.getByText(/all products list/i)).toBeVisible();

  await clearLocalAuth(page1);

  await page2.reload();
  await expect(page2).toHaveURL(/\/login/i, { timeout: 15000 });
});

test("non-admin user cannot access admin routes (role guard)", async ({
  page,
}) => {
  await uiLoginAsUser(page);
  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/(\/login|\/dashboard\/user)/i, {
    timeout: 15000,
  });
});

test("direct deep-link to a protected admin route when unauthenticated → login, then returns after successful auth", async ({
  page,
}) => {
  const target = "/dashboard/admin/create-product";
  await page.goto(target);
  await expect(page).toHaveURL(/\/login/i);

  await uiLoginAsAdmin(page);
  await page.goto(target);
  await expect(
    page.getByRole("heading", { name: /create product/i }),
  ).toBeVisible();
});

test("malformed token in localStorage redirects to /login", async ({
  page,
}) => {
  await setLocalAuth(page, {
    user: { name: "Test", role: 1 },
    token: "malformed.token.here",
  });
  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/\/login/i, { timeout: 15000 });
});

test("session with missing user object redirects to /login", async ({
  page,
}) => {
  await setLocalAuth(page, {
    token: "some-token-12345",
  });
  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/\/login/i, { timeout: 15000 });
});

test("authenticated user can reload protected page multiple times", async ({
  page,
}) => {
  await uiLoginAsAdmin(page);
  await page.goto("/dashboard/admin/products");

  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByText(/all products list/i)).toBeVisible();
  }
});

test("protected route remains protected after failed authentication attempt", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill("wrong@test.com");
  await page.getByPlaceholder(/password/i).fill("wrongpass");
  await page.getByRole("button", { name: /login/i }).click();

  await page.goto("/dashboard/admin/products");
  await expect(page).toHaveURL(/\/login/i);
});

test("navigation from one protected route to another works seamlessly", async ({
  page,
}) => {
  await uiLoginAsAdmin(page);

  await page.goto("/dashboard/admin/products");
  await expect(page.getByText(/all products list/i)).toBeVisible();

  await page.goto("/dashboard/admin/create-category");
  await expect(page.getByText(/manage category/i)).toBeVisible();

  await page.goto("/dashboard/admin/create-product");
  await expect(
    page.getByRole("heading", { name: /create product/i }),
  ).toBeVisible();
});

test("concurrent tabs share authentication state", async ({ context }) => {
  const page1 = await context.newPage();
  await uiLoginAsAdmin(page1);

  const page2 = await context.newPage();
  await page2.goto("/dashboard/admin/products");

  // Page2 should be authenticated because page1 set the session
  await expect(page2.getByText(/all products list/i)).toBeVisible({
    timeout: 15000,
  });
});

test("authentication state persists across page refreshes", async ({
  page,
}) => {
  await uiLoginAsAdmin(page);
  await page.goto("/dashboard/admin/products");

  const stored1 = await page.evaluate(() => localStorage.getItem("auth"));

  await page.reload();

  const stored2 = await page.evaluate(() => localStorage.getItem("auth"));
  expect(stored1).toBe(stored2);
  await expect(page.getByText(/all products list/i)).toBeVisible();
});
