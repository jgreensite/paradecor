const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/');
    console.log('Loaded');

    const rybCountDiv = page.locator('div').filter({ hasText: /^Ryb Count/ });
    const rybCountSlider = rybCountDiv.locator('input[type="range"]');
    await rybCountSlider.fill('100');
    console.log('Filled ryb count');

    const bpCheckbox = page.locator('label:has-text("Enable Backplane") >> input[type="checkbox"]');
    if (!(await bpCheckbox.isChecked())) await bpCheckbox.click();
    console.log('Checked backplane');

    const shapeSelect = page.locator('h3:has-text("Backplane")').locator('..').locator('select');
    await shapeSelect.selectOption('organic');
    console.log('Selected organic');

    const exportBtn = page.getByRole('button', { name: 'Export & Order' });
    await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    await exportBtn.click();
    console.log('Clicked export');

    await page.waitForTimeout(500);
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    const dxfBtn = page.locator('button', { hasText: /DXF/ });
    await dxfBtn.click();
    console.log('Clicked DXF');

    await downloadPromise;
    console.log('Downloaded');

    await browser.close();
})().catch(e => {
    console.error(e);
    process.exit(1);
});
