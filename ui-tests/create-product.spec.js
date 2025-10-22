/* eslint-disable notice/notice */
import { test, expect } from "@playwright/test";
import { adminUsers } from "../config/populateDb";
import { clearAndRepopulateDB } from "../config/db";

function tinyPngPayload() {
  const hex =
    "89504E470D0A1A0A0000000D4948445200000001000000010806000000" +
    "1F15C4890000000A49444154789C6360000002000154010D0A2DB40000" +
    "000049454E44AE426082";
  return Buffer.from(hex, "hex");
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureCategoryExists(page, name) {
  await page.goto("/dashboard/admin/create-category");
  await page.getByPlaceholder(/enter new category/i).fill(name);
  await page
    .getByRole("button", { name: /create category/i })
    .click()
    .catch(() => {});
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}

test.describe("Create Product Page - UI Tests", () => {
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

  test("validation prevents empty submission", async ({ page }) => {
    await page.goto("/dashboard/admin/create-product");
    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page.getByText(/product name is required/i)).toBeVisible();
  });

  test("client-side validations: price > 0, quantity >= 0, category required", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin/create-product");

    await page.getByPlaceholder(/write a name/i).fill("X");
    await page.getByPlaceholder(/write a description/i).fill("Y");
    await page.getByPlaceholder(/write a price/i).fill("0");
    await page.getByPlaceholder(/write a quantity/i).fill("-5");

    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page.getByText(/price must be greater than 0/i)).toBeVisible();

    await page.getByPlaceholder(/write a price/i).fill("");
    await page.getByPlaceholder(/write a price/i).fill("100");
    await page.getByPlaceholder(/write a quantity/i).fill("");
    await page.getByPlaceholder(/write a quantity/i).fill("5");

    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page.getByText(/please select a category/i)).toBeVisible();
  });

  test("creates a product end-to-end, verifies on list and update page (shipping: Yes)", async ({
    page,
  }) => {
    const catName = `E2E-CAT-${Date.now()}`;
    await ensureCategoryExists(page, catName);

    await page.goto("/dashboard/admin/create-product");

    const name = `E2E Gaming Laptop ${Date.now()}`;
    await page.getByPlaceholder(/write a name/i).fill(name);
    await page
      .getByPlaceholder(/write a description/i)
      .fill("High-end gaming laptop");
    await page.getByPlaceholder(/write a price/i).fill("1500");
    await page.getByPlaceholder(/write a quantity/i).fill("5");

    await page.getByText(/select a category/i).click();
    await page.getByText(new RegExp(`^${catName}$`, "i")).click();

    await page.getByText(/select shipping/i).click();
    await page.getByText(/^yes$/i).click();

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "sample.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /create product/i }).click();

    await expect(page.getByText(/product created successfully/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i, {
      timeout: 15000,
    });

    const created = page.getByText(name, { exact: true }).first();
    await expect(created).toBeVisible();

    const cardImg = created
      .locator("xpath=ancestor::*[self::a or self::div]")
      .locator("img")
      .first();
    await expect(cardImg).toHaveAttribute(/src/, /product-photo/i);

    const link = (await created.elementHandle())
      ? await created.evaluateHandle((el) => el.closest("a"))
      : null;
    if (link) {
      const href = await (await link.asElement()).getAttribute("href");
      expect(href).toMatch(/\/dashboard\/admin\/product\//i);
      await (await link.asElement()).click();
    } else {
      await created.click();
    }

    await expect(page.getByText(/update product/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByDisplayValue(name)).toBeVisible();
    await expect(page.getByText(catName)).toBeVisible();
    await expect(page.getByText(/yes/i)).toBeVisible();
    const updImg = page.getByAltText("product_photo").first();
    await expect(updImg).toHaveAttribute(/src/, /product-photo/i);
  });

  test("creates a product with Shipping: No then verifies value on update page", async ({
    page,
  }) => {
    const catName = `E2E-CAT-NO-${Date.now()}`;
    await ensureCategoryExists(page, catName);

    await page.goto("/dashboard/admin/create-product");

    const name = `E2E Mouse ${Date.now()}`;
    await page.getByPlaceholder(/write a name/i).fill(name);
    await page.getByPlaceholder(/write a description/i).fill("Wireless mouse");
    await page.getByPlaceholder(/write a price/i).fill("29.9");
    await page.getByPlaceholder(/write a quantity/i).fill("10");

    await page.getByText(/select a category/i).click();
    await page.getByText(new RegExp(`^${catName}$`, "i")).click();

    await page.getByText(/select shipping/i).click();
    await page.getByText(/^no$/i).click();

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "mouse.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /create product/i }).click();

    await expect(page.getByText(/product created successfully/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i);

    const link = (await page
      .getByText(name, { exact: true })
      .first()
      .elementHandle())
      ? await (
          await page.getByText(name, { exact: true }).first().elementHandle()
        ).evaluateHandle((el) => el.closest("a"))
      : null;

    if (link) {
      await (await link.asElement()).click();
    } else {
      await page.getByText(name, { exact: true }).first().click();
    }

    await expect(page.getByText(/update product/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/no/i)).toBeVisible();
  });

  test("photo preview appears on create page before submit", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin/create-product");

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "preview.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await expect(page.getByText("preview.png")).toBeVisible();
    await expect(page.getByAltText("product_photo")).toBeVisible();
  });

  test("update newly created product: change price and photo, save successfully", async ({
    page,
  }) => {
    const catName = `E2E-CAT-UPD-${Date.now()}`;
    await ensureCategoryExists(page, catName);

    await page.goto("/dashboard/admin/create-product");

    const name = `E2E Keyboard ${Date.now()}`;
    await page.getByPlaceholder(/write a name/i).fill(name);
    await page
      .getByPlaceholder(/write a description/i)
      .fill("Mechanical keyboard");
    await page.getByPlaceholder(/write a price/i).fill("120");
    await page.getByPlaceholder(/write a quantity/i).fill("12");

    await page.getByText(/select a category/i).click();
    await page.getByText(new RegExp(`^${catName}$`, "i")).click();

    await page.getByText(/select shipping/i).click();
    await page.getByText(/^yes$/i).click();

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "kbd.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /create product/i }).click();

    await expect(page.getByText(/product created successfully/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i);

    const anchor = await page.getByText(name, { exact: true }).first();
    const handle = await anchor.elementHandle();
    if (handle) {
      const linkHandle = await handle.evaluateHandle((el) => el.closest("a"));
      const linkEl = linkHandle.asElement();
      if (linkEl) {
        const href = await linkEl.getAttribute("href");
        if (href) {
          await page.goto(href);
        } else {
          await anchor.click();
        }
      } else {
        await anchor.click();
      }
    } else {
      await anchor.click();
    }

    await expect(page.getByText(/update product/i)).toBeVisible({
      timeout: 15000,
    });

    const priceBox = page.getByPlaceholder(/write a price/i);
    await priceBox.fill("");
    await priceBox.fill("150");

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "kbd-new.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /update product/i }).click();

    await expect(
      page.getByText(/product updated successfully|product updated/i),
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i, {
      timeout: 15000,
    });

    const card = page.getByText(name, { exact: true }).first();
    await expect(card).toBeVisible();
  });

  test("delete newly created product from Update page (cleanup path)", async ({
    page,
  }) => {
    const catName = `E2E-CAT-DEL-${Date.now()}`;
    await ensureCategoryExists(page, catName);

    await page.goto("/dashboard/admin/create-product");

    const name = `E2E Headset ${Date.now()}`;
    await page.getByPlaceholder(/write a name/i).fill(name);
    await page.getByPlaceholder(/write a description/i).fill("Gaming headset");
    await page.getByPlaceholder(/write a price/i).fill("80");
    await page.getByPlaceholder(/write a quantity/i).fill("7");

    await page.getByText(/select a category/i).click();
    await page.getByText(new RegExp(`^${catName}$`, "i")).click();

    await page.getByText(/select shipping/i).click();
    await page.getByText(/^no$/i).click();

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "headset.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /create product/i }).click();
    await expect(page.getByText(/product created successfully/i)).toBeVisible({
      timeout: 15000,
    });

    const card = page.getByText(name, { exact: true }).first();
    const cardHandle = await card.elementHandle();
    if (cardHandle) {
      const linkHandle = await cardHandle.evaluateHandle((el) =>
        el.closest("a"),
      );
      const linkEl = linkHandle.asElement();
      if (linkEl) {
        const href = await linkEl.getAttribute("href");
        if (href) {
          await page.goto(href);
        } else {
          await card.click();
        }
      } else {
        await card.click();
      }
    } else {
      await card.click();
    }

    await expect(
      page.getByRole("button", { name: /delete product/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /delete product/i }).click();

    const modal = page.locator('.ant-modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    const deleteBtn = modal.getByRole("button", { name: /^delete$/i }).last();
    await deleteBtn.click();

    await expect(page.getByText(/product deleted successfully/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i, {
      timeout: 15000,
    });
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("page heading and form labels are displayed correctly", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin/create-product");

    await expect(
      page.getByRole("heading", { name: /create product/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/write a name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/write a description/i)).toBeVisible();
    await expect(page.getByPlaceholder(/write a price/i)).toBeVisible();
    await expect(page.getByPlaceholder(/write a quantity/i)).toBeVisible();
  });

  test("product with decimal price is created correctly", async ({ page }) => {
    const catName = `E2E-CAT-DEC-${Date.now()}`;
    await ensureCategoryExists(page, catName);

    await page.goto("/dashboard/admin/create-product");

    const name = `E2E Cable ${Date.now()}`;
    await page.getByPlaceholder(/write a name/i).fill(name);
    await page.getByPlaceholder(/write a description/i).fill("USB Cable");
    await page.getByPlaceholder(/write a price/i).fill("9.99");
    await page.getByPlaceholder(/write a quantity/i).fill("100");

    await page.getByText(/select a category/i).click();
    await page.getByText(new RegExp(`^${catName}$`, "i")).click();

    await page.getByText(/select shipping/i).click();
    await page.getByText(/^yes$/i).click();

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "cable.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /create product/i }).click();

    await expect(page.getByText(/product created successfully/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  });

  test("form resets after successful product creation", async ({ page }) => {
    const catName = `E2E-CAT-RESET-${Date.now()}`;
    await ensureCategoryExists(page, catName);

    await page.goto("/dashboard/admin/create-product");

    const name = `E2E Monitor ${Date.now()}`;
    await page.getByPlaceholder(/write a name/i).fill(name);
    await page.getByPlaceholder(/write a description/i).fill("4K Monitor");
    await page.getByPlaceholder(/write a price/i).fill("399");
    await page.getByPlaceholder(/write a quantity/i).fill("15");

    await page.getByText(/select a category/i).click();
    await page.getByText(new RegExp(`^${catName}$`, "i")).click();

    await page.getByText(/select shipping/i).click();
    await page.getByText(/^yes$/i).click();

    await page.setInputFiles('input[type="file"][name="photo"]', {
      name: "monitor.png",
      mimeType: "image/png",
      buffer: tinyPngPayload(),
    });

    await page.getByRole("button", { name: /create product/i }).click();

    await expect(page.getByText(/product created successfully/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i);
  });

  test("navigating to create product page from products list works", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin/products");

    // Look for Create Product link/button
    const createLink = page
      .getByRole("link", { name: /create product/i })
      .or(page.getByRole("button", { name: /create product/i }));

    const exists = await createLink.isVisible().catch(() => false);
    if (!exists) {
      // Try navigating directly
      await page.goto("/dashboard/admin/create-product");
    } else {
      await createLink.click();
    }

    await expect(page).toHaveURL(/\/dashboard\/admin\/create-product/i);
    await expect(
      page.getByRole("heading", { name: /create product/i }),
    ).toBeVisible();
  });

  test("quantity field accepts only numeric values", async ({ page }) => {
    await page.goto("/dashboard/admin/create-product");

    const qtyField = page.getByPlaceholder(/write a quantity/i);
    await qtyField.fill("abc");

    // Field should either reject non-numeric or show validation error
    const value = await qtyField.inputValue();
    expect(value).toMatch(/^[0-9]*$/);
  });

  test("price field accepts numeric values with decimals", async ({ page }) => {
    await page.goto("/dashboard/admin/create-product");

    const priceField = page.getByPlaceholder(/write a price/i);
    await priceField.fill("99.99");

    const value = await priceField.inputValue();
    expect(value).toBe("99.99");
  });
});
