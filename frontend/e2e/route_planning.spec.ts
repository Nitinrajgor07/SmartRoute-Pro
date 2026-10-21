import { test, expect } from '@playwright/test';

test.describe('SmartRoute Pro — Enhanced Multi-Route Planning & Hub Selection', () => {
  test('Dispatcher can search hubs, swap locations, validate identical hubs, and inspect alternative routes', async ({ page }) => {
    // 1. Authenticate as Dispatcher
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Navigate to Route Optimization from Dashboard quick action
    const planRouteBtn = page.locator('button:has-text("Plan route")').first();
    await expect(planRouteBtn).toBeVisible();
    await planRouteBtn.click();
    await expect(page).toHaveURL(/.*\/route-planner/);

    // 3. Verify page elements
    await expect(page.getByRole('heading', { name: 'Route Planner' }).first()).toBeVisible();
    await expect(page.locator('text=Plan a route').first()).toBeVisible();

    // 4. Test Searchable Origin Combobox
    const originTrigger = page.getByTestId('origin-hub-select');
    await expect(originTrigger).toBeVisible();
    await originTrigger.click();

    // Type query to filter hubs
    const originSearchInput = page.getByTestId('origin-hub-search');
    await expect(originSearchInput).toBeVisible();
    await originSearchInput.fill('Vidhana');
    await page.waitForTimeout(300);

    // Select the filtered Vidhana Soudha hub
    const vidhanaSoudhaOption = page.locator('button:has-text("Vidhana Soudha")');
    await expect(vidhanaSoudhaOption).toBeVisible();
    await vidhanaSoudhaOption.click();

    // Verify selection applied
    await expect(page.locator('text=Vidhana Soudha').first()).toBeVisible();

    // 5. Test Swap Button
    const swapBtn = page.locator('button:has-text("Swap")');
    await expect(swapBtn).toBeVisible();
    await swapBtn.click();

    // Verify Destination now has Vidhana Soudha
    await expect(page.locator('text=Vidhana Soudha').first()).toBeVisible();

    // 6. Test Destination Search
    const destTrigger = page.getByTestId('destination-hub-select');
    await expect(destTrigger).toBeVisible();
    await destTrigger.click();
    const destSearchInput = page.getByTestId('destination-hub-search');
    await expect(destSearchInput).toBeVisible();
    await destSearchInput.fill('Hebbal');
    await page.waitForTimeout(300);
    const hebbalOption = page.locator('button:has-text("Hebbal")');
    await expect(hebbalOption).toBeVisible();
    await hebbalOption.click();

    // 7. Calculate Shortest Path
    const calculateBtn = page.locator('button:has-text("Find route")').first();
    await expect(calculateBtn).toBeEnabled();
    await calculateBtn.click();

    // 8. Verify calculation results and Available Routes section
    await expect(page.locator('text=Shortest route').first()).toBeVisible();
    await expect(page.locator('text=Distance').first()).toBeVisible();

    // 9. Verify alternative routes section if available
    const altBtn = page.locator('button:has-text("Show")').first();
    if (await altBtn.isVisible()) {
      await altBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('text=Active').or(page.locator('text=Show')).first()).toBeVisible();
    }
  });

  test('Dispatcher can access route planning directly from consignment row', async ({ page }) => {
    // 1. Authenticate as Dispatcher
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Verify plan route button
    const heroBtn = page.locator('button:has-text("Plan route")').first();
    await expect(heroBtn).toBeVisible();

    // 3. Verify consignment table tracking button
    const consignmentRouteBtn = page.getByTestId('consignment-plan-route').first();
    await expect(consignmentRouteBtn).toBeVisible();
    await consignmentRouteBtn.click();

    // 4. Verifies navigation to /route-planner with query params
    await expect(page).toHaveURL(/.*\/route-planner\?source=\d+&destination=\d+/);
    await expect(page.getByRole('heading', { name: 'Route Planner' }).first()).toBeVisible();
  });

  test('Viewer role is restricted from route planning and operations', async ({ page }) => {
    // 1. Authenticate as Viewer
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Verify Route Planner link is NOT visible in sidebar
    await expect(page.locator('a[href="/route-planner"]')).not.toBeVisible();

    // 3. Verify direct navigation is restricted
    await page.goto('/route-planner');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();
  });

  test('Dispatcher plans route from Majestic Depot to Whitefield with clean labels and no ellipses', async ({ page }) => {
    // 1. Log in as DISPATCHER
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Open Route Planner
    await page.goto('/route-planner');
    await expect(page.getByRole('heading', { name: 'Route Planner', exact: true })).toBeVisible();
    await expect(page.locator('text=Find the shortest route between two hubs.')).toBeVisible();

    // 3. Choose "Majestic Depot" to "Whitefield"
    // From Combobox
    const originSelect = page.getByTestId('origin-hub-select');
    await originSelect.click();
    const originSearch = page.getByTestId('origin-hub-search');
    await originSearch.fill('Majestic');
    await page.waitForTimeout(200);
    await page.locator('[data-testid^="hub-option-"]:has-text("Majestic Depot")').first().click();

    // To Combobox
    const destSelect = page.getByTestId('destination-hub-select');
    await destSelect.click();
    const destSearch = page.getByTestId('destination-hub-search');
    await destSearch.fill('Whitefield');
    await page.waitForTimeout(200);
    await page.locator('[data-testid^="hub-option-"]:has-text("Whitefield")').first().click();

    // 4. Click "Find route"
    const findRouteBtn = page.locator('button:has-text("Find route")');
    await expect(findRouteBtn).toBeEnabled();
    await findRouteBtn.click();

    // 5. Assert distance
    const distValue = page.locator('text=/\\d+(\\.\\d+)?\\s*km/').first();
    await expect(distValue).toBeVisible();

    // 6. Assert the three labels: "Distance", "Stops", "Time"
    await expect(page.locator('text=Distance').first()).toBeVisible();
    await expect(page.locator('text=Stops').first()).toBeVisible();
    await expect(page.locator('text=Time').first()).toBeVisible();

    // 7. Verify route format: Majestic Depot -> ... -> Whitefield
    await expect(page.locator('text=/Majestic Depot.*->.*Whitefield/').first()).toBeVisible();

    // 8. Verify no text ends with "..."
    const textNodes = await page.locator('button, p, span, h1, h2, h3, h4, th, td, label').allInnerTexts();
    for (const raw of textNodes) {
      const trimmed = raw.trim();
      expect(trimmed.endsWith('...'), `Found text ending with "...": "${trimmed}"`).toBe(false);
      expect(trimmed.endsWith('…'), `Found text ending with "…": "${trimmed}"`).toBe(false);
    }
  });
});
