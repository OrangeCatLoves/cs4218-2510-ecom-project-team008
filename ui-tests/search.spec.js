import { test, expect } from '@playwright/test';
import {clearAndRepopulateDB} from "../config/db";

test.describe.configure({ mode: 'serial' });


test.beforeEach(async({page}) => {
  await clearAndRepopulateDB();
  await page.goto('http://localhost:3000');
});

test.setTimeout(30_000);

test.describe("Search Page", () => {
  test("should show matching results correctly", async({page}) => {
    await page.getByPlaceholder("Search").fill("Laptop");
    await page.getByRole("button", {name: "Search"}).click();

    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result-name")).toHaveText("Laptop Pro 15");
    await expect(page.getByTestId("search-result-description")).toHaveText("High performance laptop with 16GB RAM and 512GB SSD".substring(0, 30)  + "...");
    await expect(page.getByTestId("search-result-price")).toHaveText("$ 1299.99");

    await page.getByPlaceholder("Search").fill("Mouse");
    await page.getByRole("button", {name: "Search"}).click();

    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result-name")).toHaveText("Wireless Mouse");
    await expect(page.getByTestId("search-result-description")).toHaveText("Ergonomic wireless mouse with USB receiver".substring(0, 30)  + "...");
    await expect(page.getByTestId("search-result-price")).toHaveText("$ 29.99");

    await page.getByPlaceholder("Search").fill("Gatsby");
    await page.getByRole("button", {name: "Search"}).click();

    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result-name")).toHaveText("The Great Gatsby");
    await expect(page.getByTestId("search-result-description")).toHaveText("Classic American novel by F. Scott Fitzgerald".substring(0, 30)  + "...");
    await expect(page.getByTestId("search-result-price")).toHaveText("$ 12.99");


    await page.getByPlaceholder("Search").fill("JavaScript");
    await page.getByRole("button", {name: "Search"}).click();

    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result-name")).toHaveText("JavaScript Guide");
    await expect(page.getByTestId("search-result-description")).toHaveText("Comprehensive guide to modern JavaScript programming".substring(0, 30)  + "...");
    await expect(page.getByTestId("search-result-price")).toHaveText("$ 45.99");

    await page.getByPlaceholder("Search").fill("T-Shirt");
    await page.getByRole("button", {name: "Search"}).click();

    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result-name")).toHaveText("Cotton T-Shirt");
    await expect(page.getByTestId("search-result-description")).toHaveText("Comfortable 100% cotton t-shirt in various colors".substring(0, 30)  + "...");
    await expect(page.getByTestId("search-result-price")).toHaveText("$ 19.99");

    await page.getByPlaceholder("Search").fill("Jeans");
    await page.getByRole("button", {name: "Search"}).click();

    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result-name")).toHaveText("Denim Jeans");
    await expect(page.getByTestId("search-result-description")).toHaveText("Classic fit denim jeans".substring(0, 30)  + "...");
    await expect(page.getByTestId("search-result-price")).toHaveText("$ 59.99");
  });
});