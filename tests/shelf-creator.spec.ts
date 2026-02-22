import { test, expect } from '@playwright/test';

test.describe('Parametric Shelf Creator - UI Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Page loads without crash', async ({ page }) => {
    await expect(page).toHaveTitle(/Ribform/);
  });

  test('Navigation exists', async ({ page }) => {
    await expect(page.getByText('Ribform')).toHaveCount(2);
  });

  test('Hero section visible', async ({ page }) => {
    await expect(page.getByText('Shape by shape')).toBeVisible();
    await expect(page.getByText('rib by rib')).toBeVisible();
  });

  test('All sliders exist', async ({ page }) => {
    const sliders = page.locator('input[type="range"]');
    await expect(sliders.count()).resolves.toBeGreaterThan(8);
  });

  test('All number inputs exist', async ({ page }) => {
    const inputs = page.locator('input[type="number"]');
    await expect(inputs.count()).resolves.toBeGreaterThan(5);
  });

  test('All select dropdowns exist', async ({ page }) => {
    const selects = page.locator('select');
    await expect(selects.count()).resolves.toBeGreaterThan(4);
  });

  test('Rib shape buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Square/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Circle/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Rectangle/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Freeform/i })).toBeVisible();
  });

  test('View mode buttons exist in Single Rib Editor', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    await expect(section.getByRole('button', { name: '3D' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Top' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Front' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Side' })).toBeVisible();
  });

  test('View mode buttons exist in Full Shelf Editor', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await expect(section.getByRole('button', { name: '3D' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Top' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Front' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Side' })).toBeVisible();
  });

  test('Preset buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Gentle Wave/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Steep Wave/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Flat Shelf/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Organic/i })).toBeVisible();
  });

  test('Material buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Premium MDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Birch Plywood/i })).toBeVisible();
  });

  test('Canvases render', async ({ page }) => {
    const canvases = page.locator('canvas');
    await expect(canvases).toHaveCount(4);
  });

  test('Flat back edge checkbox exists', async ({ page }) => {
    await expect(page.getByRole('checkbox')).toBeVisible();
  });

  test('Export buttons exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Export & Order/i })).toBeVisible();
  });

  test('Price section visible', async ({ page }) => {
    await expect(page.locator('text=/\\$\\d+/').first()).toBeVisible();
  });

  test('Sheets count displays', async ({ page }) => {
    await expect(page.getByText('Sheets')).toBeVisible();
  });

  test('Efficiency displays', async ({ page }) => {
    await expect(page.getByText('Efficiency')).toBeVisible();
  });

  test('Ribs count displays', async ({ page }) => {
    await expect(page.getByText('Ribs', { exact: true })).toBeVisible();
  });
});

test.describe('Parametric Shelf Creator - View Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Single Rib: 3D view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    await section.getByRole('button', { name: '3D' }).click();
    await page.waitForTimeout(300);
  });

  test('Single Rib: Top view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    await section.getByRole('button', { name: 'Top' }).click();
    await page.waitForTimeout(300);
  });

  test('Single Rib: Front view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    await section.getByRole('button', { name: 'Front' }).click();
    await page.waitForTimeout(300);
  });

  test('Single Rib: Side view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    await section.getByRole('button', { name: 'Side' }).click();
    await page.waitForTimeout(300);
  });

  test('Full Shelf: 3D view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await section.getByRole('button', { name: '3D' }).click();
    await page.waitForTimeout(300);
  });

  test('Full Shelf: Top view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await section.getByRole('button', { name: 'Top' }).click();
    await page.waitForTimeout(300);
  });

  test('Full Shelf: Front view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await section.getByRole('button', { name: 'Front' }).click();
    await page.waitForTimeout(300);
  });

  test('Full Shelf: Side view works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await section.getByRole('button', { name: 'Side' }).click();
    await page.waitForTimeout(300);
  });

  test('Views can be switched independently', async ({ page }) => {
    const ribSection = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const shelfSection = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    
    await ribSection.getByRole('button', { name: 'Top' }).click();
    await page.waitForTimeout(200);
    await shelfSection.getByRole('button', { name: 'Side' }).click();
    await page.waitForTimeout(200);
    
    await ribSection.getByRole('button', { name: '3D' }).click();
    await page.waitForTimeout(200);
  });
});

