import { test, expect } from '@playwright/test';
import { clearAndRepopulateDB } from "../config/db";

test.beforeEach(async ({ page }) => {
  await clearAndRepopulateDB();
  await page.goto('/');
});

test.describe('Homepage - Product Display', () => {
  test('should display products on initial load', async ({ page }) => {
    await expect(page.getByText('All Products')).toBeVisible();
    await expect(page.getByText('Filter By Category')).toBeVisible();
    await expect(page.getByText('Filter By Price')).toBeVisible();
  });

  test('should filter products by category', async ({ page }) => {
    // Check if categories are displayed
    await expect(page.getByRole('checkbox').first()).toBeVisible();

    // Check a category checkbox (first one)
    // noWaitAfter: checkboxes don't trigger navigation
    await page.getByRole('checkbox').first().check({ noWaitAfter: true });

    // Verify products are still displayed (filtering applied)
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('should add product to cart from homepage', async ({ page }) => {
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();
  });

  test('should navigate to product details', async ({ page }) => {
    await page.getByRole('button', { name: 'More Details' }).first().click();
    // No need for waitForURL - click() already waits for navigation
    // Accept both uppercase and lowercase in slugs (e.g., "Denim-Jeans")
    await expect(page).toHaveURL(/\/product\/[a-zA-Z0-9-]+$/);
  });
});

test.describe('Homepage - Error Scenarios', () => {
  test('should handle empty category list', async ({ page }) => {
    // Mock empty category response from real backend
    await page.route('**/api/v1/category/get-category', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'All Categories List',
          category: []  // Empty categories
        })
      });
    });

    // Navigate and verify page still loads
    await page.goto('/');
    await expect(page.getByText('All Products')).toBeVisible();
    // Categories section might be empty or not show checkboxes
  });

  test('should reset filters when clicking RESET FILTERS', async ({ page }) => {
    // Apply a filter - noWaitAfter: checkboxes don't trigger navigation
    await page.getByRole('checkbox').first().check({ noWaitAfter: true });

    // Wait for the product filter API call to complete
    await page.waitForResponse(response =>
      response.url().includes('/api/v1/product/product-filters') &&
      response.status() === 200
    );

    // Verify filter is applied (checkbox is checked)
    await expect(page.getByRole('checkbox').first()).toBeChecked();

    // Click reset (resets React state: checked=[], radio=[])
    await page.getByRole('button', { name: 'RESET FILTERS' }).click();

    // Verify filters are reset - checkbox should be unchecked
    await expect(page.getByRole('checkbox').first()).not.toBeChecked();
    await expect(page.getByText('All Products')).toBeVisible();
  });

  test('should handle filter with no results', async ({ page }) => {
    // Select category and price range that might have no products
    // noWaitAfter: checkboxes don't trigger navigation
    await page.getByRole('checkbox').first().check({ noWaitAfter: true });

    // Wait for the product filter API call to complete
    await page.waitForResponse(response =>
      response.url().includes('/api/v1/product/product-filters') &&
      response.status() === 200
    );

    // Click price range label (Ant Design Radio requires clicking label, not hidden input)
    await page.getByText('$0 to 19.99').click();

    // Page should still be functional even with no results
    await expect(page.getByText('All Products')).toBeVisible();
  });

  test('should handle loadmore at pagination end', async ({ page }) => {
    // Check if loadmore button exists
    const loadmoreButton = page.getByRole('button', { name: /loadmore/i });

    // If it exists and is visible, click it
    const isVisible = await loadmoreButton.isVisible().catch(() => false);
    if (isVisible) {
      await loadmoreButton.click();

      // Verify still on same page
      await expect(page).toHaveURL('/');
    }
  });

  test('should display "No Products Found" when product list is empty', async ({ page }) => {
    // Mock empty product list response
    await page.route('**/api/v1/product/product-list/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Products fetched successfully',
          products: []  // Empty product list
        })
      });
    });

    // Mock product count as 0
    await page.route('**/api/v1/product/product-count', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          total: 0
        })
      });
    });

    // Navigate to homepage
    await page.goto('/');

    // Verify "No Products Found" message is visible
    await expect(page.getByRole('heading', { name: 'No Products Found' })).toBeVisible();

    // Verify "All Products" heading is still visible
    await expect(page.getByText('All Products')).toBeVisible();

    // Verify no product cards are displayed
    await expect(page.locator('.card')).toHaveCount(0);
  });
});
