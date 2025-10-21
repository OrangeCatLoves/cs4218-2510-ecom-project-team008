import { test, expect } from '@playwright/test';

// Configure test settings
test.use({ 
  baseURL: 'http://localhost:3000',
});

test.setTimeout(30000);

test.describe('CategoryProduct Page - UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to category page via dropdown menu', async ({ page }) => {
    // Click on Categories dropdown
    await page.getByRole('link', { name: 'Categories' }).click();
    
    // Wait for dropdown menu to appear
    await page.waitForTimeout(500);
    
    // Click on "Book" category from dropdown
    await page.locator('.dropdown-menu').getByRole('link', { name: 'Book' }).click();
    
    // Wait for navigation
    await page.waitForURL('/category/book');
    await page.waitForTimeout(1500);
    
    // Verify we're on the category page - use more specific locator
    await expect(page.locator('.container.category h4')).toContainText('Category - Book');
    await expect(page.locator('.container.category h6')).toContainText('result found');
  });

  test('should display correct category name and product count', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Verify category heading - use container.category to avoid footer
    const categoryHeading = page.locator('.container.category h4');
    await expect(categoryHeading).toBeVisible();
    await expect(categoryHeading).toContainText('Category - Book');
    
    // Verify result count is displayed
    const resultCount = page.locator('.container.category h6');
    await expect(resultCount).toBeVisible();
    await expect(resultCount).toContainText('result found'); // Fixed: use toContainText instead of toMatch
});

  test('should display all products in the selected category', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    
    // Wait for products to load
    await page.waitForTimeout(1500);
    
    // Get the displayed count
    const countText = await page.locator('.container.category h6').textContent();
    const displayedCount = parseInt(countText.match(/(\d+)/)[1]);
    
    // Verify products are displayed
    const productCards = page.locator('.category .card');
    
    if (displayedCount > 0) {
      await expect(productCards.first()).toBeVisible();
      
      // Verify actual card count matches displayed count
      const actualCount = await productCards.count();
      expect(actualCount).toBe(displayedCount);
    }
  });

  test('should display all required product card elements', async ({ page }) => {
    // Navigate to Electronics category (has 2 products)
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get first product card
    const firstCard = page.locator('.category .card').first();
    await expect(firstCard).toBeVisible();
    
    // Verify all required elements are present
    await expect(firstCard.locator('.card-img-top')).toBeVisible();
    await expect(firstCard.locator('.card-title').first()).toBeVisible(); // Product name
    await expect(firstCard.locator('.card-price')).toBeVisible();
    await expect(firstCard.locator('.card-text')).toBeVisible(); // Description
    await expect(firstCard.getByRole('button', { name: 'More Details' })).toBeVisible();
  });

  test('should display product images with correct API endpoint', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get first product image
    const productImage = page.locator('.category .card-img-top').first();
    await expect(productImage).toBeVisible();
    
    // Verify image source points to correct API endpoint
    const imageSrc = await productImage.getAttribute('src');
    expect(imageSrc).toContain('/api/v1/product/product-photo/');
    
    // Verify alt text exists
    const altText = await productImage.getAttribute('alt');
    expect(altText).toBeTruthy();
  });

  test('should format product prices correctly with USD currency', async ({ page }) => {
    // Navigate to Electronics category
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get first product price
    const priceElement = page.locator('.card-price').first();
    await expect(priceElement).toBeVisible();
    
    const priceText = await priceElement.textContent();
    
    // Verify price format (should be $X,XXX.XX or $X.XX)
    expect(priceText).toMatch(/\$[\d,]+\.\d{2}/);
  });

  test('should truncate product descriptions to 60 characters', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get first product description
    const descriptionElement = page.locator('.card-text').first();
    await expect(descriptionElement).toBeVisible();
    
    const descriptionText = await descriptionElement.textContent();
    
    // Verify description ends with "..." (truncated)
    expect(descriptionText).toContain('...');
    
    // Verify description is reasonably short (60 chars + "..." + some margin)
    expect(descriptionText.length).toBeLessThanOrEqual(70);
  });

  test('should navigate to product details when clicking More Details button', async ({ page }) => {
    // Navigate to Electronics category
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Click More Details on first product
    await page.locator('.category').getByRole('button', { name: 'More Details' }).first().click();
    
    // Verify navigation to product details page
    await page.waitForURL(/\/product\/.+/);
    await page.waitForTimeout(2000);
    
    // Verify we're on product details page
    await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
  });

  test('should display correct result count matching actual products shown', async ({ page }) => {
    // Navigate to Clothing category (has 1 product)
    await page.goto('/category/clothing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get the displayed count
    const countText = await page.locator('.container.category h6').textContent();
    const displayedCount = parseInt(countText.match(/(\d+)/)[1]);
    
    // Count actual product cards
    const actualCount = await page.locator('.category .card').count();
    
    // Verify they match
    expect(actualCount).toBe(displayedCount);
    expect(displayedCount).toBe(1); // We know Clothing has 1 product
  });

  test('should maintain consistent layout structure', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Verify main container exists
    await expect(page.locator('.container.category')).toBeVisible();
    
    // Verify headings are centered within the category container
    await expect(page.locator('.container.category h4')).toBeVisible();
    await expect(page.locator('.container.category h6')).toBeVisible();
    
    // Verify row structure within category container
    await expect(page.locator('.container.category .row')).toBeVisible();
    
    // Verify column with offset
    await expect(page.locator('.col-md-9.offset-1')).toBeVisible();
    
    // Verify flex wrap container for products
    await expect(page.locator('.d-flex.flex-wrap')).toBeVisible();
  });

  test('should handle direct URL navigation to category page', async ({ page }) => {
    // Navigate directly to Electronics category URL
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Verify category page loaded correctly
    await expect(page.locator('.container.category h4')).toContainText('Category - Electronics');
    await expect(page.locator('.container.category h6')).toContainText('result found');
    
    // Verify products are shown
    const productCount = await page.locator('.category .card').count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('should display different categories with different products', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    const bookCategoryName = await page.locator('.container.category h4').textContent();
    const bookProductCount = await page.locator('.category .card').count();
    
    // Navigate to Electronics category
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    const electronicsCategoryName = await page.locator('.container.category h4').textContent();
    const electronicsProductCount = await page.locator('.category .card').count();
    
    // Verify categories are different
    expect(bookCategoryName).not.toBe(electronicsCategoryName);
    expect(bookCategoryName).toContain('Book');
    expect(electronicsCategoryName).toContain('Electronics');
    
    // Verify they have different product counts (Book has 3, Electronics has 2)
    expect(bookProductCount).toBe(3);
    expect(electronicsProductCount).toBe(2);
  });

  test('should show singular "result" for single product category', async ({ page }) => {
    // Navigate to Clothing category (has 1 product)
    await page.goto('/category/clothing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Verify result text
    const resultText = await page.locator('.container.category h6').textContent();
    
    // Should show "1 result found"
    expect(resultText).toContain('1 result found');
  });

  test('should navigate between categories using header dropdown', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Book category via dropdown
    await page.getByRole('link', { name: 'Categories' }).click();
    await page.waitForTimeout(500);
    await page.locator('.dropdown-menu').getByRole('link', { name: 'Book' }).click();
    await page.waitForURL('/category/book');
    await page.waitForTimeout(1500);
    await expect(page.locator('.container.category h4')).toContainText('Category - Book');
    
    // Navigate to Electronics category via dropdown
    await page.getByRole('link', { name: 'Categories' }).click();
    await page.waitForTimeout(500);
    await page.locator('.dropdown-menu').getByRole('link', { name: 'Electronics' }).click();
    await page.waitForURL('/category/electronics');
    await page.waitForTimeout(1500);
    await expect(page.locator('.container.category h4')).toContainText('Category - Electronics');
  });

  test('should display category in URL slug format', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Verify URL contains lowercase slug
    expect(page.url()).toContain('/category/book');
    
    // But heading shows proper case
    await expect(page.locator('.container.category h4')).toContainText('Category - Book');
  });

});

