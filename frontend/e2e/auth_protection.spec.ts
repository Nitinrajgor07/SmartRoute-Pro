import { test, expect } from '@playwright/test';

test.describe('Auth Protection & Visual Regression Tests', () => {
  test('Visual regression test for /login at 1366x768', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Freeze any SVG animations for pixel stability
    await page.evaluate(() => {
      document.querySelectorAll('svg').forEach((svg) => {
        try {
          if (typeof svg.pauseAnimations === 'function') {
            svg.pauseAnimations();
          }
        } catch (e) {}
      });
    });

    await expect(page).toHaveScreenshot('login-1366x768.png', {
      animations: 'disabled',
    });
  });

  test('Visual regression test for /login at 390x844 (mobile)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Freeze any SVG animations for pixel stability
    await page.evaluate(() => {
      document.querySelectorAll('svg').forEach((svg) => {
        try {
          if (typeof svg.pauseAnimations === 'function') {
            svg.pauseAnimations();
          }
        } catch (e) {}
      });
    });

    await expect(page).toHaveScreenshot('login-390x844.png', {
      animations: 'disabled',
    });
  });

  test('Register page navigation, form heading, empty inputs, and autocomplete attributes', async ({ page }) => {
    await page.goto('/login');
    
    // Click "Register" link at the bottom of login
    const registerLink = page.getByRole('link', { name: 'Register' });
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    // Expect /register and heading "Register"
    await expect(page).toHaveURL(/.*\/register/);
    await expect(page.getByRole('heading', { name: 'Register', exact: true })).toBeVisible();

    // Assert email and password fields are empty
    const emailInput = page.locator('#register-email');
    const passwordInput = page.locator('#register-password');
    const confirmPasswordInput = page.locator('#register-confirm-password');

    await expect(emailInput).toHaveValue('');
    await expect(passwordInput).toHaveValue('');
    await expect(confirmPasswordInput).toHaveValue('');

    // Assert autocomplete attributes
    await expect(emailInput).toHaveAttribute('autocomplete', 'off');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    await expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password');

    // Assert "Already have an account? Sign in" link works
    const signInLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Redirects /signup and /sign-up routes to /register', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/.*\/register/);

    await page.goto('/sign-up');
    await expect(page).toHaveURL(/.*\/register/);
  });

  test('Register page shows two account type cards with Viewer selected by default', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Both account type cards should be visible
    const viewerCard = page.locator('[data-testid="account-type-viewer"]');
    const dispatcherCard = page.locator('[data-testid="account-type-dispatcher"]');

    await expect(viewerCard).toBeVisible();
    await expect(dispatcherCard).toBeVisible();

    // Viewer should be selected by default (aria-checked=true)
    await expect(viewerCard).toHaveAttribute('aria-checked', 'true');
    await expect(dispatcherCard).toHaveAttribute('aria-checked', 'false');

    // Check card content
    await expect(viewerCard).toContainText('Viewer');
    await expect(viewerCard).toContainText('Track your parcels.');
    await expect(dispatcherCard).toContainText('Dispatcher');
    await expect(dispatcherCard).toContainText('Manage deliveries and routes.');

    // Check the admin approval notice
    await expect(page.locator('text=An admin must approve your account before you can sign in.')).toBeVisible();
  });

  test('Choosing Dispatcher sends account_type=DISPATCHER and shows success view', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Click the Dispatcher card
    const dispatcherCard = page.locator('[data-testid="account-type-dispatcher"]');
    await dispatcherCard.click();
    await expect(dispatcherCard).toHaveAttribute('aria-checked', 'true');

    // Fill in registration form
    const uniqueEmail = `test-dispatcher-${Date.now()}@smartroute.pro`;
    await page.fill('#register-name', 'Test Dispatcher');
    await page.fill('#register-email', uniqueEmail);
    await page.fill('#register-password', 'TestPass123');
    await page.fill('#register-confirm-password', 'TestPass123');

    // Intercept the register API call to verify account_type
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/auth/register') && req.method() === 'POST'),
      page.click('button[type="submit"]'),
    ]);

    const postData = request.postDataJSON();
    expect(postData.account_type).toBe('DISPATCHER');

    // Wait for the success view
    await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=You can sign in after an admin approves your account.')).toBeVisible();

    // "Back to Sign in" button should link to login
    const backBtn = page.getByRole('link', { name: 'Back to Sign in' });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Choosing Viewer sends account_type=VIEWER', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    // Viewer is selected by default, so just fill in the form
    const uniqueEmail = `test-viewer-${Date.now()}@smartroute.pro`;
    await page.fill('#register-name', 'Test Viewer');
    await page.fill('#register-email', uniqueEmail);
    await page.fill('#register-password', 'TestPass123');
    await page.fill('#register-confirm-password', 'TestPass123');

    // Intercept the register API call to verify account_type
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/auth/register') && req.method() === 'POST'),
      page.click('button[type="submit"]'),
    ]);

    const postData = request.postDataJSON();
    expect(postData.account_type).toBe('VIEWER');

    // Wait for the success view
    await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible({ timeout: 10000 });
  });

  test('open /login, click "Register", expect /register with heading and two account type cards, then click "Sign in" back to /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Register' }).click();

    await expect(page).toHaveURL(/.*\/register/);
    await expect(page.getByRole('heading', { name: 'Register', exact: true })).toBeVisible();

    const viewerCard = page.locator('[data-testid="account-type-viewer"]');
    const dispatcherCard = page.locator('[data-testid="account-type-dispatcher"]');

    await expect(viewerCard).toBeVisible();
    await expect(dispatcherCard).toBeVisible();

    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/.*\/login/);
  });
});
