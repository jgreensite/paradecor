import { test, expect, type Page } from '@playwright/test';

async function gotoHome(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation');
  await expect(nav.getByText('Rybform', { exact: true })).toBeVisible({ timeout: 15000 });
}

test.describe('Authentication Gate', () => {

  test('Public frontpage loads without crashing', async ({ page }) => {
    await gotoHome(page);
  });

  test('Unauthenticated user sees a Sign In button in the navigation', async ({ page }) => {
    await gotoHome(page);
    // Clerk renders <button>Sign In</button> via SignInButton for unauthenticated users
    await expect(page.getByRole('navigation').getByText('Sign In', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Unauthenticated user sees Buy Now CTA in the pricing section', async ({ page }) => {
    await gotoHome(page);
    // The pricing section shows checkout CTA for non-admin users.
    await expect(page.getByRole('button', { name: 'Buy Now' })).toBeVisible({ timeout: 15000 });
    // Admin-only production export controls should NOT be visible.
    await expect(page.getByText('Export Production Files (Admin)', { exact: true })).not.toBeVisible();
  });

});
