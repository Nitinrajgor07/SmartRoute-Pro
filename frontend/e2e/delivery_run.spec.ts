import { test, expect } from '@playwright/test';

test.describe('SmartRoute Pro — Delivery Run Multi-Stop Route Optimization', () => {
  test('Dispatcher can plan a multi-stop delivery run', async ({ page }) => {
    // 1. Sign in as dispatcher
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Go to /route-planner
    await page.goto('/route-planner');
    await expect(page.getByRole('heading', { name: 'Route Planner' }).first()).toBeVisible();

    // 3. Switch to "Delivery run"
    const runTab = page.locator('button:has-text("Delivery run")').first();
    await expect(runTab).toBeVisible();
    await runTab.click();

    // 4. Verify Delivery Run form components
    await expect(page.locator('label:has-text("Depot")').first()).toBeVisible();
    await expect(page.locator('text=Pending deliveries').first()).toBeVisible();

    // 5. Select a depot (first available option)
    const depotSelect = page.locator('#run-depot-select');
    await expect(depotSelect).toBeVisible();
    await depotSelect.selectOption({ index: 0 });

    // 6. Pick 3 pending deliveries
    const checkboxes = page.locator('input[type="checkbox"]:not(#return-to-depot)');
    await expect(checkboxes.first()).toBeVisible();
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < 3; i++) {
      await checkboxes.nth(i).check();
    }

    // 7. Click "Plan run"
    const planRunBtn = page.locator('button:has-text("Plan run")');
    await expect(planRunBtn).toBeEnabled();
    await planRunBtn.click();

    // 8. Expect total distance, stop chips, comparison table, and map polyline to be visible
    await expect(page.locator('text=Total distance').first()).toBeVisible();
    await expect(page.locator('text=Visit order').first()).toBeVisible();
    await expect(page.locator('text=Comparison').first()).toBeVisible();
    await expect(page.locator('text=Fast method').first()).toBeVisible();
    await expect(page.locator('text=Best possible').first()).toBeVisible();

    // Map polyline rendered by Leaflet (SVG path with stroke #4f46e5)
    const polyline = page.locator('.leaflet-pane path[stroke="#4f46e5"]').first();
    await expect(polyline).toBeVisible();
  });

  test('Login page remains frozen without visual changes', async ({ page }) => {
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

  test('Viewer and Admin cannot open delivery-run feature', async ({ page }) => {
    // 1. Viewer test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Attempt to access /route-planner
    await page.goto('/route-planner');
    await expect(page.locator("text=You don't have access to this page").first()).toBeVisible();

    // 2. Admin test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Admin sees their own dashboard
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.locator('h1:has-text("Dashboard")').first()).toBeVisible();

    // Admin navigating to /route-planner is blocked by permission
    await page.goto('/route-planner');
    await expect(page.locator("text=You don't have access to this page").first()).toBeVisible();
  });
});
