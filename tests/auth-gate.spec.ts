import { test, expect, type Page } from '@playwright/test';

async function gotoHome(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Rybform')).toBeVisible({ timeout: 15000 });
}

test.describe('Authentication Gate', () => {

  test('Public frontpage loads without crashing', async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByText('Rybform')).toBeVisible({ timeout: 15000 });
  });

  test('Unauthenticated user sees a Sign In button in the navigation', async ({ page }) => {
    await gotoHome(page);
    // Clerk renders <button>Sign In</button> via SignInButton for unauthenticated users
    await expect(page.getByText('Sign In', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Unauthenticated user sees "Sign in to Export" CTA in the pricing section', async ({ page }) => {
    await gotoHome(page);
    // The pricing section shows "Sign in to Export" for unauthenticated users
    await expect(page.getByRole('button', { name: 'Sign in to Export' })).toBeVisible({ timeout: 15000 });
    // Admin-only "Export & Order" button should NOT be visible
    await expect(page.getByText('Export & Order', { exact: true })).not.toBeVisible();
  });

});