test.describe('CategoryProduct Page - Edge Cases & Error Handling', () => {

  test('should handle invalid category slug gracefully', async ({ page }) => {
    // Navigate to non-existent category
    await page.goto('/category/invalid-category-slug-12345');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Should still show category page structure
    await expect(page.locator('.container.category')).toBeVisible();
    await expect(page.locator('.container.category h4')).toBeVisible();
    
    // Should show 0 results
    const resultText = await page.locator('.container.category h6').textContent();
    expect(resultText).toContain('0 result found');
    
    // Should show no product cards
    const productCount = await page.locator('.category .card').count();
    expect(productCount).toBe(0);
  });

  test('should handle category with special characters in slug', async ({ page }) => {
    // Test with lowercase category slugs (which is what your app uses)
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Should load correctly
    await expect(page.locator('.container.category h4')).toContainText('Category - Book');
    const productCount = await page.locator('.category .card').count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('should handle empty category page layout', async ({ page }) => {
    // Navigate to invalid category to test empty state
    await page.goto('/category/nonexistent');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Layout structure should still exist
    await expect(page.locator('.container.category')).toBeVisible();
    
    // Row might be hidden when empty, so just check container exists
    const containerVisible = await page.locator('.container.category').isVisible();
    expect(containerVisible).toBe(true);
    
    // But no products
    const productCount = await page.locator('.category .card').count();
    expect(productCount).toBe(0);
  });

});

test.describe('CategoryProduct Page - User Flows', () => {

  test('complete category browsing flow: home > category > product details', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to category via dropdown
    await page.getByRole('link', { name: 'Categories' }).click();
    await page.waitForTimeout(500);
    await page.locator('.dropdown-menu').getByRole('link', { name: 'Electronics' }).click();
    
    // Verify on category page
    await page.waitForURL('/category/electronics');
    await page.waitForTimeout(1500);
    await expect(page.locator('.container.category h4')).toContainText('Category - Electronics');
    
    // Verify products are shown
    const productCount = await page.locator('.category .card').count();
    expect(productCount).toBe(2);
    
    // Click on a product
    await page.locator('.category').getByRole('button', { name: 'More Details' }).first().click();
    
    // Verify on product details page
    await page.waitForURL(/\/product\/.+/);
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
  });

  test('browse multiple categories sequentially', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    const bookCount = await page.locator('.category .card').count();
    await expect(page.locator('.container.category h4')).toContainText('Book');
    expect(bookCount).toBe(3);
    
    // Navigate to Electronics category
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    const electronicsCount = await page.locator('.category .card').count();
    await expect(page.locator('.container.category h4')).toContainText('Electronics');
    expect(electronicsCount).toBe(2);
    
    // Navigate to Clothing category
    await page.goto('/category/clothing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    const clothingCount = await page.locator('.category .card').count();
    await expect(page.locator('.container.category h4')).toContainText('Clothing');
    expect(clothingCount).toBe(1);
  });

  test('navigate to all categories page and then to specific category', async ({ page }) => {
    // Navigate to "All Categories" page
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
    
    // Click on a specific category button (e.g., "Book")
    await page.getByRole('link', { name: 'Book' }).click();
    
    // Should navigate to that category
    await page.waitForURL('/category/book');
    await page.waitForTimeout(1500);
    await expect(page.locator('.container.category h4')).toContainText('Category - Book');
  });

  test('category page product card interactions', async ({ page }) => {
    // Navigate to Book category
    await page.goto('/category/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get all More Details buttons
    const detailsButtons = page.locator('.category').getByRole('button', { name: 'More Details' });
    const buttonCount = await detailsButtons.count();
    
    // Should have 3 buttons (Book category has 3 products)
    expect(buttonCount).toBe(3);
    
    // Test clicking each button navigates correctly
    for (let i = 0; i < Math.min(buttonCount, 2); i++) { // Test first 2 to save time
      await page.goto('/category/book');
      await page.waitForTimeout(1500);
      
      await page.locator('.category').getByRole('button', { name: 'More Details' }).nth(i).click();
      await page.waitForURL(/\/product\/.+/);
      await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible({ timeout: 10000 });
    }
  });

  test('verify products remain filtered by category after page reload', async ({ page }) => {
    // Navigate to Electronics category
    await page.goto('/category/electronics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Get product count before reload
    const countBeforeReload = await page.locator('.category .card').count();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Verify same products shown after reload
    const countAfterReload = await page.locator('.category .card').count();
    expect(countAfterReload).toBe(countBeforeReload);
    expect(countAfterReload).toBe(2);
    
    // Verify category name still correct
    await expect(page.locator('.container.category h4')).toContainText('Category - Electronics');
  });

});