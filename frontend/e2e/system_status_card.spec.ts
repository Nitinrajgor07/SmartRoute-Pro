import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard — System Status Card Real Data', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as ADMIN in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('smartroute_access_token', 'mock-access-token-xyz');
      window.localStorage.setItem(
        'smartroute_user',
        JSON.stringify({
          id: 1,
          email: 'admin@smartroute.pro',
          name: 'System Administrator',
          role: 'ADMIN',
          approval_status: 'approved',
          is_active: true,
        })
      );
      window.localStorage.setItem('smartroute_permissions', JSON.stringify(['*']));
    });

    // Mock auth /me endpoint
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            email: 'admin@smartroute.pro',
            name: 'System Administrator',
            role: 'ADMIN',
            approval_status: 'approved',
            is_active: true,
          },
          permissions: ['*'],
        }),
      });
    });

    // Mock summary and users endpoints so dashboard loads immediately
    await page.route('**/api/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            total_deliveries: 12,
            in_transit_deliveries: 3,
            completed_deliveries: 8,
            delayed_deliveries: 1,
            pending_deliveries: 0,
            revenue: { today: 100, week: 500, month: 2000 }
          },
          performance_trend: []
        }),
      });
    });

    await page.route('**/api/auth/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            { id: 1, name: 'Admin', email: 'admin@smartroute.pro', role: 'ADMIN', is_active: true, approval_status: 'approved' }
          ]
        }),
      });
    });
  });

  test('Mocked health response with SQLite and Connected shows SQLite and Connected on card', async ({ page }) => {
    await page.route('**/api/cloud/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          service: 'SmartRoute Pro',
          version: '8.0.0',
          total_latency_ms: 14.2,
          database: {
            engine: 'SQLite',
            status: 'Connected',
            connected: true,
            latency_ms: 3.5,
          },
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    const dbEngineLocator = page.getByTestId('database-engine');
    await expect(dbEngineLocator).toBeVisible();
    await expect(dbEngineLocator).toContainText('SQLite');
    await expect(dbEngineLocator).toContainText('Connected');

    const serviceStatusLocator = page.getByTestId('service-status');
    await expect(serviceStatusLocator).toBeVisible();
    await expect(serviceStatusLocator).toHaveText('Operational');

    const latencyLocator = page.getByTestId('api-latency');
    await expect(latencyLocator).toBeVisible();
    await expect(latencyLocator).toHaveText('14.2 ms');
  });

  test('Mocked health response with PostgreSQL shows PostgreSQL on card', async ({ page }) => {
    await page.route('**/api/cloud/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'UP',
          service: 'SmartRoute Pro',
          version: '8.0.0',
          total_latency_ms: 18.7,
          database: {
            engine: 'PostgreSQL',
            connected: true,
            latency_ms: 5.1,
          },
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    const dbEngineLocator = page.getByTestId('database-engine');
    await expect(dbEngineLocator).toBeVisible();
    await expect(dbEngineLocator).toContainText('PostgreSQL');

    const serviceStatusLocator = page.getByTestId('service-status');
    await expect(serviceStatusLocator).toBeVisible();
    await expect(serviceStatusLocator).toHaveText('Operational');

    const latencyLocator = page.getByTestId('api-latency');
    await expect(latencyLocator).toBeVisible();
    await expect(latencyLocator).toHaveText('18.7 ms');
  });

  test('Failed health request shows Offline and no latency number', async ({ page }) => {
    await page.route('**/api/cloud/health', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    const serviceStatusLocator = page.getByTestId('service-status');
    await expect(serviceStatusLocator).toBeVisible();
    await expect(serviceStatusLocator).toHaveText('Offline');

    const latencyLocator = page.getByTestId('api-latency');
    await expect(latencyLocator).toBeVisible();
    await expect(latencyLocator).toHaveText('-');

    const dbEngineLocator = page.getByTestId('database-engine');
    await expect(dbEngineLocator).toBeVisible();
    await expect(dbEngineLocator).toHaveText('Unknown');
  });
});
