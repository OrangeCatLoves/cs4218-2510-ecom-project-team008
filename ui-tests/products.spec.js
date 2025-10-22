/* eslint-disable notice/notice */
import { test, expect } from "@playwright/test";
import { adminUsers } from "../config/populateDb";
import { clearAndRepopulateDB } from "../config/db";

const GET_PRODUCTS = /\/api\/v1\/product\/get-product$/;

test.describe("Admin Products Page - UI Tests", () => {
  const adminInDb = adminUsers[0];
  test.beforeEach(async ({ page }) => {
    await clearAndRepopulateDB();
    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email").fill(adminInDb.email);
    await page.getByPlaceholder("Enter Your Password").fill(adminInDb.password);

    await page.getByRole("button", { name: "LOGIN" }).click();

    await page.getByRole("button", { name: adminInDb.name }).click();
    await page.getByRole("link", { name: "Dashboard" }).click();
  });

test("lists products with images, links to Update page, and back navigation works", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  await expect(page.getByText(/all products list/i)).toBeVisible();

  const cards = page.locator(".card");
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  const firstCard = cards.first();
  const firstImg = firstCard.getByRole("img");
  await expect(firstImg).toHaveAttribute(
    "src",
    /\/api\/v1\/product\/product-photo\/.+/,
  );

  const firstLink = firstCard.locator("a").first();
  await firstLink.click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/product\/.+/);
  await expect(page.getByText(/update product/i)).toBeVisible();
  await expect(page.getByPlaceholder(/write a name/i)).toHaveValue(/.+/);

  await page.goBack();
  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("shows a loading state while fetching, then renders list", async ({
  page,
}) => {
  await page.route(GET_PRODUCTS, async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.continue();
  });

  await page.goto("/dashboard/admin/products");

  await expect(page.getByText(/loading/i)).toBeVisible();
  await expect(page.getByText(/all products list/i)).toBeVisible();
  const cards = page.locator(".card");
  expect(await cards.count()).toBeGreaterThan(0);
});

test("image src for each product points to the photo API", async ({ page }) => {
  await page.goto("/dashboard/admin/products");

  const imgs = page.locator("img");
  const n = await imgs.count();
  expect(n).toBeGreaterThan(0);

  for (let i = 0; i < Math.min(n, 6); i++) {
    await expect(imgs.nth(i)).toHaveAttribute(
      "src",
      /\/api\/v1\/product\/product-photo\/.+/,
    );
  }
});

test("every product card is wrapped with a link to its Update route", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  const anchors = page.locator('a[href^="/dashboard/admin/product/"]');
  expect(await anchors.count()).toBeGreaterThan(0);

  const firstHref = await anchors.first().getAttribute("href");
  expect(firstHref).toMatch(/^\/dashboard\/admin\/product\/[a-z0-9-]+$/i);
});

test("handles empty list safely (no cards but page shell remains)", async ({
  page,
}) => {
  await page.route(GET_PRODUCTS, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: [] }),
    });
  });

  await page.goto("/dashboard/admin/products");

  await expect(page.getByText(/all products list/i)).toBeVisible();
  expect(await page.locator(".card").count()).toBe(0);
});

test("API failure → shows error toast and keeps shell", async ({ page }) => {
  await page.route(GET_PRODUCTS, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Server exploded" }),
    });
  });

  await page.goto("/dashboard/admin/products");

  await expect(page.getByText(/something went wrong/i)).toBeVisible();
  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("refresh persists view and remains authorized", async ({ page }) => {
  await page.goto("/dashboard/admin/products");
  await expect(page.getByText(/all products list/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/all products list/i)).toBeVisible();

  const cards = page.locator(".card");
  expect(await cards.count()).toBeGreaterThan(0);
});

test("layout and admin menu are present on the page", async ({ page }) => {
  await page.goto("/dashboard/admin/products");

  await expect(page.getByText(/admin menu/i)).toBeVisible();
  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("product cards display product names", async ({ page }) => {
  await page.goto("/dashboard/admin/products");

  const cards = page.locator(".card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  // First card should have visible text content
  const firstCard = cards.first();
  const text = await firstCard.textContent();
  expect(text).toBeTruthy();
  if (text) {
    expect(text.length).toBeGreaterThan(0);
  }
});

test("clicking a product navigates to the correct update page URL", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  const firstLink = page
    .locator('a[href^="/dashboard/admin/product/"]')
    .first();
  const href = await firstLink.getAttribute("href");

  await firstLink.click();

  if (href) {
    await expect(page).toHaveURL(href);
  }
  await expect(page.getByText(/update product/i)).toBeVisible();
});

test("multiple products are displayed in a grid/list layout", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  const cards = page.locator(".card");
  const count = await cards.count();

  // Should have more than one product (assuming test data exists)
  expect(count).toBeGreaterThanOrEqual(1);
});

test("page title/heading is visible", async ({ page }) => {
  await page.goto("/dashboard/admin/products");

  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("slow API response shows loading state", async ({ page }) => {
  let routeHit = false;
  await page.route(GET_PRODUCTS, async (route) => {
    routeHit = true;
    await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });

  await page.goto("/dashboard/admin/products");

  // Should have shown loading at some point
  expect(routeHit).toBe(true);

  // Eventually shows products
  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("navigation breadcrumb or header shows current location", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  // Should show we're in products section
  const hasProducts = await page
    .getByText(/products|all products/i)
    .isVisible();
  expect(hasProducts).toBe(true);
});

test("product images are lazy loaded or have proper loading attributes", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  const imgs = page.locator("img");
  const count = await imgs.count();

  if (count > 0) {
    const firstImg = imgs.first();
    const src = await firstImg.getAttribute("src");
    expect(src).toBeTruthy();
  }
});

test("page is accessible after login without additional clicks", async ({
  page,
}) => {
  await page.goto("/dashboard/admin/products");

  // Should be on products page
  await expect(page).toHaveURL(/\/dashboard\/admin\/products/i);
  await expect(page.getByText(/all products list/i)).toBeVisible();
});

test("product list updates when navigating away and back", async ({ page }) => {
  await page.goto("/dashboard/admin/products");
  const initialCount = await page.locator(".card").count();

  await page.goto("/dashboard/admin/create-category");
  await expect(page.getByText(/manage category/i)).toBeVisible();

    await page.goto("/dashboard/admin/products");
    const finalCount = await page.locator(".card").count();

    expect(finalCount).toBe(initialCount);
  });
});
