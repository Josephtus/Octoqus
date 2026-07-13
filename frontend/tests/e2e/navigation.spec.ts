
import { test, expect, devices } from '@playwright/test';

test.describe('Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user session
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            name: 'Yusuf',
            surname: 'Test',
            mail: 'test@octoqus.com',
            role: 'USER',
            is_active: true
          }
        }),
      });
    });

    // Mock other dashboard requests to prevent errors
    await page.route('**/api/**', async (route) => {
      if (route.request().url().includes('/auth/me')) return; // Already handled
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
  });

  test('Desktop navigation should show horizontal menu and no bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard');
    
    // Wait for dashboard to load (checking for OCTOQUS text)
    await expect(page.getByText('OCTOQUS')).toBeVisible();

    // Check if bottom bar is NOT visible on desktop
    const bottomNav = page.getByTestId('bottom-navbar');
    await expect(bottomNav).toBeHidden();

    // Check if desktop nav is visible
    const desktopNav = page.locator('nav.hidden.md\\:flex');
    await expect(desktopNav).toBeVisible();
  });

  test('Mobile navigation should show bottom bar with correct items', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    // Wait for bottom bar to appear with a longer timeout if needed
    const bottomNav = page.getByTestId('bottom-navbar');
    await expect(bottomNav).toBeVisible({ timeout: 10000 });

    // Verify navigation items exist in bottom bar
    const navItems = ['Panel', 'Gruplar', 'Sosyal', 'Profil', 'Destek'];
    for (const item of navItems) {
      await expect(bottomNav.getByText(item)).toBeVisible();
    }
  });
});
