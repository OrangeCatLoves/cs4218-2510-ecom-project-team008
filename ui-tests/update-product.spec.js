// e2e/ui/update-product.spec.js
import { test, expect } from "@playwright/test";
import { uiLoginAsAdmin } from "./fixtures/auth.js";

test.use({
  baseURL: "http://localhost:3000",
});

test.setTimeout(45000);

function tinyPngPayload() {
  const hex =
    "89504E470D0A1A0A0000000D4948445200000001000000010806000000" +
    "1F15C4890000000A49444154789C6360000002000154010D0A2DB40000" +
    "000049454E44AE426082";
  return Buffer.from(hex, "hex");
}

async function createProductViaUI(
  page,
  {
    name,
    price = "1500",
    qty = "5",
    category = /electronics/i,
    shipping = /yes/i,
  } = {},
) {
  const productName = name ?? `E2E-Upd-${Date.now()}`;
  await page.goto("/dashboard/admin/create-product");
  await page.getByPlaceholder(/write a name/i).fill(productName);
  await page
    .getByPlaceholder(/write a description/i)
    .fill("E2E product for update flow");
  await page.getByPlaceholder(/write a price/i).fill(String(price));
  await page.getByPlaceholder(/write a quantity/i).fill(String(qty));
  await page.getByText(/select a category/i).click();
  await page.getByText(category).click();
  await page.getByText(/select shipping/i).click();
  await page.getByText(shipping).click();
  await page.setInputFiles('input[type="file"][name="photo"]', {
    name: "seed.png",
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
  await expect(
    page.getByRole("link", { name: new RegExp(productName, "i") }),
  ).toBeVisible();
  return productName;
}

test.beforeEach(async ({ page }) => {
  await uiLoginAsAdmin(page);
});

test("updates name/price/category/shipping and sees changes on list", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page);
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/product\/.+/);

  const newName = `${createdName}-PRO`;
  await page.getByPlaceholder(/write a name/i).clear();
  await page.getByPlaceholder(/write a name/i).fill(newName);

  await page.getByPlaceholder(/write a price/i).clear();
  await page.getByPlaceholder(/write a price/i).fill("1800");

  await page.getByText(/select a category/i).click();
  await page.getByText(/books/i).click();

  await page.getByText(/select shipping/i).click();
  await page.getByText(/^no$/i).click();

  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });
  await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i);
  await expect(
    page.getByRole("link", { name: new RegExp(`^${newName}$`, "i") }),
  ).toBeVisible();
});

test("client-side validation: empty name, price=0, negative qty block submission", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page);
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await page.getByPlaceholder(/write a name/i).clear();
  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/product name is required/i)).toBeVisible();

  await page.getByPlaceholder(/write a name/i).fill(createdName);
  await page.getByPlaceholder(/write a price/i).clear();
  await page.getByPlaceholder(/write a price/i).fill("0");
  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/price must be greater than 0/i)).toBeVisible();

  await page.getByPlaceholder(/write a price/i).clear();
  await page.getByPlaceholder(/write a price/i).fill("10");
  await page.getByPlaceholder(/write a quantity/i).clear();
  await page.getByPlaceholder(/write a quantity/i).fill("-3");
  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/quantity cannot be negative/i)).toBeVisible();
});

test("photo preview shows before saving", async ({ page }) => {
  const createdName = await createProductViaUI(page);
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await page.setInputFiles('input[type="file"][name="photo"]', {
    name: "new.png",
    mimeType: "image/png",
    buffer: tinyPngPayload(),
  });

  await expect(page.getByText("new.png")).toBeVisible();
  const previewImgs = page.getByAltText(/product_photo/i);
  await expect(previewImgs.first()).toHaveAttribute("src", /blob:/);
});

test("delete flow: cancel keeps product, confirm removes it and navigates back", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page);
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await page.getByRole("button", { name: /delete product/i }).click();
  await expect(page.getByText(/are you sure/i)).toBeVisible();
  await page.getByRole("button", { name: /cancel/i }).click();
  await expect(
    page.getByRole("heading", { name: /update product/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /delete product/i }).click();
  const confirmDelete = page.getByRole("button", { name: /^delete$/i }).nth(1);
  await confirmDelete.click();

  await expect(page.getByText(/product deleted successfully/i)).toBeVisible({
    timeout: 15000,
  });
  await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i);
  await expect(
    page.getByRole("link", { name: new RegExp(`^${createdName}$`, "i") }),
  ).toHaveCount(0);
});

