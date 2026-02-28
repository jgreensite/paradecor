/**
 * DXF accuracy tests — generate a DXF from the app and compare to reference.
 *
 * These tests:
 * 1. Load the app
 * 2. Configure backplane settings
 * 3. Trigger DXF export and capture the file
 * 4. Run ezdxf comparison via Python subprocess
 * 5. Assert accuracy metrics meet thresholds
 */
import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ROOT = process.cwd()
const REFERENCE_DXF = path.resolve(PROJECT_ROOT, 'examples/CNC_FILE_105_12MM.dxf')
const VENV_PYTHON = path.resolve(PROJECT_ROOT, '.venv/Scripts/python.exe')
const COMPARE_SCRIPT = path.resolve(PROJECT_ROOT, 'tests/compare_dxf.py')

test.describe('DXF Export Accuracy', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173/')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000) // let 3D render settle
    })

    test('generates a DXF file with ryb profiles', async ({ page }) => {
        // Open export modal
        const exportBtn = page.getByRole('button', { name: 'Export & Order' })
        await exportBtn.click()
        await page.waitForTimeout(500)

        // Set up download listener
        const downloadPromise = page.waitForEvent('download')

        // Click DXF download
        const dxfBtn = page.locator('button', { hasText: /DXF/ })
        await dxfBtn.click()

        const download = await downloadPromise
        const downloadPath = path.join(PROJECT_ROOT, 'test-output', `generated-${Date.now()}.dxf`)
        fs.mkdirSync(path.dirname(downloadPath), { recursive: true })
        await download.saveAs(downloadPath)

        // Verify the file exists and has content
        expect(fs.existsSync(downloadPath)).toBeTruthy()
        const stat = fs.statSync(downloadPath)
        expect(stat.size).toBeGreaterThan(100) // DXF should have some content
    })

    test('DXF contains backplane with dogbone slots', async ({ page }) => {
        // Ensure backplane is enabled
        const bpCheckbox = page.locator('label:has-text("Enable Backplane") >> input[type="checkbox"]')
        if (!(await bpCheckbox.isChecked())) {
            await bpCheckbox.click()
        }

        // Open export modal
        const exportBtn = page.getByRole('button', { name: 'Export & Order' })
        await exportBtn.click()
        await page.waitForTimeout(500)

        // Download DXF
        const downloadPromise = page.waitForEvent('download')
        const dxfBtn = page.locator('button', { hasText: /DXF/ })
        await dxfBtn.click()

        const download = await downloadPromise
        const downloadPath = path.join(PROJECT_ROOT, 'test-output', `backplane-${Date.now()}.dxf`)
        fs.mkdirSync(path.dirname(downloadPath), { recursive: true })
        await download.saveAs(downloadPath)

        // Run ezdxf comparison
        const result = execSync(
            `"${VENV_PYTHON}" "${COMPARE_SCRIPT}" "${downloadPath}" "${REFERENCE_DXF}"`,
            { encoding: 'utf-8', timeout: 30000 }
        )
        const metrics = JSON.parse(result)

        console.log('DXF Comparison Metrics:')
        console.log(JSON.stringify(metrics, null, 2))

        // Assertions — first pass targets
        expect(metrics.ryb_count_generated).toBeGreaterThan(0)
        expect(metrics.slot_count_generated).toBeGreaterThan(0)
        expect(metrics.has_backplane_generated || metrics.slot_count_generated > 0).toBeTruthy()
    })

    test('DXF accuracy score >= 80%', async ({ page }) => {
        test.setTimeout(90000) // Heavy DXF generation takes longer

        // Configure to match reference: high ryb count, backplane enabled, 105 inches long
        // Set shelf dimensions
        const lenInput = page.locator('label').filter({ hasText: 'Length' }).locator('..').locator('input').first()
        await lenInput.fill('105')

        const heightInput = page.locator('label').filter({ hasText: 'Wave Height' }).locator('..').locator('input').first()
        await heightInput.fill('12')

        // Set ryb count to 100 (close to the ~100 in reference)
        const rybCountSlider = page.locator('label').filter({ hasText: 'Ryb Count' }).locator('..').locator('input[type="range"]')
        await rybCountSlider.fill('100')

        // Ensure backplane enabled
        const bpCheckbox = page.locator('label:has-text("Enable Backplane") >> input[type="checkbox"]')
        if (!(await bpCheckbox.isChecked())) {
            await bpCheckbox.click()
        }

        // Set to organic shape
        const shapeSelect = page.locator('h3:has-text("Backplane")').locator('..').locator('select')
        await shapeSelect.selectOption('organic')

        // Export DXF
        const exportBtn = page.getByRole('button', { name: 'Export & Order' })
        await exportBtn.waitFor({ state: 'visible', timeout: 15000 })
        await exportBtn.click()
        await page.waitForTimeout(500)

        const downloadPromise = page.waitForEvent('download')
        const dxfBtn = page.locator('button', { hasText: /DXF/ })
        await dxfBtn.click()

        const download = await downloadPromise
        const downloadPath = path.join(PROJECT_ROOT, 'test-output', `accuracy-${Date.now()}.dxf`)
        fs.mkdirSync(path.dirname(downloadPath), { recursive: true })
        await download.saveAs(downloadPath)

        // Run comparison
        const result = execSync(
            `"${VENV_PYTHON}" "${COMPARE_SCRIPT}" "${downloadPath}" "${REFERENCE_DXF}"`,
            { encoding: 'utf-8', timeout: 30000 }
        )
        const metrics = JSON.parse(result)

        console.log('=== DXF ACCURACY TEST ===')
        console.log(`Overall score: ${metrics.overall_score}%`)
        console.log(`Rybs: ${metrics.ryb_count_generated} generated vs ${metrics.ryb_count_reference} reference`)
        console.log(`Slots: ${metrics.slot_count_generated} generated vs ${metrics.slot_count_reference} reference`)
        console.log(`Backplane: generated=${metrics.has_backplane_generated} reference=${metrics.has_backplane_reference}`)
        console.log(JSON.stringify(metrics, null, 2))

        // The overall score target
        expect(metrics.overall_score).toBeGreaterThanOrEqual(90) // Target is 90%+ now that organic shape and tabs are added
        expect(metrics.ryb_count_generated).toBeGreaterThanOrEqual(10)
        expect(metrics.slot_count_generated).toBeGreaterThanOrEqual(10)
    })
})

