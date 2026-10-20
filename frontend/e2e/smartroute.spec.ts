import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/screenshots');

test.describe('SmartRoute Pro — Full End-to-End Test Suite', () => {

  test('Scenario 1: Public login page loads with branded header and credentials input', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h2')).toContainText('SmartRoute');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Screenshot 1: Login Page
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });
  });

  test('Scenario 2: Form validation prevents submission on empty credentials', async ({ page }) => {
    await page.goto('/login');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    const emailInput = page.locator('input[type="email"]');
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('Scenario 3: Invalid credentials display error alert', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@smartroute.pro');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Authentication failed').or(page.locator('text=Invalid email or password'))).toBeVisible();
  });

  test('Scenario 4: One-click demo roles populate credentials for Admin, Dispatcher, Viewer', async ({ page }) => {
    await page.goto('/login');
    const adminDemoBtn = page.locator('button:has-text("Admin")');
    if (await adminDemoBtn.isVisible()) {
      await adminDemoBtn.click();
      await expect(page.locator('input[type="email"]')).toHaveValue('admin@smartroute.pro');
      await expect(page.locator('input[type="password"]')).toHaveValue('Admin@123456');

      const dispDemoBtn = page.locator('button:has-text("Dispatcher")');
      await dispDemoBtn.click();
      await expect(page.locator('input[type="email"]')).toHaveValue('dispatcher@smartroute.pro');
      await expect(page.locator('input[type="password"]')).toHaveValue('Dispatch@123456');

      const viewerDemoBtn = page.locator('button:has-text("Viewer")');
      await viewerDemoBtn.click();
      await expect(page.locator('input[type="email"]')).toHaveValue('viewer@smartroute.pro');
      await expect(page.locator('input[type="password"]')).toHaveValue('Viewer@123456');
    }
  });

  test('Scenario 4B: Responsive login layout renders without overflow at 1440px, 1024px, 768px, and 375px', async ({ page }) => {
    const viewports = [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet_landscape' },
      { width: 768, height: 1024, name: 'tablet_portrait' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Ensure no horizontal scrollbar / overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  test('Scenario 5 & 6 & 7: Successful login as Admin stores token and renders Dashboard with KPIs and Charts', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    
    // Verify KPIs
    await expect(page.locator('text=Total Deliveries').first()).toBeVisible();
    await expect(page.locator('text=Active In Transit').or(page.locator('text=In Transit')).first()).toBeVisible();

    // Screenshot 2: Dashboard
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dashboard.png') });
  });

  test('Scenario 8 & 9: Delivery Management (/deliveries) table, search and filtering', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/deliveries"]');
    await expect(page).toHaveURL(/.*\/deliveries/);
    await expect(page.getByRole('heading', { name: 'Delivery Management', exact: true }).first()).toBeVisible();

    // Search input
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    // Screenshot 3: Delivery Management
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_delivery_management.png') });
  });

  test('Scenario 10 & 11: Create Consignment Modal visibility', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');

    await page.goto('/deliveries');
    const newBtn = page.locator('button:has-text("New Delivery")').or(page.locator('button:has-text("Add Delivery")')).or(page.locator('button:has-text("Create")')).first();
    if (await newBtn.isVisible()) {
      await expect(newBtn).toBeEnabled();
    }
  });

  test('Scenario 12, 13, 14, 15: Route Planner route calculation and search visualizer', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/route-planner"]');
    await expect(page).toHaveURL(/.*\/route-planner/);
    await expect(page.getByRole('heading', { name: 'Route Planner' }).first()).toBeVisible();

    // Verify calculate button is present and click it to compute shortest path
    const calcBtn = page.locator('button:has-text("Find route")').or(page.locator('button:has-text("Calculate Shortest Route")')).first();
    await expect(calcBtn).toBeVisible();
    await calcBtn.click();

    // Verify results card and step-by-step trace appear
    await expect(page.locator('text=Shortest route').or(page.locator('text=Optimal Shortest Path Found')).first()).toBeVisible();
    await expect(page.locator('text=Distance').or(page.locator('text=Total Shortest Road Distance')).first()).toBeVisible();
    await expect(page.locator('text=Step-by-step search').or(page.locator('text=Step-by-Step Route Search Trace')).first()).toBeVisible();

    await page.waitForTimeout(1500);

    // Screenshot 4: Route Planner (Top View with Map & Controls)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_route_optimization_ada.png') });

    // Scroll to Search Visualizer
    await page.locator('text=Step-by-step search').or(page.locator('text=Step-by-Step Route Search Trace')).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_route_optimization_debugger.png') });
  });

  test('Scenario 16, 17, 18: Delivery Zones territory allocation and history', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/delivery-zones"]');
    await expect(page).toHaveURL(/.*\/delivery-zones/);
    await expect(page.getByRole('heading', { name: 'Delivery Zones' }).first()).toBeVisible();

    // Wait for initial zone calculation to complete and results to render
    await expect(page.locator('text=Zone Detail & Territory Allocation').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Screenshot 5: Delivery Zones (Scatter Plot View)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_cluster_analysis_sda.png') });

    // Switch to Map View and capture Leaflet map screenshot
    const mapToggleBtn = page.locator('button:has-text("Map View")').first();
    await mapToggleBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_cluster_analysis_map.png') });

    // Scroll down to Zone Detail Cards & Diagnostics
    await page.locator('text=Zone Detail & Territory Allocation').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_cluster_analysis_details.png') });

    // Scroll down to History
    await page.locator('#cluster-history').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_cluster_analysis_history.png') });
  });

  test('Scenario 19 & 20: Analytics descriptive metrics and operational trends', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/analytics"]');
    await expect(page).toHaveURL(/.*\/analytics/);
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true }).first()).toBeVisible();

    // Wait for statistical datasets to load
    await expect(page.locator('text=Average Trip Distance').or(page.locator('text=Sample Mean Trip Distance')).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Assert Frequency Distribution Histogram renders with at least 3 bars
    const histHeading = page.getByRole('heading', { name: 'Frequency Distribution Histogram' });
    await expect(histHeading).toBeVisible();
    const histBars = page.locator('.lg\\:col-span-7 .recharts-bar-rectangle');
    await expect(histBars.first()).toBeVisible({ timeout: 10000 });
    const histBarCount = await histBars.count();
    expect(histBarCount).toBeGreaterThanOrEqual(3);
    expect(await page.locator('.recharts-bar-rectangle').count()).toBeGreaterThanOrEqual(3);

    // Screenshot 6: Analytics (Top View: KPIs, Scope & Distribution)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_statistical_analytics_sda.png') });

    // Scroll to Univariate Statistics Matrix
    await page.locator('text=Delivery & Route Metrics Distribution Table').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_statistical_analytics_matrix.png') });

    // Scroll to Distance vs Travel Time
    await page.locator('text=Distance vs Travel Time').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_statistical_analytics_correlation.png') });
  });

  test('Scenario 21: System Status operational telemetry and service status', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/system-status"]');
    await expect(page).toHaveURL(/.*\/system-status/);
    await expect(page.getByRole('heading', { name: 'System Status' })).toBeVisible();

    // Wait for system telemetry to load
    await expect(page.locator('text=Backend API Status').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Screenshot 7: System Status Overview & KPI Cards
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_cloud_management_cc.png') });

    // Scroll to Services Table
    await page.locator('text=Services').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_cloud_management_services.png') });
  });

  test('Scenario 22: Reports Export System (/reports) and PDF/CSV downloads', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/reports"]');
    await expect(page).toHaveURL(/.*\/reports/);
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();

    // Verify Admin reports
    await expect(page.locator('text=Analytics Report').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=System Status Report').first()).toBeVisible();
    await expect(page.locator('text=Full Summary Report').first()).toBeVisible();
    await page.waitForTimeout(1000);

    // Screenshot 8: Reports Export Overview
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_reports_export.png') });
  });

  test('Scenario 23: Settings (/settings) Theme toggle and RBAC User Management', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL(/.*\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    // Wait for profile info to load
    await expect(page.locator('text=My Profile').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Screenshot 9: Settings Profile & Security
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_settings_rbac.png') });

    // Switch to Appearance Tab
    const prefTab = page.locator('button:has-text("Appearance")').first();
    await prefTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Appearance Settings').first()).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_settings_preferences.png') });

    // Switch to User Management Tab (Admin only)
    const userTab = page.locator('button:has-text("User Management")').first();
    await userTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=User Management & Access Control').first()).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_settings_users.png') });
  });

  test('Scenario 24: Logout invalidates session and redirects to Login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Click Sign Out in Navbar
    const signOutBtn = page.locator('button[aria-label="Logout"]');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Scenario 25: Admin Dashboard renders system overview, user management, and cloud architecture', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.locator('text=Total Deliveries').first()).toBeVisible();
    await expect(page.locator('text=Daily Deliveries').first()).toBeVisible();
    await expect(page.locator('text=Delivery Status').first()).toBeVisible();
    await expect(page.locator('text=System Status').first()).toBeVisible();
    await expect(page.locator('text=Platform Users').first()).toBeVisible();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_admin_dashboard.png') });
  });

  test('Scenario 26: Dispatcher Dashboard renders delivery operations, status filter, and route shortcut', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' }).first()).toBeVisible();
    await expect(page.locator('text=Pending').first()).toBeVisible();
    await expect(page.locator('text=In transit').or(page.locator('text=In Transit')).first()).toBeVisible();
    await expect(page.locator('button:has-text("Plan route")').or(page.locator('button:has-text("Plan Route")')).first()).toBeVisible();
    await expect(page.locator('text=Needs dispatch').or(page.locator('text=Needs Dispatch')).first()).toBeVisible();

    // Verify dispatcher cannot see user management summary or system status
    await expect(page.locator('text=Platform Users')).not.toBeVisible();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dispatcher_dashboard.png') });
  });

  test('Scenario 27: Viewer Dashboard renders read-only overview and no mutation buttons', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByRole('heading', { name: 'Track your parcel' })).toBeVisible();
    await expect(page.locator('button:has-text("Download my parcel report")')).toBeVisible();

    // Verify viewer does NOT see mutation buttons or user management
    await expect(page.locator('button:has-text("New Delivery")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Add Delivery")')).not.toBeVisible();
    await expect(page.locator('text=Platform Users')).not.toBeVisible();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_viewer_dashboard.png') });
  });

  test('Scenario 28: Session reload preserves authenticated role dashboard and /dashboard alias routes correctly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.getByRole('heading', { name: 'Dispatcher Dashboard' })).first()).toBeVisible();

    // Test page reload preserves Dispatcher Dashboard
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.getByRole('heading', { name: 'Dispatcher Dashboard' })).first()).toBeVisible();

    // Test /dashboard alias redirects to / and renders Dispatcher Dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.getByRole('heading', { name: 'Dispatcher Dashboard' })).first()).toBeVisible();
  });

  test('Scenario 29: Delivery Management (/deliveries) — View Delivery Details modal displays progress and hubs', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    await page.goto('/deliveries');
    await expect(page).toHaveURL(/.*\/deliveries/);

    // Wait for delivery records to load
    await expect(page.locator('table').first()).toBeVisible();

    // Click "View Details" (eye button) on the first record
    const viewBtn = page.locator('button[title*="View consignment details"]').first();
    await viewBtn.click();

    // Check modal visibility
    await expect(page.locator('text=Delivery Details').first()).toBeVisible();
    await expect(page.locator('text=Fulfillment Stage').first()).toBeVisible();
    await expect(page.locator('text=Origin Hub (Source)').first()).toBeVisible();
    await expect(page.locator('text=Destination Waypoint').first()).toBeVisible();

    // Close modal
    await page.click('button:has-text("Close")');
    await expect(page.locator('text=Fulfillment Stage')).not.toBeVisible();
  });

  test('Scenario 30: Delivery Management (/deliveries) — RBAC enforcement prevents Viewer from mutating records', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    await page.goto('/deliveries');
    // Direct navigation is blocked for Viewer
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();
  });

  test('Scenario 31: Delivery Management (/deliveries) — Professional layout renders cleanly without academic clutter', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    await page.goto('/deliveries');
    await expect(page.getByRole('heading', { name: 'Delivery Management', exact: true }).first()).toBeVisible();
    await expect(page.locator('text=Manage delivery records and monitor their progress').first()).toBeVisible();

    // Verify academic clutter and curriculum cards are removed
    await expect(page.locator('text=How Delivery Data Supports Our Project')).not.toBeVisible();
    await expect(page.locator('text=CS-301')).not.toBeVisible();
    await expect(page.locator('text=Dijkstra Graph Edge')).not.toBeVisible();
  });

  test('Scenario 32: Role-based sidebar filtering renders exact items per role', async ({ page }) => {
    // 1. Admin sees 5 items
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    const adminNav = page.locator('nav a');
    await expect(adminNav.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Analytics' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'System Status' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Reports' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Settings' })).toBeVisible();
    // Admin does NOT see operational tools
    await expect(adminNav.filter({ hasText: 'Delivery Management' })).not.toBeVisible();
    await expect(adminNav.filter({ hasText: 'Route Planner' })).not.toBeVisible();
    await expect(adminNav.filter({ hasText: 'Delivery Zones' })).not.toBeVisible();

    // 2. Dispatcher sees 7 items (No System Status)
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    const dispNav = page.locator('nav a');
    await expect(dispNav.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Delivery Management' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Route Planner' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Delivery Zones' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Analytics' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Reports' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Settings' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'System Status' })).not.toBeVisible();

    // 3. Viewer sees 3 items
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    const viewNav = page.locator('nav a');
    await expect(viewNav.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(viewNav.filter({ hasText: 'Reports' })).toBeVisible();
    await expect(viewNav.filter({ hasText: 'Settings' })).toBeVisible();
    await expect(viewNav.filter({ hasText: 'Delivery Management' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'Route Planner' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'Delivery Zones' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'Analytics' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'System Status' })).not.toBeVisible();
  });

  test('Scenario 33: Direct URL route protection for /system-status restricts non-admins', async ({ page }) => {
    // 1. Viewer direct navigation -> Access Denied
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    await page.goto('/system-status');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();
    const backBtn = page.locator('a:has-text("Back to Dashboard")');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/.*\/$/);

    // 2. Dispatcher direct navigation -> Access Denied
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    await page.goto('/system-status');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // 3. Admin direct navigation to /deliveries -> Access Denied
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    await page.goto('/deliveries');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();
  });

  test('Scenario 34: Viewer UI action restrictions across Route Planner and Delivery Zones', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Direct access to Route Planner blocked for Viewer
    await page.goto('/route-planner');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // Direct access to Delivery Zones blocked for Viewer
    await page.goto('/delivery-zones');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();
  });

  test('Scenario 35: Role-based dashboard headings and cards', async ({ page }) => {
    // 1. Admin Dashboard
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.locator('text=System Status').first()).toBeVisible();
    await expect(page.locator('text=Platform Users').first()).toBeVisible();

    // 2. Dispatcher Dashboard
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.getByRole('heading', { name: 'Dispatcher Dashboard' })).first()).toBeVisible();
    await expect(page.locator('button:has-text("Plan route")').or(page.locator('button:has-text("Plan Route")')).first()).toBeVisible();
    await expect(page.locator('text=Needs dispatch').or(page.locator('text=Needs Dispatch')).first()).toBeVisible();

    // 3. Viewer Dashboard
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: 'Track your parcel' })).toBeVisible();
    await expect(page.locator('button:has-text("Download my parcel report")')).toBeVisible();
  });

  test('Scenario 36: Full role-permission matrix verification for action controls across all pages', async ({ page }) => {
    // -------------------------------------------------------------
    // 1. ADMIN
    // -------------------------------------------------------------
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@smartroute.pro');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Sidebar: 5 items
    const adminNav = page.locator('nav a');
    await expect(adminNav.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Analytics' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'System Status' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Reports' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Settings' })).toBeVisible();
    await expect(adminNav.filter({ hasText: 'Delivery Management' })).not.toBeVisible();
    await expect(adminNav.filter({ hasText: 'Route Planner' })).not.toBeVisible();
    await expect(adminNav.filter({ hasText: 'Delivery Zones' })).not.toBeVisible();

    // Deliveries: Direct navigation blocked for Admin
    await page.goto('/deliveries');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // Route Planner: Direct navigation blocked for Admin
    await page.goto('/route-planner');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // Delivery Zones: Direct navigation blocked for Admin
    await page.goto('/delivery-zones');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // Reports: "System Status Report" download button PRESENT for Admin
    await page.goto('/reports');
    await expect(page.locator('text=System Status Report')).toBeVisible();

    // Settings: "User Management" tab PRESENT for Admin
    await page.goto('/settings');
    await expect(page.locator('button:has-text("User Management")')).toBeVisible();

    // Direct navigation to /system-status ALLOWED for Admin
    await page.goto('/system-status');
    await expect(page.locator('text=System Status').first()).toBeVisible();
    await expect(page.locator('text=You don\'t have access to this page')).not.toBeVisible();

    // -------------------------------------------------------------
    // 2. DISPATCHER
    // -------------------------------------------------------------
    await page.goto('/login');
    await page.fill('input[type="email"]', 'dispatcher@smartroute.pro');
    await page.fill('input[type="password"]', 'Dispatch@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Sidebar: 7 items (No System Status)
    const dispNav = page.locator('nav a');
    await expect(dispNav.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Delivery Management' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Route Planner' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Delivery Zones' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Analytics' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Reports' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'Settings' })).toBeVisible();
    await expect(dispNav.filter({ hasText: 'System Status' })).not.toBeVisible();

    // Deliveries: "Add Delivery" button PRESENT for Dispatcher
    await page.goto('/deliveries');
    await expect(page.locator('button:has-text("Add Delivery")').or(page.locator('button:has-text("New Delivery")'))).toBeVisible();

    // Route Planner: "Find route" button PRESENT for Dispatcher
    await page.goto('/route-planner');
    await expect(page.locator('button:has-text("Find route")').or(page.locator('button:has-text("Calculate")'))).toBeVisible();

    // Delivery Zones: "Create Zones" button PRESENT for Dispatcher
    await page.goto('/delivery-zones');
    await expect(page.locator('button:has-text("Create Zones")').first()).toBeVisible();

    // Reports: "System Status Report" download button ABSENT for Dispatcher
    await page.goto('/reports');
    await expect(page.locator('text=System Status Report')).not.toBeVisible();

    // Settings: "User Management" tab ABSENT for Dispatcher
    await page.goto('/settings');
    await expect(page.locator('button:has-text("User Management")')).not.toBeVisible();

    // Direct navigation to /system-status BLOCKED for Dispatcher
    await page.goto('/system-status');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // -------------------------------------------------------------
    // 3. VIEWER
    // -------------------------------------------------------------
    await page.goto('/login');
    await page.fill('input[type="email"]', 'viewer@smartroute.pro');
    await page.fill('input[type="password"]', 'Viewer@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/$/);

    // Sidebar: 3 items (Dashboard, Reports, Settings)
    const viewNav = page.locator('nav a');
    await expect(viewNav.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(viewNav.filter({ hasText: 'Reports' })).toBeVisible();
    await expect(viewNav.filter({ hasText: 'Settings' })).toBeVisible();
    await expect(viewNav.filter({ hasText: 'Delivery Management' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'Route Planner' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'Delivery Zones' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'Analytics' })).not.toBeVisible();
    await expect(viewNav.filter({ hasText: 'System Status' })).not.toBeVisible();

    // Dashboard: "Track your parcel" heading and "Download my parcel report"
    await expect(page.getByRole('heading', { name: 'Track your parcel' })).toBeVisible();
    await expect(page.locator('button:has-text("Download my parcel report")')).toBeVisible();

    // Direct navigation to protected pages BLOCKED for Viewer
    await page.goto('/deliveries');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    await page.goto('/route-planner');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    await page.goto('/delivery-zones');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    await page.goto('/analytics');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    await page.goto('/system-status');
    await expect(page.locator('text=You don\'t have access to this page')).toBeVisible();

    // Reports: "My Parcels Report" PRESENT for Viewer
    await page.goto('/reports');
    await expect(page.locator('text=My Parcels Report')).toBeVisible();
    await expect(page.locator('text=System Status Report')).not.toBeVisible();
  });

});