test("server error on update shows error toast and stays on page", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page);
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await page.route(/\/api\/v1\/product\/update-product\/.+/, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Server error" }),
    });
  });

  await page.getByRole("button", { name: /update product/i }).click();
  await expect(
    page.getByText(/something went wrong|error|failed/i),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/admin\/product\/.+/i);
});

test('shipping "No" persists after update and reload', async ({ page }) => {
  const createdName = await createProductViaUI(page, { shipping: /no/i });
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await expect(page.getByText(/\bno\b/i)).toBeVisible();
  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();
  await expect(page.getByText(/\bno\b/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/\bno\b/i)).toBeVisible();
});

test("update product page displays current product data correctly", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page, {
    price: "99",
    qty: "10",
  });

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  // Verify pre-filled values
  await expect(page.getByDisplayValue(createdName)).toBeVisible();
  await expect(
    page.getByDisplayValue("E2E product for update flow"),
  ).toBeVisible();
  await expect(page.getByDisplayValue("99")).toBeVisible();
  await expect(page.getByDisplayValue("10")).toBeVisible();
});

test("updating only description field works correctly", async ({ page }) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  const newDesc = `Updated description ${Date.now()}`;
  await page.getByPlaceholder(/write a description/i).clear();
  await page.getByPlaceholder(/write a description/i).fill(newDesc);

  await page.getByRole("button", { name: /update product/i }).click();

  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });
});

test("updating only quantity field works correctly", async ({ page }) => {
  const createdName = await createProductViaUI(page, { qty: "5" });

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await page.getByPlaceholder(/write a quantity/i).clear();
  await page.getByPlaceholder(/write a quantity/i).fill("25");

  await page.getByRole("button", { name: /update product/i }).click();

  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });

  // Verify on list page
  await expect(page).toHaveURL(/\/dashboard\/admin\/products$/i);
});

test("update page heading shows correct title", async ({ page }) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await expect(
    page.getByRole("heading", { name: /update product/i }),
  ).toBeVisible();
});

test("category dropdown shows current category selected", async ({ page }) => {
  const createdName = await createProductViaUI(page, {
    category: /electronics/i,
  });

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  // Electronics category should be visible/selected
  await expect(page.getByText(/electronics/i)).toBeVisible();
});

test("update and delete buttons are both visible on update page", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await expect(
    page.getByRole("button", { name: /update product/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /delete product/i }),
  ).toBeVisible();
});

test("photo is displayed on update page for existing product", async ({
  page,
}) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  // Should show existing photo
  const img = page.getByAltText(/product_photo/i).first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/product-photo|blob:/);
});

test("multiple consecutive updates work without errors", async ({ page }) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  // First update
  await page.getByPlaceholder(/write a price/i).clear();
  await page.getByPlaceholder(/write a price/i).fill("100");
  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });

  // Second update
  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();
  await page.getByPlaceholder(/write a price/i).clear();
  await page.getByPlaceholder(/write a price/i).fill("150");
  await page.getByRole("button", { name: /update product/i }).click();
  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });
});

test("cancel button in delete modal prevents deletion", async ({ page }) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  await page.getByRole("button", { name: /delete product/i }).click();
  await expect(page.getByText(/are you sure/i)).toBeVisible();

  await page.getByRole("button", { name: /cancel/i }).click();

  // Should still be on update page
  await expect(
    page.getByRole("heading", { name: /update product/i }),
  ).toBeVisible();
  await expect(page.getByDisplayValue(createdName)).toBeVisible();
});

test("updating with very long product name works", async ({ page }) => {
  const createdName = await createProductViaUI(page);

  await page
    .getByRole("link", { name: new RegExp(`^${createdName}$`, "i") })
    .first()
    .click();

  const longName = `${"VeryLongProductName".repeat(5)}-${Date.now()}`;
  await page.getByPlaceholder(/write a name/i).clear();
  await page.getByPlaceholder(/write a name/i).fill(longName);

  await page.getByRole("button", { name: /update product/i }).click();

  await expect(page.getByText(/product updated successfully/i)).toBeVisible({
    timeout: 15000,
  });
});
