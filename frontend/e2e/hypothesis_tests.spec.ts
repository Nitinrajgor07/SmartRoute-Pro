import { test, expect } from '@playwright/test';

test.describe('SmartRoute Pro — Statistical Analytics Hypothesis Tests', () => {
  test('ADMIN can view Hypothesis tests, badges, and toggle Details disclosure', async ({ page }) => {
    // 1. Sign in as Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to /analytics
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' }).first()).toBeVisible();

    // 3. Section titled "Hypothesis tests"
    const sectionHeading = page.getByRole('heading', { name: 'Hypothesis tests' });
    await expect(sectionHeading).toBeVisible();

    // 4. Assert the three cards
    const card1Title = page.locator('text=Average distance').first();
    const card2Title = page.locator('text=Express vs Standard').first();
    const card3Title = page.locator('text=Status and priority').first();

    await expect(card1Title).toBeVisible();
    await expect(card2Title).toBeVisible();
    await expect(card3Title).toBeVisible();

    // 5. Assert a badge in the second and third cards ("Significant" or "Not significant")
    const badge2 = page.locator('text=Express vs Standard').locator('..').locator('text=Significant').or(page.locator('text=Express vs Standard').locator('..').locator('text=Not significant')).first();
    await expect(badge2).toBeVisible();

    const badge3 = page.locator('text=Status and priority').locator('..').locator('text=Significant').or(page.locator('text=Status and priority').locator('..').locator('text=Not significant')).first();
    await expect(badge3).toBeVisible();

    // 6. Assert that the Details area opens
    const detailsSummary = page.locator('summary:has-text("Details")').first();
    await expect(detailsSummary).toBeVisible();
    await detailsSummary.click();

    // Check that technical details appear after opening
    await expect(page.locator('text=Significance level:').first()).toBeVisible();
    await expect(page.locator('text=H0:').first()).toBeVisible();
    await expect(page.locator('text=H1:').first()).toBeVisible();
  });

  test('VIEWER cannot reach the analytics page', async ({ page }) => {
    // 1. Sign in as Viewer
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Attempt to navigate directly to /analytics
    await page.goto('/analytics');

    // 3. Assert page is not reachable (access blocked or redirected)
    await expect(
      page.locator("text=You don't have access to this page").or(page.locator('text=Dashboard')).first()
    ).toBeVisible();
  });
});