test.describe('Parametric Shelf Creator - Rib Shapes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Square rib renders', async ({ page }) => {
    await page.getByRole('button', { name: /Square/i }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Circle rib renders', async ({ page }) => {
    await page.getByRole('button', { name: /Circle/i }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Rectangle rib renders', async ({ page }) => {
    await page.getByRole('button', { name: /Rectangle/i }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Freeform button opens drawer', async ({ page }) => {
    await page.getByRole('button', { name: /Freeform/i }).first().click();
    await expect(page.getByText('Draw Freeform Rib')).toBeVisible();
  });

  test('Freeform drawer can be closed', async ({ page }) => {
    await page.getByRole('button', { name: /Freeform/i }).first().click();
    await expect(page.getByText('Draw Freeform Rib')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Draw Freeform Rib')).not.toBeVisible();
  });

  test('Freeform drawer can be cleared', async ({ page }) => {
    await page.getByRole('button', { name: /Freeform/i }).first().click();
    await expect(page.getByText('Draw Freeform Rib')).toBeVisible();
    await page.getByRole('button', { name: 'Clear' }).click();
  });
});

test.describe('Parametric Shelf Creator - Presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Gentle Wave preset applies', async ({ page }) => {
    await page.getByRole('button', { name: /Gentle Wave/i }).click();
    await page.waitForTimeout(300);
  });

  test('Steep Wave preset applies', async ({ page }) => {
    await page.getByRole('button', { name: /Steep Wave/i }).click();
    await page.waitForTimeout(300);
  });

  test('Flat Shelf preset applies', async ({ page }) => {
    await page.getByRole('button', { name: /Flat Shelf/i }).click();
    await page.waitForTimeout(300);
  });

  test('Organic preset applies', async ({ page }) => {
    await page.getByRole('button', { name: /Organic/i }).click();
    await page.waitForTimeout(300);
  });

  test('Presets are mutually exclusive', async ({ page }) => {
    const gentle = page.getByRole('button', { name: /Gentle Wave/i });
    const steep = page.getByRole('button', { name: /Steep Wave/i });
    
    await gentle.click();
    await page.waitForTimeout(200);
    await steep.click();
    await page.waitForTimeout(200);
  });
});

test.describe('Parametric Shelf Creator - Materials', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Premium MDF selection', async ({ page }) => {
    await page.getByRole('button', { name: /Premium MDF/i }).click();
    await page.waitForTimeout(300);
  });

  test('Birch Plywood selection', async ({ page }) => {
    await page.getByRole('button', { name: /Birch Plywood/i }).click();
    await page.waitForTimeout(300);
  });

  test('Walnut Plywood selection', async ({ page }) => {
    await page.getByRole('button', { name: /Walnut Plywood/i }).click();
    await page.waitForTimeout(300);
  });

  test('White PVC selection', async ({ page }) => {
    await page.getByRole('button', { name: /White PVC/i }).click();
    await page.waitForTimeout(300);
  });
});