test.describe('Backplane UI', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173/')
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)
    })

    test('backplane card shows with enable checkbox', async ({ page }) => {
        const card = page.locator('h3:has-text("Backplane")')
        await expect(card).toBeVisible()

        const checkbox = page.locator('label:has-text("Enable Backplane") >> input[type="checkbox"]')
        await expect(checkbox).toBeVisible()
        await expect(checkbox).toBeChecked() // default enabled
    })

    test('backplane controls appear when enabled', async ({ page }) => {
        const thicknessLabel = page.locator('text=Material Thickness')
        await expect(thicknessLabel).toBeVisible()

        const slotDepthLabel = page.locator('text=Slot Depth')
        await expect(slotDepthLabel).toBeVisible()

        const dogboneLabel = page.locator('text=Dogbone Radius')
        await expect(dogboneLabel).toBeVisible()
    })

    test('disabling backplane hides controls', async ({ page }) => {
        const checkbox = page.locator('label:has-text("Enable Backplane") >> input[type="checkbox"]')
        await checkbox.uncheck()
        await page.waitForTimeout(300)

        const thicknessLabel = page.locator('text=Material Thickness')
        await expect(thicknessLabel).not.toBeVisible()
    })

    test('ryb count slider goes up to 200', async ({ page }) => {
        const rybSlider = page.locator('label:has-text("Ryb Count") + input[type="range"]')
        const max = await rybSlider.getAttribute('max')
        expect(max).toBe('200')
    })
})
