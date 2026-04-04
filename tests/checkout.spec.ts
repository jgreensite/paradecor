import { test, expect } from '@playwright/test';

test.describe('E2E Checkout Workflow', () => {
    test('User can click Buy Now and is redirected to Stripe', async ({ page }) => {
        // Intercept network call to mock Stripe creation URL bypass so we don't spam 3rd parties
        await page.route(
            '**/api/create-checkout-session',
            async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'mock_sess_id_123',
                        url: 'https://checkout.stripe.com/mock-redirect-url'
                    })
                });
            }
        );

        // A stubbed fallback response if using mocked stripe domains instead of real routing
        await page.route('https://checkout.stripe.com/mock-redirect-url', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<html><body>Mock Stripe UI</body></html>'
            });
        });

        await page.goto('/');

        // Wait for the designer to load
        await page.waitForSelector('button:has-text("Buy Now")');

        // Click Buy Now
        await page.click('button:has-text("Buy Now")');
        
        // Assert Stripe intercept
        await expect(page).toHaveURL(/.*?checkout\.stripe\.com\/mock-redirect-url/);
    });
});
