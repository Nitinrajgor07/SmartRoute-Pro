import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe('Revenue and Pricing Flow (ADMIN and DISPATCHER)', () => {
  test.beforeAll(() => {
    // Seed fresh database with deterministically priced deliveries
    const backendDir = path.resolve(process.cwd(), '../backend');
    const pythonPath = path.resolve(process.cwd(), '../../venv/Scripts/python.exe');
    try {
      execSync(`"${pythonPath}" seed.py`, { cwd: backendDir, stdio: 'pipe' });
    } catch (e: any) {
      console.warn('Database seeding before test:', e.message);
    }
  });

  test('Revenue cards show non-zero rupee amounts, all-time matches, Deliveries has Price, and Analytics has revenue bars', async ({ page }) => {
    // -------------------------------------------------------------------------
    // 1. ADMIN FLOW
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Verify Revenue Section Cards on Admin Dashboard
    const adminRevenueSection = page.locator('section:has-text("Revenue")').first();
    await expect(adminRevenueSection).toBeVisible();

    // Check 4 cards: Today, This week, This month, All time
    await expect(adminRevenueSection.locator('text=Today').first()).toBeVisible();
    await expect(adminRevenueSection.locator('text=This week').first()).toBeVisible();
    await expect(adminRevenueSection.locator('text=This month').first()).toBeVisible();
    await expect(adminRevenueSection.locator('text=All time').first()).toBeVisible();

    // Verify "Delivered parcels" hint text is present
    await expect(adminRevenueSection.locator('text=Delivered parcels').first()).toBeVisible();

    // Capture All time text on Admin dashboard
    const adminAllTimeCard = adminRevenueSection.locator('.glass-card:has-text("All time")').first();
    await expect(adminAllTimeCard).toBeVisible();
    const adminAllTimeValue = (await adminAllTimeCard.locator('.text-2xl').textContent())?.trim();
    expect(adminAllTimeValue).toContain('₹');
    expect(adminAllTimeValue).not.toEqual('₹0.00');

    // Check Awaiting delivery line
    await expect(adminRevenueSection.locator('text=Awaiting delivery: ₹').first()).toBeVisible();

    // Check Analytics Page as ADMIN
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' }).first()).toBeVisible();

    // Revenue Section in Analytics
    const adminAnalyticsRev = page.locator('section:has-text("Revenue (Last 30 Days)")').first();
    await expect(adminAnalyticsRev).toBeVisible();
    await expect(adminAnalyticsRev.locator('.recharts-bar-rectangle').first()).toBeVisible();
    await expect(adminAnalyticsRev.locator('text=Urgent').first()).toBeVisible();
    await expect(adminAnalyticsRev.locator('text=Express').first()).toBeVisible();
    await expect(adminAnalyticsRev.locator('text=Standard').first()).toBeVisible();

    // -------------------------------------------------------------------------
    // 2. DISPATCHER FLOW
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Verify Delivered today card
    await expect(page.locator('text=Delivered today').first()).toBeVisible();

    // Verify Revenue Section Cards on Dispatcher Dashboard
    const dispRevenueSection = page.locator('section:has-text("Revenue")').first();
    await expect(dispRevenueSection).toBeVisible();

    await expect(dispRevenueSection.locator('text=Today').first()).toBeVisible();
    await expect(dispRevenueSection.locator('text=This week').first()).toBeVisible();
    await expect(dispRevenueSection.locator('text=This month').first()).toBeVisible();
    await expect(dispRevenueSection.locator('text=All time').first()).toBeVisible();
    await expect(dispRevenueSection.locator('text=Delivered parcels').first()).toBeVisible();
    await expect(dispRevenueSection.locator('text=Awaiting delivery: ₹').first()).toBeVisible();

    // Verify All time matches Admin dashboard
    const dispAllTimeCard = dispRevenueSection.locator('.glass-card:has-text("All time")').first();
    const dispAllTimeValue = (await dispAllTimeCard.locator('.text-2xl').textContent())?.trim();
    expect(dispAllTimeValue).toEqual(adminAllTimeValue);

    // Check Deliveries Page (Price Column)
    await page.goto('/deliveries');
    await expect(page.getByRole('heading', { name: 'Delivery Management' }).first()).toBeVisible();

    // Price column header
    const priceHeader = page.locator('th:has-text("Price")').first();
    await expect(priceHeader).toBeVisible();

    // Price cells rendered with formatted rupee values
    const priceCells = page.locator('td:has-text("₹")');
    await expect(priceCells.first()).toBeVisible();
    const cellCount = await priceCells.count();
    expect(cellCount).toBeGreaterThan(0);

    // Click first delivery to check Detail Modal contains Price
    const firstTrackingBtn = page.locator('table tbody tr td button').first();
    await firstTrackingBtn.click();
    const detailModal = page.locator('text=Consignment Specifications').locator('..');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.locator('text=Price:').first()).toBeVisible();

    // Close detail modal
    await page.locator('button:has-text("Close")').first().click();

    // Check Analytics Page as DISPATCHER
    await page.goto('/analytics');
    const dispAnalyticsRev = page.locator('section:has-text("Revenue (Last 30 Days)")').first();
    await expect(dispAnalyticsRev).toBeVisible();
    await expect(dispAnalyticsRev.locator('.recharts-bar-rectangle').first()).toBeVisible();
    await expect(dispAnalyticsRev.locator('text=Urgent').first()).toBeVisible();
  });
});
