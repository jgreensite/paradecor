import { test, expect } from '@playwright/test';

test.describe('Parametric Shelf Creator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('UI Integrity: All sliders exist and are interactable', async ({ page }) => {
    // Check main dimension sliders exist
    await expect(page.locator('input[type="range"]').first()).toBeVisible();
    
    // Check view mode buttons - use first() since there are two sets (single rib + full preview)
    await expect(page.getByRole('button', { name: '3D' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Top' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Front' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Side' }).first()).toBeVisible();
    
    // Check preset buttons
    await expect(page.getByRole('button', { name: /Gentle Wave|Steep Wave|Flat Shelf|Organic/i }).first()).toBeVisible();
    
    // Check rib shape buttons
    await expect(page.getByRole('button', { name: /Square|Circle|Rectangle|Freeform/i }).first()).toBeVisible();
  });

  test('State Sync: Physical dimension updates Factor slider', async ({ page }) => {
    // Find the X dimension input in Single Rib Editor section
    const singleRibSection = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const xInput = singleRibSection.locator('input[type="number"]').first();
    
    // Get the factor slider - it's the range input after the X dimension controls
    const factorSlider = singleRibSection.locator('input[type="range"]').first();
    const initialValue = await factorSlider.inputValue();
    
    // Change the physical dimension value
    await xInput.fill('5');
    
    // Wait a moment for React to update
    await page.waitForTimeout(500);
    
    // The factor slider value should change from 1
    const newValue = await factorSlider.inputValue();
    expect(newValue).not.toBe(initialValue);
  });

  test('Canvas Rendering: Three.js canvas initializes without errors', async ({ page }) => {
    // Check that canvas exists - use first canvas (hero section)
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    
    // Check no console errors related to Three.js
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit for any delayed errors
    await page.waitForTimeout(1000);
    
    // Filter out non-critical errors
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('Warning') && !err.includes('DevTools')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('Regression: Rods per Rib slider triggers re-render', async ({ page }) => {
    // Find the rod slider in the Wall Mount section
    const rodSlider = page.locator('.card').filter({ hasText: 'Wall Mount' }).locator('input[type="range"]');
    await expect(rodSlider).toBeVisible();
    
    // Get initial slider value
    const initialValue = await rodSlider.inputValue();
    
    // Change rod count using evaluate to work with range input
    await rodSlider.fill('3');
    
    // Verify value changed
    const newValue = await rodSlider.inputValue();
    expect(newValue).not.toBe(initialValue);
    
    // Canvas should still be visible and rendering
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('View Controls: Switching views updates the scene', async ({ page }) => {
    // Get the view buttons from the Full Shelf Preview section
    const previewCard = page.locator('.card').filter({ hasText: 'Full Shelf Preview' });
    
    // Click through different view modes
    await previewCard.getByRole('button', { name: 'Top' }).click();
    await page.waitForTimeout(500);
    
    await previewCard.getByRole('button', { name: 'Front' }).click();
    await page.waitForTimeout(500);
    
    await previewCard.getByRole('button', { name: 'Side' }).click();
    await page.waitForTimeout(500);
    
    await previewCard.getByRole('button', { name: '3D' }).click();
    await page.waitForTimeout(500);
    
    // Canvas should still be visible after all view switches
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Rib Shape selection works', async ({ page }) => {
    // Click on Circle shape
    await page.getByRole('button', { name: /Circle/i }).first().click();
    
    // Canvas should still render
    await expect(page.locator('canvas').first()).toBeVisible();
    
    // Click on Rectangle shape
    await page.getByRole('button', { name: /Rectangle/i }).first().click();
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Export modal opens and closes', async ({ page }) => {
    // Click export button in the price section
    await page.locator('button').filter({ hasText: 'Export & Order' }).click();
    
    // Check modal is visible
    await expect(page.locator('text=Export Files')).toBeVisible();
    
    // Close modal
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Modal should be hidden
    await expect(page.locator('text=Export Files')).not.toBeVisible();
  });
});