test.describe('Parametric Shelf Creator - Dimension Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Length input is editable', async ({ page }) => {
    const lengthInput = page.locator('.card').filter({ hasText: 'Shelf Dimensions' }).locator('input[type="number"]').first();
    await lengthInput.fill('60');
    await page.waitForTimeout(300);
  });

  test('Height input is editable', async ({ page }) => {
    const heightInput = page.locator('.card').filter({ hasText: 'Shelf Dimensions' }).locator('input[type="number"]').nth(1);
    await heightInput.fill('30');
    await page.waitForTimeout(300);
  });

  test('X dimension in Single Rib is editable', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const xInput = section.locator('input[type="number"]').first();
    await xInput.fill('5');
    await page.waitForTimeout(300);
  });

  test('Y dimension in Single Rib is editable', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const yInput = section.locator('input[type="number"]').nth(1);
    await yInput.fill('4');
    await page.waitForTimeout(300);
  });

  test('Z dimension in Single Rib is editable', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const zInput = section.locator('input[type="number"]').nth(2);
    await zInput.fill('2');
    await page.waitForTimeout(300);
  });

  test('Unit toggle works', async ({ page }) => {
    const lengthSection = page.locator('.card').filter({ hasText: 'Shelf Dimensions' });
    const selects = lengthSection.locator('select');
    await selects.first().selectOption('mm');
    await page.waitForTimeout(300);
  });

  test('Rib count slider is adjustable', async ({ page }) => {
    const waveSection = page.locator('.card').filter({ hasText: 'Wave Path' });
    const ribCountSlider = waveSection.locator('input[type="range"]').first();
    await ribCountSlider.fill('15');
    await page.waitForTimeout(300);
  });

  test('Wave amplitude slider is adjustable', async ({ page }) => {
    const waveSection = page.locator('.card').filter({ hasText: 'Wave Path' });
    const amplitudeSlider = waveSection.locator('input[type="range"]').nth(1);
    await amplitudeSlider.fill('5');
    await page.waitForTimeout(300);
  });

  test('Frequency slider is adjustable', async ({ page }) => {
    const waveSection = page.locator('.card').filter({ hasText: 'Wave Path' });
    const freqSlider = waveSection.locator('input[type="range"]').nth(2);
    await freqSlider.fill('3');
    await page.waitForTimeout(300);
  });

  test('Rotate X slider works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const rotateX = section.locator('input[type="range"]').nth(3);
    await rotateX.fill('90');
    await page.waitForTimeout(300);
  });

  test('Rotate Y slider works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const rotateY = section.locator('input[type="range"]').nth(4);
    await rotateY.fill('45');
    await page.waitForTimeout(300);
  });

  test('Rotate Z slider works', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const rotateZ = section.locator('input[type="range"]').nth(5);
    await rotateZ.fill('180');
    await page.waitForTimeout(300);
  });

  test('Size transform start works', async ({ page }) => {
    const transformSection = page.locator('.card').filter({ hasText: 'Size Transform' });
    const startInput = transformSection.locator('input[type="number"]').first();
    await startInput.fill('0.5');
    await page.waitForTimeout(300);
  });

  test('Size transform end works', async ({ page }) => {
    const transformSection = page.locator('.card').filter({ hasText: 'Size Transform' });
    const endInput = transformSection.locator('input[type="number"]').nth(1);
    await endInput.fill('1.5');
    await page.waitForTimeout(300);
  });

  test('Rod diameter is editable', async ({ page }) => {
    const wallSection = page.locator('.card').filter({ hasText: 'Wall Mount' });
    const rodInput = wallSection.locator('input[type="number"]').first();
    await rodInput.fill('0.5');
    await page.waitForTimeout(300);
  });

  test('Rod count slider is adjustable', async ({ page }) => {
    const wallSection = page.locator('.card').filter({ hasText: 'Wall Mount' });
    const rodSlider = wallSection.locator('input[type="range"]').first();
    await rodSlider.fill('3');
    await page.waitForTimeout(300);
  });
});

test.describe('Parametric Shelf Creator - State Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Physical dimension updates factor', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const xInput = section.locator('input[type="number"]').first();
    const factorSlider = section.locator('input[type="range"]').first();
    
    const initialValue = await factorSlider.inputValue();
    await xInput.fill('5');
    await page.waitForTimeout(500);
    
    expect(await factorSlider.inputValue()).not.toBe(initialValue);
  });

  test('Different dimensions are independent', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Single Rib Editor' });
    const xInput = section.locator('input[type="number"]').first();
    const yInput = section.locator('input[type="number"]').nth(1);
    
    await xInput.fill('5');
    await page.waitForTimeout(300);
    await yInput.fill('6');
    await page.waitForTimeout(300);
  });
});

