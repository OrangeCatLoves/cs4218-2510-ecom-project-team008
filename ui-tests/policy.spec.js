import { test, expect } from '@playwright/test';

// Configure test settings
test.use({ 
  baseURL: 'http://localhost:3000',
});

test.setTimeout(30000);

test.describe('Policy Page - UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to policy page via footer link', async ({ page }) => {
    // Click on Privacy Policy link in footer
    await page.getByRole('link', { name: 'Privacy Policy' }).click();
    
    // Verify navigation to policy page
    await page.waitForURL('/policy');
    
    // Verify policy page loaded
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should display all policy page elements', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Verify main content area is visible
    await expect(page.getByRole('main')).toBeVisible();
    
    // Verify policy image
    const policyImage = page.getByRole('img', { name: 'contactus' });
    await expect(policyImage).toBeVisible();
    
    // Verify policy text placeholders are displayed
    const policyTexts = page.locator('.col-md-4 p');
    const textCount = await policyTexts.count();
    expect(textCount).toBe(7); // 7 "add privacy policy" texts
    
    // Verify at least one policy text
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
  });

  test('should display policy image with correct attributes', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Get policy image
    const policyImage = page.getByRole('img', { name: 'contactus' });
    await expect(policyImage).toBeVisible();
    
    // Verify image source
    const imageSrc = await policyImage.getAttribute('src');
    expect(imageSrc).toContain('/images/contactus.jpeg');
    
    // Verify image alt text
    const altText = await policyImage.getAttribute('alt');
    expect(altText).toBe('contactus');
    
    // Verify image styling
    const imageStyle = await policyImage.getAttribute('style');
    expect(imageStyle).toContain('width: 100%');
  });

  test('should display all seven policy placeholder texts', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Get all policy text paragraphs
    const policyTexts = page.getByText('add privacy policy');
    
    // Verify exactly 7 instances
    const count = await policyTexts.count();
    expect(count).toBe(7);
    
    // Verify all are visible
    for (let i = 0; i < count; i++) {
      await expect(policyTexts.nth(i)).toBeVisible();
    }
  });

  test('should maintain consistent layout structure', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Verify row structure
    await expect(page.locator('.row.contactus')).toBeVisible();
    
    // Verify two-column layout
    await expect(page.locator('.col-md-6')).toBeVisible(); // Image column
    await expect(page.locator('.col-md-4')).toBeVisible(); // Content column
  });

  test('should handle direct URL navigation to policy page', async ({ page }) => {
    // Navigate directly to policy page URL
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded correctly
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('img', { name: 'contactus' })).toBeVisible();
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
  });

  test('should have proper page title', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Verify page title
    const title = await page.title();
    expect(title).toContain('Privacy Policy');
  });

});

test.describe('Policy Page - Navigation & User Flows', () => {

  test('complete user flow: home > policy > back to home', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to policy page via footer
    await page.getByRole('link', { name: 'Privacy Policy' }).click();
    await page.waitForURL('/policy');
    
    // Verify on policy page
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
    
    // Navigate back to home via header
    await page.getByRole('link', { name: '🛒 Virtual Vault' }).click();
    await page.waitForURL('/');
    
    // Verify back on homepage
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible();
  });

  test('should navigate to policy page and reload successfully', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify page still displays correctly after reload
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('img', { name: 'contactus' })).toBeVisible();
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
  });

  test('navigate between contact and policy pages', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Contact page
    await page.getByRole('link', { name: 'Contact' }).click();
    await page.waitForURL('/contact');
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
    
    // Navigate to Policy page via footer
    await page.getByRole('link', { name: 'Privacy Policy' }).click();
    await page.waitForURL('/policy');
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
    
    // Navigate back to Contact page
    await page.getByRole('link', { name: 'Contact' }).click();
    await page.waitForURL('/contact');
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
  });

  test('access policy page from multiple navigation points', async ({ page }) => {
    // Test 1: Access from homepage footer
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Privacy Policy' }).click();
    await page.waitForURL('/policy');
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
    
    // Test 2: Access from contact page footer
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Privacy Policy' }).click();
    await page.waitForURL('/policy');
    await expect(page.getByText('add privacy policy').first()).toBeVisible();
  });

});

test.describe('Policy Page - Layout Consistency', () => {

  test('should use same layout structure as contact page', async ({ page }) => {
    // Navigate to policy page
    await page.goto('/policy');
    await page.waitForLoadState('networkidle');
    
    // Verify same layout classes as contact page
    await expect(page.locator('.row.contactus')).toBeVisible();
    await expect(page.locator('.col-md-6')).toBeVisible();
    await expect(page.locator('.col-md-4')).toBeVisible();
    
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify same layout structure
    await expect(page.locator('.row.contactus')).toBeVisible();
    await expect(page.locator('.col-md-6')).toBeVisible();
    await expect(page.locator('.col-md-4')).toBeVisible();
  });
});