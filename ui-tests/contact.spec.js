import { test, expect } from '@playwright/test';

// Configure test settings
test.use({ 
  baseURL: 'http://localhost:3000',
});

test.setTimeout(30000);

test.describe('Contact Page - UI Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to contact page via footer link', async ({ page }) => {
    // Click on Contact link in footer
    await page.getByRole('link', { name: 'Contact' }).click();
    
    // Verify navigation to contact page
    await page.waitForURL('/contact');
    
    // Verify contact heading is visible
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
  });

  test('should display all contact page elements', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify heading
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
    
    // Verify contact image
    const contactImage = page.getByRole('img', { name: 'contactus' });
    await expect(contactImage).toBeVisible();
    
    // Verify introductory text
    await expect(page.getByText('For any query or info about product')).toBeVisible();
    await expect(page.getByText('available 24X7')).toBeVisible();
    
    // Verify all contact methods are displayed
    await expect(page.getByText('📧 Email: www.help@ecommerceapp.com')).toBeVisible();
    await expect(page.getByText('📞 Phone: 012-3456789')).toBeVisible();
    await expect(page.getByText('💬 Support: 1800-0000-0000 (toll free)')).toBeVisible();
  });

  test('should display contact information with correct formatting', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify email format
    const emailText = await page.getByText('📧 Email:').textContent();
    expect(emailText).toContain('www.help@ecommerceapp.com');
    
    // Verify phone format
    const phoneText = await page.getByText('📞 Phone:').textContent();
    expect(phoneText).toContain('012-3456789');
    
    // Verify support format
    const supportText = await page.getByText('💬 Support:').textContent();
    expect(supportText).toContain('1800-0000-0000');
    expect(supportText).toContain('toll free');
  });

  test('should display contact image with correct attributes', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Get contact image
    const contactImage = page.getByRole('img', { name: 'contactus' });
    await expect(contactImage).toBeVisible();
    
    // Verify image source
    const imageSrc = await contactImage.getAttribute('src');
    expect(imageSrc).toContain('/images/contactus.jpeg');
    
    // Verify image alt text
    const altText = await contactImage.getAttribute('alt');
    expect(altText).toBe('contactus');
    
    // Verify image styling
    const imageStyle = await contactImage.getAttribute('style');
    expect(imageStyle).toContain('width: 100%');
  });

  test('should maintain consistent layout structure', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify row structure
    await expect(page.locator('.row.contactus')).toBeVisible();
    
    // Verify two-column layout
    await expect(page.locator('.col-md-6')).toBeVisible(); // Image column
    await expect(page.locator('.col-md-4')).toBeVisible(); // Content column
  });

  test('should display heading with correct styling', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Get heading element
    const heading = page.getByRole('heading', { name: 'CONTACT US' });
    await expect(heading).toBeVisible();
    
    // Verify heading classes
    const headingClasses = await heading.getAttribute('class');
    expect(headingClasses).toContain('bg-dark');
    expect(headingClasses).toContain('text-white');
    expect(headingClasses).toContain('text-center');
  });

  test('should handle direct URL navigation to contact page', async ({ page }) => {
    // Navigate directly to contact page URL
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded correctly
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'contactus' })).toBeVisible();
  });

  test('should display all contact methods with proper icons', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify email with icon
    const emailElement = page.getByText('📧 Email:');
    await expect(emailElement).toBeVisible();
    const emailText = await emailElement.textContent();
    expect(emailText).toMatch(/📧/);
    
    // Verify phone with icon
    const phoneElement = page.getByText('📞 Phone:');
    await expect(phoneElement).toBeVisible();
    const phoneText = await phoneElement.textContent();
    expect(phoneText).toMatch(/📞/);
    
    // Verify support with icon
    const supportElement = page.getByText('💬 Support:');
    await expect(supportElement).toBeVisible();
    const supportText = await supportElement.textContent();
    expect(supportText).toMatch(/💬/);
  });

});

test.describe('Contact Page - Navigation & User Flows', () => {

  test('complete user flow: home > contact > back to home', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to contact page via footer
    await page.getByRole('link', { name: 'Contact' }).click();
    await page.waitForURL('/contact');
    
    // Verify on contact page
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
    
    // Navigate back to home
    await page.getByRole('link', { name: '🛒 Virtual Vault' }).click();
    await page.waitForURL('/');
    
    // Verify back on homepage
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible();
  });

  test('should navigate to contact page and reload successfully', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify page loaded
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify page still displays correctly after reload
    await expect(page.getByRole('heading', { name: 'CONTACT US' })).toBeVisible();
    await expect(page.getByText('📧 Email:')).toBeVisible();
    await expect(page.getByRole('img', { name: 'contactus' })).toBeVisible();
  });

});

test.describe('Contact Page - Accessibility & Content', () => {

  test('should have proper page title', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify page title
    const title = await page.title();
    expect(title).toContain('Contact us');
  });

  test('should display complete availability information', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Verify 24X7 availability message
    const availabilityText = page.getByText('available 24X7');
    await expect(availabilityText).toBeVisible();
  });

  test('should display all contact information in correct order', async ({ page }) => {
    // Navigate to contact page
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    // Get all paragraph elements in order
    const paragraphs = page.locator('.col-md-4 p');
    
    // Verify at least 4 paragraphs (intro + 3 contact methods)
    const count = await paragraphs.count();
    expect(count).toBeGreaterThanOrEqual(4);
    
    // Verify intro text is first
    const firstParagraph = paragraphs.first();
    await expect(firstParagraph).toContainText('For any query or info about product');
    
    // Verify contact methods follow
    await expect(paragraphs.nth(1)).toContainText('Email:');
    await expect(paragraphs.nth(2)).toContainText('Phone:');
    await expect(paragraphs.nth(3)).toContainText('Support:');
  });

});