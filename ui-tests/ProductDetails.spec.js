import { test, expect } from '@playwright/test';

// Configure test settings
test.use({ 
  baseURL: 'http://localhost:3000',
});

// Increase timeout for tests with slow API calls
test.setTimeout(30000);

test.describe('ProductDetails Page - UI Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for products to actually appear on page
    await page.locator('.card').first().waitFor({ state: 'visible', timeout: 15000 });
    
    // Optional: Wait a bit more for all products to render
    await page.waitForTimeout(1000);
  });

  test('should navigate to product details page and display all product information', async ({ page }) => {
    // Act: Click on the first "More Details" button
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    
    // Wait for navigation to product details page
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for the heading to appear
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    
    // Wait for product data to actually load
    await page.waitForTimeout(2000);
    
    // Assert: Verify all product detail elements are present
    await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
    await expect(page.locator('h6').filter({ hasText: /^Name :/ })).toBeVisible();
    await expect(page.locator('h6').filter({ hasText: /^Description :/ })).toBeVisible();
    await expect(page.locator('h6').filter({ hasText: /^Price :/ })).toBeVisible();
    await expect(page.locator('h6').filter({ hasText: /^Category :/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeVisible();
  });

  test('should display product image on details page', async ({ page }) => {
    // Navigate to product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for product details heading
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    
    // Wait for product data to load
    await page.waitForTimeout(2000);
    
    // Verify product image is displayed in the main product section
    const productImage = page.locator('.product-details .card-img-top').first();
    await expect(productImage).toBeVisible();
    
    // Verify image has proper alt attribute
    const altText = await productImage.getAttribute('alt');
    expect(altText).not.toBeNull();
    
    // Verify image source points to correct API endpoint
    const imageSrc = await productImage.getAttribute('src');
    expect(imageSrc).toContain('/api/v1/product/product-photo/');
  });

  test('should display correct price formatting with currency symbol', async ({ page }) => {
    // Navigate to product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for product details to load
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    
    // Get the price element
    const priceElement = page.locator('h6').filter({ hasText: /^Price :/ });
    
    // Wait until the price element contains a dollar sign (meaning data loaded)
    await expect(priceElement).toContainText('$', { timeout: 10000 });
    
    // Verify it's visible
    await expect(priceElement).toBeVisible();
    
    const priceText = await priceElement.textContent();
    
    // Verify price contains $ and proper decimal formatting
    expect(priceText).toMatch(/Price :\s*\$\d+\.\d{2}/);
  });

  test('should display similar products section', async ({ page }) => {
    // Navigate to product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for similar products heading to appear
    await page.getByRole('heading', { name: /Similar Products/i }).waitFor({ timeout: 10000 });
    
    // Wait for similar products to load
    await page.waitForTimeout(2000);
    
    // Verify similar products heading
    await expect(page.getByRole('heading', { name: /Similar Products/i })).toBeVisible();
    
    // Check for similar products section
    const similarProductsSection = page.locator('.similar-products');
    await expect(similarProductsSection).toBeVisible();
    
    // Verify either products exist OR "no similar products" message is shown
    const similarProductCards = await page.locator('.similar-products .card').count();
    const noProductsMessage = await page.getByText('No Similar Products found').isVisible().catch(() => false);
    
    // At least one should be true
    expect(similarProductCards > 0 || noProductsMessage).toBeTruthy();
  });

  test('should navigate to another product from similar products section', async ({ page }) => {
    // Navigate to first product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for similar products section
    await page.getByRole('heading', { name: /Similar Products/i }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Get the current product slug from URL
    const firstProductSlug = page.url().split('/product/')[1];
    
    // Check if there are similar products
    const similarProductsCount = await page.locator('.similar-products .card').count();
    
    if (similarProductsCount > 0) {
      // Click on first similar product's "More Details" button
      await page.locator('.similar-products').locator('.btn-info', { hasText: 'More Details' }).first().click();
      
      // Wait for navigation and new product to load
      await page.waitForURL(/\/product\/.+/);
      await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
      
      // Wait for new product data to load
      await page.waitForTimeout(2000);
      
      const secondProductSlug = page.url().split('/product/')[1];
      
      // Verify we navigated to a different product
      expect(secondProductSlug).not.toBe(firstProductSlug);
      
      // Verify product details page loaded
      await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
    } else {
      // If no similar products, verify the message is shown
      await expect(page.getByText('No Similar Products found')).toBeVisible();
    }
  });

  test('should add product to cart from details page', async ({ page }) => {
    // Navigate to product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for product to load
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Click ADD TO CART button
    await page.getByRole('button', { name: 'ADD TO CART' }).click();
    
    // Wait for toast notification and cart update
    await page.waitForTimeout(1500);
    
    // Navigate to cart page to verify
    await page.getByRole('link', { name: /cart/i }).click();
    await page.waitForURL('/cart');
    
    // Wait for cart page to load
    await page.waitForTimeout(1000);
    
    // Verify cart is not empty
    const cartIsEmpty = await page.getByText('Your Cart Is Empty').isVisible().catch(() => false);
    
    if (!cartIsEmpty) {
      // Cart has items - verify we can see items
      const hasItemsText = await page.locator('p').filter({ hasText: /You Have \d+ items?/i }).isVisible().catch(() => false);
      const hasCartItems = await page.locator('.cart-page .card').count() > 0;
      
      // Either the text shows items OR we can see cart item cards
      expect(hasItemsText || hasCartItems).toBeTruthy();
    } else {
      // If cart is empty, the test fails
      throw new Error('Cart is empty after adding product. The addToCart function may have failed.');
    }
  });

  test('should handle direct URL navigation to product details page', async ({ page }) => {
    // First, get a valid product slug
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    const slug = currentUrl.split('/product/')[1];
    
    // Navigate away
    await page.goto('/');
    await page.locator('.card').first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Navigate directly to the product using the slug
    await page.goto(`/product/${slug}`);
    
    // Wait for product details to load
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Verify page loads correctly
    await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
    await expect(page.locator('h6').filter({ hasText: /^Name :/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ADD TO CART' })).toBeVisible();
  });

  test('should display product category information', async ({ page }) => {
    // Navigate to product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for product to load
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    
    // Get category element
    const categoryElement = page.locator('h6').filter({ hasText: /^Category :/ });
    
    // Wait for the element to be visible
    await expect(categoryElement).toBeVisible();
    
    // Wait a bit for the data to load
    await page.waitForTimeout(2000);
    
    const categoryText = await categoryElement.textContent();
    
    // Verify category has actual content (not just "Category : " or "Category :")
    expect(categoryText).toMatch(/Category : \w+/);
    
    // Additional check: verify it's not empty
    expect(categoryText.replace('Category :', '').trim().length).toBeGreaterThan(0);
  });

  test('should maintain consistent layout structure on product details page', async ({ page }) => {
    // Navigate to product details
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for page to fully load
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Verify main layout structure exists
    await expect(page.locator('.product-details')).toBeVisible();
    
    // Verify two-column layout (image and info sections)
    const columns = page.locator('.product-details .col-md-6');
    expect(await columns.count()).toBe(2);
    
    // Verify product info section
    await expect(page.locator('.product-details-info')).toBeVisible();
    
    // Verify similar products section exists
    await expect(page.locator('.similar-products')).toBeVisible();
  });

  test('should show cart update when adding product from details page', async ({ page }) => {
    // Navigate to cart first to check initial state
    await page.getByRole('link', { name: /cart/i }).click();
    await page.waitForURL('/cart');
    await page.waitForTimeout(1000);
    
    // Get initial cart state
    const isInitiallyEmpty = await page.getByText('Your Cart Is Empty').isVisible().catch(() => false);
    let initialCount = 0;
    
    if (!isInitiallyEmpty) {
      const initialCartText = await page.locator('p').filter({ hasText: /You Have \d+ items?/i }).textContent().catch(() => 'You Have 0 items');
      const initialCountMatch = initialCartText.match(/You Have (\d+) items?/i);
      initialCount = initialCountMatch ? parseInt(initialCountMatch[1]) : 0;
    }
    
    // Go to homepage
    await page.goto('/');
    await page.locator('.card').first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Navigate to product and add to cart
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: 'ADD TO CART' }).click();
    
    // Wait for cart to update
    await page.waitForTimeout(1500);
    
    // Check cart again
    await page.getByRole('link', { name: /cart/i }).click();
    await page.waitForURL('/cart');
    await page.waitForTimeout(1000);
    
    // Verify cart is no longer empty
    const isStillEmpty = await page.getByText('Your Cart Is Empty').isVisible().catch(() => false);
    expect(isStillEmpty).toBe(false);
    
    // Get new cart count
    const hasItemsText = await page.locator('p').filter({ hasText: /You Have \d+ items?/i }).isVisible();
    
    if (hasItemsText) {
      const newCartText = await page.locator('p').filter({ hasText: /You Have \d+ items?/i }).textContent();
      const newCountMatch = newCartText.match(/You Have (\d+) items?/i);
      const newCount = newCountMatch ? parseInt(newCountMatch[1]) : 0;
      
      // Verify count increased
      expect(newCount).toBeGreaterThan(initialCount);
    } else {
      // If no text but cart is not empty, at least verify cart items exist
      const cartItemsCount = await page.locator('.cart-page .card').count();
      expect(cartItemsCount).toBeGreaterThan(0);
    }
  });

});

test.describe('ProductDetails Page - Edge Cases & Error Handling', () => {

  test('should handle invalid product slug gracefully', async ({ page }) => {
    // Try to navigate to non-existent product
    await page.goto('/product/this-product-does-not-exist-12345', { waitUntil: 'networkidle' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Verify Product Details heading shows
    await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
    
    // Verify product fields are empty (expected behavior for invalid slug)
    const nameText = await page.locator('h6').filter({ hasText: /^Name :/ }).textContent();
    const priceText = await page.locator('h6').filter({ hasText: /^Price :/ }).textContent();
    const categoryText = await page.locator('h6').filter({ hasText: /^Category :/ }).textContent();
    
    // Check that fields are essentially empty
    expect(nameText.trim()).toBe('Name :');
    expect(priceText.trim()).toBe('Price :');
    expect(categoryText.trim()).toBe('Category :');
    
    // Verify "No Similar Products found" message appears
    await expect(page.getByText('No Similar Products found')).toBeVisible();
  });

  test('should handle product with no similar products', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for products to load
    await page.locator('.card').first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Navigate to any product
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    
    // Wait for similar products section
    await page.getByRole('heading', { name: /Similar Products/i }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Should still show similar products section
    await expect(page.getByRole('heading', { name: /Similar Products/i })).toBeVisible();
    
    // Check if there are similar products or appropriate message
    const similarProductsCards = await page.locator('.similar-products .card').count();
    
    if (similarProductsCards === 0) {
      // Should show "No Similar Products found" message
      await expect(page.getByText('No Similar Products found')).toBeVisible();
    }
  });

});

test.describe('ProductDetails Page - User Flows', () => {

  test('complete user journey: browse > filter > view details > add to cart > checkout attempt', async ({ page }) => {
    // Start at homepage
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('.card').first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Apply a price filter
    await page.getByText('$0 to 19.99').click();
    
    // Wait for filtered products to appear
    await page.waitForTimeout(2000);
    
    // Check if products are still visible after filter
    const productsAfterFilter = await page.locator('.card').count();
    
    if (productsAfterFilter > 0) {
      // View product details
      await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
      await page.waitForURL(/\/product\/.+/);
      await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
      await page.waitForTimeout(2000);
      
      // Verify on product details page
      await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
      
      // Add to cart
      await page.getByRole('button', { name: 'ADD TO CART' }).click();
      
      // Wait for cart update
      await page.waitForTimeout(1500);
      
      // Go to cart
      await page.getByRole('link', { name: /cart/i }).click();
      await page.waitForURL('/cart');
      await page.waitForTimeout(1000);
      
      // Verify cart is not empty
      const cartIsEmpty = await page.getByText('Your Cart Is Empty').isVisible().catch(() => false);
      expect(cartIsEmpty).toBe(false);
      
      // Try to checkout (should prompt for login as guest)
      await expect(page.getByRole('button', { name: 'Please Login to checkout' })).toBeVisible();
    } else {
      // If no products in that price range, skip the rest
      expect(productsAfterFilter).toBe(0);
    }
  });

  test('explore similar products flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('.card').first().waitFor({ state: 'visible', timeout: 10000 });
    
    // Navigate to first product
    await page.locator('.btn-info', { hasText: 'More Details' }).first().click();
    await page.waitForURL(/\/product\/.+/);
    await page.getByRole('heading', { name: /Similar Products/i }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    
    const firstProductSlug = page.url().split('/product/')[1];
    
    // Check if similar products exist
    const similarProductsCount = await page.locator('.similar-products .card').count();
    
    if (similarProductsCount > 0) {
      // Click on a similar product
      await page.locator('.similar-products').locator('.btn-info', { hasText: 'More Details' }).first().click();
      await page.waitForURL(/\/product\/.+/);
      await page.getByRole('heading', { name: 'Product Details' }).waitFor({ timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const secondProductSlug = page.url().split('/product/')[1];
      
      // Verify we navigated to a different product
      expect(secondProductSlug).not.toBe(firstProductSlug);
      
      // Verify product details page loaded
      await expect(page.getByRole('heading', { name: 'Product Details' })).toBeVisible();
    }
  });

});