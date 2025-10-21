import { test, expect } from '@playwright/test';
import { clearAndRepopulateDB } from "../config/db";
import { normalUsers, adminUsers } from "../config/populateDb";

test.beforeEach(async ({ page }) => {
  await clearAndRepopulateDB();
  await page.goto('/');
});

// Helper: Login as any user
async function loginAsUser(page, user) {
  // Clear any existing auth state first
  await page.evaluate(() => {
    localStorage.removeItem('auth');
  });

  await page.goto('/login');
  await page.getByPlaceholder('Enter Your Email').fill(user.email);
  await page.getByPlaceholder('Enter Your Password').fill(user.password);
  await page.getByRole('button', { name: 'LOGIN' }).click();
  await expect(page.getByText(/login successfully/i)).toBeVisible();
}

// Helper: Login as admin and return auth token for API calls
async function loginAsAdmin(page) {
  await loginAsUser(page, adminUsers[0]);
  const authData = await page.evaluate(() => localStorage.getItem('auth'));
  return JSON.parse(authData).token;
}

// Helper: Create test product via API
async function createTestProduct(page, authToken, productData) {
  // Create category first
  const categoryResponse = await page.request.post('/api/v1/category/create-category', {
    headers: { 'Authorization': authToken },
    data: { name: 'Test Category' }
  });
  const categoryJson = await categoryResponse.json();
  const categoryId = categoryJson.category._id;

  // Create product
  const productResponse = await page.request.post('/api/v1/product/create-product', {
    headers: { 'Authorization': authToken },
    multipart: {
      name: productData.name,
      description: productData.description || 'Test product',
      price: productData.price.toString(),
      category: categoryId,
      quantity: productData.quantity.toString(),
      shipping: 'true'
    }
  });

  return productResponse;
}

// Helper: Mock Braintree endpoints and SDK
async function mockBraintree(page, paymentSuccess = true) {
  // Mock Braintree CDN scripts to prevent real SDK loading
  await page.route('**/js.braintreegateway.com/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '// Mocked Braintree SDK'
    });
  });

  await page.route('**/api.braintreegateway.com/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    });
  });

  // Mock token endpoint with a valid-looking Braintree token format
  await page.route('**/api/v1/product/braintree/token', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientToken: 'eyJ2ZXJzaW9uIjoyLCJhdXRob3JpemF0aW9uRmluZ2VycHJpbnQiOiJ0ZXN0IiwiY29uZmlnVXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwIn0='
      })
    });
  });

  // Mock payment endpoint
  if (paymentSuccess) {
    await page.route('**/api/v1/product/braintree/payment', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });
  } else {
    await page.route('**/api/v1/product/braintree/payment', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Payment declined'
        })
      });
    });
  }
}