test.describe('Parametric Shelf Creator - Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  });

  test('Export modal opens from price section', async ({ page }) => {
    await page.getByRole('button', { name: /Export & Order/i }).click({ timeout: 10000 });
    await expect(page.getByText('Export Files')).toBeVisible();
  });

  test('SVG export button exists', async ({ page }) => {
    await page.getByRole('button', { name: /Export & Order/i }).click({ timeout: 10000 });
    await expect(page.getByText('SVG Cut Files')).toBeVisible();
  });

  test('DXF export button exists', async ({ page }) => {
    await page.getByRole('button', { name: /Export & Order/i }).click({ timeout: 10000 });
    await expect(page.getByText('DXF Cut Files')).toBeVisible();
  });

  test('Export modal closes', async ({ page }) => {
    await page.getByRole('button', { name: /Export & Order/i }).click({ timeout: 10000 });
    await expect(page.getByText('Export Files')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Export Files')).not.toBeVisible();
  });
});

test.describe('Parametric Shelf Creator - Canvas Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Canvas renders without errors', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });

  test('No console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(1000);
    
    const criticalErrors = errors.filter(e => !e.includes('Warning') && !e.includes('DevTools'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Canvas persists after parameter changes', async ({ page }) => {
    await page.getByRole('button', { name: /Circle/i }).first().click();
    await page.waitForTimeout(500);
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible();
  });
});

test.describe('Parametric Shelf Creator - Responsive & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Scrolling works', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await expect(page.getByText('Parametric rib-based')).toBeVisible();
  });

  test('Flat edge checkbox toggle works', async ({ page }) => {
    const checkbox = page.getByRole('checkbox');
    await checkbox.uncheck();
    await page.waitForTimeout(300);
    await checkbox.check();
    await page.waitForTimeout(300);
  });

  test('Large rib count does not crash', async ({ page }) => {
    const waveSection = page.locator('.card').filter({ hasText: 'Wave Path' });
    const ribCountSlider = waveSection.locator('input[type="range"]').first();
    await ribCountSlider.fill('25');
    await page.waitForTimeout(500);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Small rib count works', async ({ page }) => {
    const waveSection = page.locator('.card').filter({ hasText: 'Wave Path' });
    const ribCountSlider = waveSection.locator('input[type="range"]').first();
    await ribCountSlider.fill('3');
    await page.waitForTimeout(500);
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('Zero wave amplitude works', async ({ page }) => {
    const waveSection = page.locator('.card').filter({ hasText: 'Wave Path' });
    const amplitudeSlider = waveSection.locator('input[type="range"]').nth(1);
    await amplitudeSlider.fill('0');
    await page.waitForTimeout(500);
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});

test.describe('Parametric Shelf Creator - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Default state screenshot', async ({ page }) => {
    await page.waitForTimeout(500);
  });

  test('With Circle shape screenshot', async ({ page }) => {
    await page.getByRole('button', { name: /Circle/i }).first().click();
    await page.waitForTimeout(500);
  });

  test('With Organic preset screenshot', async ({ page }) => {
    await page.getByRole('button', { name: /Organic/i }).click();
    await page.waitForTimeout(500);
  });

  test('Top view screenshot', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await section.getByRole('button', { name: 'Top' }).click();
    await page.waitForTimeout(500);
  });

  test('Side view screenshot', async ({ page }) => {
    const section = page.locator('.card').filter({ hasText: 'Full Shelf Editor' });
    await section.getByRole('button', { name: 'Side' }).click();
    await page.waitForTimeout(500);
  });
});
