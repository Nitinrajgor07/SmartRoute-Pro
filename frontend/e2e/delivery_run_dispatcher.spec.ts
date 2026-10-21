import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe('DISPATCHER Delivery Run Upgrade Flow', () => {
  test.beforeAll(() => {
    // Seed fresh database in test setup
    const backendDir = path.resolve(process.cwd(), '../backend');
    const pythonPath = path.resolve(process.cwd(), '../../venv/Scripts/python.exe');
    try {
      execSync(`"${pythonPath}" seed.py`, { cwd: backendDir, stdio: 'pipe' });
    } catch (e: any) {
      console.warn('Database seeding before test:', e.message);
    }
  });

  test('Dispatcher picks a zone, plans delivery run with arrival times, edits start time, and dispatches to driver', async ({ page }) => {
    // 1. Sign in as DISPATCHER
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Open Route Planner
    await page.goto('/route-planner');
    await expect(page.getByRole('heading', { name: 'Route Planner' }).first()).toBeVisible();

    // 3. Switch to "Delivery run" tab
    const runTab = page.locator('button:has-text("Delivery run")').first();
    await expect(runTab).toBeVisible();
    await runTab.click();

    // Verify subtitle depends on tab
    await expect(page.locator('text=Plan one driver\'s trip with many stops.').first()).toBeVisible();

    // Verify helper line inside the panel
    await expect(page.locator('text=Tick the parcels for one driver. We find the shortest order.').first()).toBeVisible();

    // 4. Pick a zone from the dropdown
    const zoneSelect = page.locator('#zone-select');
    await expect(zoneSelect).toBeVisible();

    // Select Zone 1 (index 1 after "All zones")
    await zoneSelect.selectOption({ index: 1 });

    // Check that parcels are automatically ticked
    const checkedBoxes = page.locator('input[type="checkbox"]:checked:not(#return-to-depot)');
    await expect(checkedBoxes.first()).toBeVisible();
    const checkedCount = await checkedBoxes.count();
    expect(checkedCount).toBeGreaterThanOrEqual(1);

    // Check that counter reads "N parcels, M stops"
    const counter = page.locator('[data-testid="delivery-run-count"]').first();
    await expect(counter).toBeVisible();
    const counterText = await counter.textContent();
    expect(counterText).toMatch(/\d+ parcels?, \d+ stops?/);

    // 5. Plan the run
    const planRunBtn = page.locator('button:has-text("Plan run")');
    await expect(planRunBtn).toBeEnabled();
    await planRunBtn.click();

    // Verify plan result is shown
    await expect(page.locator('text=Delivery run plan').first()).toBeVisible();
    await expect(page.locator('text=Includes 5 min at each stop.').first()).toBeVisible();

    // Check that Arrive times are shown
    const arriveTimeLocator = page.locator('text=/Arrive \\d{2}:\\d{2}/').first();
    await expect(arriveTimeLocator).toBeVisible();
    const initialArriveText = await arriveTimeLocator.textContent();

    // 6. Change the start time and check the times change
    const startTimeInput = page.locator('[data-testid="run-start-time"]').first();
    await expect(startTimeInput).toBeVisible();

    // Pick a distinctly different start time, e.g., '07:30'
    await startTimeInput.fill('07:30');

    // Wait for the new Arrive time text to reflect 07:xx
    await expect(page.locator('text=/Arrive 07:\\d{2}/').first()).toBeVisible();
    const updatedArriveText = await page.locator('text=/Arrive 07:\\d{2}/').first().textContent();
    expect(updatedArriveText).not.toEqual(initialArriveText);

    // 7. Get the tracking numbers currently ticked in the panel
    const tickedLabels = page.locator('label:has(input[type="checkbox"]:checked:not(#return-to-depot))');
    const trackingNumbersToDispatch: string[] = [];
    const labelCount = await tickedLabels.count();
    for (let i = 0; i < labelCount; i++) {
      const text = await tickedLabels.nth(i).innerText();
      const match = text.match(/DEL-\w+/);
      if (match) trackingNumbersToDispatch.push(match[0]);
    }

    // 8. Dispatch with a driver name
    const dispatchBtn = page.locator('button:has-text("Dispatch run")');
    await expect(dispatchBtn).toBeVisible();
    await expect(dispatchBtn).toBeEnabled();
    await dispatchBtn.click();

    // Verify confirmation dialog
    await expect(page.locator('text=Dispatch this run').first()).toBeVisible();
    await expect(page.locator('text=will change to In Transit.').first()).toBeVisible();

    // Fill driver name and submit
    const driverInput = page.locator('#dispatch-driver-name');
    await expect(driverInput).toBeVisible();
    await driverInput.fill('Elena Rostova');

    const confirmDispatchBtn = page.locator('button:has-text("Confirm Dispatch")');
    await confirmDispatchBtn.click();

    // 9. Verify success state
    // Green label visible: "Dispatched to Elena Rostova"
    const dispatchedLabel = page.locator('[data-testid="dispatched-label"]').first();
    await expect(dispatchedLabel).toBeVisible();
    await expect(dispatchedLabel).toContainText('Dispatched to Elena Rostova');

    // Dispatch button disabled
    await expect(dispatchBtn).toBeDisabled();

    // 10. Check that the dispatched parcels disappear from the pending list
    for (const tracking of trackingNumbersToDispatch) {
      await expect(page.locator(`text=${tracking}`)).toHaveCount(0);
    }
  });
});