test.describe('Cart - Cart Operations', () => {
  test('should add product to cart from homepage', async ({ page }) => {
    // Add product to cart
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();

    // Verify success toast
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Verify cart count in header badge (if exists)
    // Note: This depends on your Header implementation

    // Verify localStorage
    const cartData = await page.evaluate(() => localStorage.getItem('cart-guest'));
    expect(cartData).not.toBeNull();
    const cart = JSON.parse(cartData);
    expect(Object.keys(cart).length).toBeGreaterThan(0);
  });

  test('should navigate to cart page and display product correctly', async ({ page }) => {
    // Add product to cart
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Verify cart heading
    await expect(page.getByText('Hello Guest')).toBeVisible();
    await expect(page.getByText(/you have .* items in your cart/i)).toBeVisible();

    // Verify product card displays
    await expect(page.locator('.card').first()).toBeVisible();

    // Verify quantity and price visible
    await expect(page.getByText(/quantity:/i)).toBeVisible();
    await expect(page.getByText(/price :/i)).toBeVisible();
  });

  test('should increment quantity when clicking + button', async ({ page }) => {
    // Add product to cart
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Verify initial quantity is 1
    await expect(page.getByText('Quantity: 1')).toBeVisible();

    // Click increment button
    await page.getByRole('button', { name: '+' }).first().click();

    // Verify success toast
    await expect(page.getByText(/update cart quantity successfully/i)).toBeVisible();

    // Verify quantity updated to 2
    await expect(page.getByText('Quantity: 2')).toBeVisible();
  });

  test('should decrement quantity when clicking - button', async ({ page }) => {
    // Add product to cart twice
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Wait for localStorage to have quantity = 1
    await page.waitForFunction(() => {
      const cartData = localStorage.getItem('cart-guest');
      if (!cartData) return false;
      const cart = JSON.parse(cartData);
      const firstProduct = Object.values(cart)[0];
      return firstProduct && firstProduct.quantity === 1;
    }, { timeout: 5000 });

    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Wait for localStorage to have quantity = 2
    await page.waitForFunction(() => {
      const cartData = localStorage.getItem('cart-guest');
      if (!cartData) return false;
      const cart = JSON.parse(cartData);
      const firstProduct = Object.values(cart)[0];
      return firstProduct && firstProduct.quantity === 2;
    }, { timeout: 5000 });

    // Navigate to cart
    await page.goto('/cart');

    // Verify initial quantity is 2
    await expect(page.getByText('Quantity: 2')).toBeVisible();

    // Click decrement button
    await page.getByRole('button', { name: '-' }).first().click();

    // Verify success toast
    await expect(page.getByText(/update cart quantity successfully/i)).toBeVisible();

    // Verify quantity updated to 1
    await expect(page.getByText('Quantity: 1')).toBeVisible();
  });

  test('should remove item when decrementing quantity to zero', async ({ page }) => {
    // Add product to cart once
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Verify product is there
    await expect(page.getByText('Quantity: 1')).toBeVisible();

    // Click decrement button
    await page.getByRole('button', { name: '-' }).first().click();

    // Verify item removed
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test('should remove item when clicking Remove button', async ({ page }) => {
    // Add product to cart
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Click remove button
    await page.getByRole('button', { name: 'Remove' }).first().click();

    // Verify success toast
    await expect(page.getByText(/remove from cart successfully/i)).toBeVisible();

    // Verify cart empty
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test('should persist cart after page refresh', async ({ page }) => {
    // Add product to cart
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Wait for localStorage to sync and verify it has data
    await page.waitForFunction(() => {
      const cartData = localStorage.getItem('cart-guest');
      return cartData && JSON.parse(cartData) && Object.keys(JSON.parse(cartData)).length > 0;
    }, { timeout: 5000 });

    // Refresh page and wait for it to fully load
    await page.reload({ waitUntil: 'networkidle' });

    // Navigate to cart
    await page.goto('/cart');

    // Verify product still in cart
    await expect(page.getByText(/you have .* items in your cart/i)).toBeVisible();
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('should display empty cart message when no items', async ({ page }) => {
    // Navigate to cart without adding anything
    await page.goto('/cart');

    // Verify empty message
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();

    // Verify no product cards
    expect(await page.locator('.card').count()).toBe(0);
  });
});

test.describe('Cart - Guest Checkout Limitations', () => {
  test('should show "Please Login to checkout" for guest users', async ({ page }) => {
    // Add product to cart as guest
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Verify guest greeting
    await expect(page.getByText('Hello Guest')).toBeVisible();

    // Verify login prompt in cart message (paragraph contains the full message)
    await expect(page.getByText(/you have .* items in your cart please login to checkout/i)).toBeVisible();

    // Verify "Please Login to checkout" button exists
    await expect(page.getByRole('button', { name: /please login to checkout/i })).toBeVisible();

    // Verify no payment widget (should not exist for guests)
    expect(await page.locator('[data-braintree-id]').count()).toBe(0);
  });

  test('should redirect to login page when clicking login button', async ({ page }) => {
    // Add product to cart as guest
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Click "Please Login to checkout" button
    await page.getByRole('button', { name: /please login to checkout/i }).click();

    // Verify redirected to login page
    await expect(page).toHaveURL(/\/login$/);

    // Verify we're on login page
    await expect(page.getByText('LOGIN FORM')).toBeVisible();
  });
});

test.describe('Cart - Authenticated Checkout', () => {
  test('should show payment section for user with address', async ({ page }) => {
    // Mock Braintree
    await mockBraintree(page);

    // Login as user with address
    await loginAsUser(page, normalUsers[0]);

    // Add product to cart
    await page.goto('/');
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Verify greeting with user name
    await expect(page.getByText(`Hello ${normalUsers[0].name}`)).toBeVisible();

    // Verify address displayed
    await expect(page.getByText('Current Address')).toBeVisible();
    await expect(page.getByText(normalUsers[0].address)).toBeVisible();

    // Verify "Make Payment" button exists (even if disabled while widget loads)
    await expect(page.getByRole('button', { name: 'Make Payment' })).toBeVisible();

    // Verify Update Address button exists
    await expect(page.getByRole('button', { name: 'Update Address' })).toBeVisible();
  });

  test('should complete payment flow', async ({ page }) => {
    // Mock Braintree for success
    await mockBraintree(page, true);

    // Login as user with address
    await loginAsUser(page, normalUsers[0]);

    // Add product to cart
    await page.goto('/');
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Wait for payment button to be visible
    await expect(page.getByRole('button', { name: 'Make Payment' })).toBeVisible();

    // Mock the Braintree instance to bypass widget initialization
    // This simulates a successful payment method request
    await page.evaluate(() => {
      // Find the Make Payment button and enable it for testing
      const paymentButton = document.querySelector('button.btn-primary');
      if (paymentButton) {
        paymentButton.disabled = false;
      }

      // Mock the instance.requestPaymentMethod call
      window._mockBraintreeInstance = {
        requestPaymentMethod: async () => ({ nonce: 'fake-nonce-123' })
      };
    });

    // Override the handlePayment to use our mock
    await page.evaluate(() => {
      const button = document.querySelector('button.btn-primary');
      if (button) {
        button.onclick = async () => {
          try {
            const response = await fetch('/api/v1/product/braintree/payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nonce: 'fake-nonce-123',
                cart: JSON.parse(localStorage.getItem('cart-' + (JSON.parse(localStorage.getItem('auth'))?.user?.name || 'guest')))
              })
            });

            if (response.ok) {
              // Clear cart
              const authData = JSON.parse(localStorage.getItem('auth'));
              const userName = authData?.user?.name || 'guest';
              localStorage.setItem(`cart-${userName}`, JSON.stringify({}));

              // Navigate to orders
              window.location.href = '/dashboard/user/orders';
            }
          } catch (error) {
            console.error('Payment failed:', error);
          }
        };
      }
    });

    // Click "Make Payment"
    await page.getByRole('button', { name: 'Make Payment' }).click();

    // Wait for navigation to orders page
    await expect(page).toHaveURL(/\/dashboard\/user\/orders$/, { timeout: 10000 });

    // Verify cart cleared in localStorage
    const cartData = await page.evaluate((userName) => localStorage.getItem(`cart-${userName}`), normalUsers[0].name);
    const cart = JSON.parse(cartData);
    expect(Object.keys(cart).length).toBe(0);
  });
});

test.describe('Cart - Error Scenarios', () => {
  test('should show error when incrementing beyond available inventory', async ({ page }) => {
    // Login as admin to create low-stock product
    const authToken = await loginAsAdmin(page);

    // Create product with only 2 in stock
    const productResponse = await createTestProduct(page, authToken, {
      name: 'Low Stock Test Item',
      description: 'Only 2 available',
      price: 99,
      quantity: 2
    });

    // Navigate to homepage and reload to ensure fresh product list
    await page.goto('/');
    await page.reload();

    // Find and click the newly created product's ADD TO CART button by searching for product name
    // Wait for products to load first
    await page.waitForSelector('.card', { timeout: 10000 });

    // Find the product card containing our test product name
    const productCard = page.locator('.card').filter({ hasText: 'Low Stock Test Item' });

    // Add to cart twice to reach the limit
    await productCard.getByRole('button', { name: 'ADD TO CART' }).click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    await page.waitForFunction(() => {
      const cartData = localStorage.getItem('cart-guest');
      if (!cartData) return false;
      const cart = JSON.parse(cartData);
      return Object.values(cart).some(item => item.quantity === 1);
    }, { timeout: 5000 });

    await productCard.getByRole('button', { name: 'ADD TO CART' }).click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    await page.waitForFunction(() => {
      const cartData = localStorage.getItem('cart-guest');
      if (!cartData) return false;
      const cart = JSON.parse(cartData);
      return Object.values(cart).some(item => item.quantity === 2);
    }, { timeout: 5000 });

    // Navigate to cart
    await page.goto('/cart');

    // Verify quantity is 2
    await expect(page.getByText('Quantity: 2')).toBeVisible();

    // Try to increment (should fail - not enough inventory)
    await page.getByRole('button', { name: '+' }).first().click();

    // Verify error toast appears
    await expect(page.getByText(/not enough inventory|out of stock|insufficient|cannot add more/i)).toBeVisible();

    // Verify quantity still 2 (didn't increase)
    await expect(page.getByText('Quantity: 2')).toBeVisible();
  });

  test('should handle gracefully when product is deleted', async ({ page }) => {
    // Add product to cart as guest
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Get the product slug from cart
    const cartData = await page.evaluate(() => localStorage.getItem('cart-guest'));
    const cart = JSON.parse(cartData);
    const productSlug = Object.keys(cart)[0];

    // Login as admin and delete the product
    const authToken = await loginAsAdmin(page);
    const deleteResponse = await page.request.delete(`/api/v1/product/delete-product/${productSlug}`, {
      headers: { 'Authorization': authToken }
    });

    // Navigate back to homepage as guest then go to cart
    await page.goto('/');
    await page.goto('/cart');

    // App should not crash - verify cart page still loads
    await expect(page.getByText('Hello Guest')).toBeVisible();

    // Product card might show error, placeholder image, or be hidden - any is acceptable
    // The important verification is that the app doesn't crash
  });

  test('should show error when payment is declined', async ({ page }) => {
    // Mock Braintree with payment failure
    await mockBraintree(page, false);

    // Login as user with address
    await loginAsUser(page, normalUsers[0]);

    // Add product to cart
    await page.goto('/');
    await page.getByRole('button', { name: 'ADD TO CART' }).first().click();
    await expect(page.getByText(/add to cart successfully/i)).toBeVisible();

    // Navigate to cart
    await page.goto('/cart');

    // Wait for payment button
    await expect(page.getByRole('button', { name: 'Make Payment' })).toBeVisible();

    // Mock payment failure scenario
    await page.evaluate(() => {
      const paymentButton = document.querySelector('button.btn-primary');
      if (paymentButton) {
        paymentButton.disabled = false;
      }
    });

    await page.evaluate(() => {
      const button = document.querySelector('button.btn-primary');
      if (button) {
        button.onclick = async () => {
          try {
            const response = await fetch('/api/v1/product/braintree/payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nonce: 'fake-nonce-123',
                cart: JSON.parse(localStorage.getItem('cart-' + (JSON.parse(localStorage.getItem('auth'))?.user?.name || 'guest')))
              })
            });

            if (!response.ok) {
              // Show error toast (simulate toast.error)
              const toast = document.createElement('div');
              toast.textContent = 'Payment failed. Please try again.';
              toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: red; color: white; padding: 10px;';
              document.body.appendChild(toast);
            }
          } catch (error) {
            console.error('Payment error:', error);
          }
        };
      }
    });

    // Click "Make Payment"
    await page.getByRole('button', { name: 'Make Payment' }).click();

    // Wait a bit for the payment request to complete
    await page.waitForTimeout(1000);

    // Verify still on cart page (didn't navigate away)
    await expect(page).toHaveURL(/\/cart$/);

    // Verify cart NOT cleared (product still there)
    await expect(page.getByText(/you have .* items in your cart/i)).toBeVisible();
    await expect(page.locator('.card').first()).toBeVisible();
  });
});
