/**
 * Backplane module — generates backplane profile, slots with dogbone fillets,
 * and CNC-quality DXF export using makerjs.
 */
import makerjs from 'makerjs'

// ── Types ──────────────────────────────────────────────────────────────

export type BackplaneShape = 'rectangular' | 'organic'

export interface BackplaneParams {
    enabled: boolean
    shape: BackplaneShape
    organicOffset: number
    materialThickness: number   // mm — slot width matches this
    slotDepth: number           // mm — how deep ryb slots into backplane
    dogboneRadius: number       // mm — radius of semicircular fillet at slot ends (typically materialThickness/2)
    autoSlots: boolean          // auto-generate slot at every ryb position
    manualSlotPositions: number[] // manual override positions (0-1 along path)
}

export interface SlotDef {
    x: number           // center X position on backplane
    y: number           // center Y position on backplane
    width: number       // slot width (= materialThickness)
    height: number      // slot height (= ryb profile width at this position)
    rotation: number    // rotation in degrees
}

export const DEFAULT_BACKPLANE: BackplaneParams = {
    enabled: true,
    shape: 'rectangular',
    organicOffset: 0,
    materialThickness: 12,
    slotDepth: 60,
    dogboneRadius: 6.5,   // slightly > materialThickness/2 for CNC bit clearance
    autoSlots: true,
    manualSlotPositions: [],
}

// ── Slot generation ────────────────────────────────────────────────────

/**
 * Generate slot definitions from ryb positions along the wave path.
 */
export function generateSlots(
    rybPositions: { x: number; y: number; angle: number }[],
    rybWidths: number[],
    materialThickness: number,
): SlotDef[] {
    return rybPositions.map((pos, i) => ({
        x: pos.x,
        y: pos.y,
        width: materialThickness,
        height: rybWidths[i] || 60,
        rotation: (pos.angle * 180) / Math.PI,
    }))
}

// ── Makerjs model generation ───────────────────────────────────────────

/**
 * Create a single slot shape with dogbone fillets at each end.
 * The slot is a rectangle with semicircular bulges at each short end.
 */
function createDogboneSlot(width: number, height: number, dogboneRadius: number): makerjs.IModel {
    // The slot body is a rectangle
    const halfW = width / 2
    const halfH = height / 2

    // Rectangle corners
    const paths: Record<string, makerjs.IPath> = {}

    // Left side lines
    paths.topLeft = new makerjs.paths.Line([- halfW, halfH - dogboneRadius], [-halfW, -halfH + dogboneRadius])
    paths.bottomLeft = new makerjs.paths.Line([halfW, -halfH + dogboneRadius], [halfW, halfH - dogboneRadius])

    // Top edge (short side)
    paths.top = new makerjs.paths.Line([-halfW, halfH - dogboneRadius], [halfW, halfH - dogboneRadius])

    // Bottom edge (short side)
    paths.bottom = new makerjs.paths.Line([halfW, -halfH + dogboneRadius], [-halfW, -halfH + dogboneRadius])

    // Dogbone arcs at each end (semicircles)
    // Top dogbone
    paths.topDogbone = new makerjs.paths.Arc(
        [0, halfH - dogboneRadius], // center
        dogboneRadius,
        0, 180 // semicircle on the top
    )

    // Bottom dogbone
    paths.bottomDogbone = new makerjs.paths.Arc(
        [0, -halfH + dogboneRadius], // center
        dogboneRadius,
        180, 360 // semicircle on the bottom
    )

    return { paths }
}

/**
 * Create a simplified slot (rectangle with semicircle ends = stadium/discorectangle shape).
 * This matches the reference DXF where bulge=-1 means perfect semicircle.
 */
export function createSlotWithDogbone(width: number, height: number): makerjs.IModel {
    // Stadium shape: rectangle body with semicircle caps
    const r = width / 2 // radius = half the slot width (material thickness)
    const bodyH = height - width // body height minus the two semicircle radii

    if (bodyH <= 0) {
        // If height <= width, just a circle
        return { paths: { circle: new makerjs.paths.Circle([0, 0], r) } }
    }

    const halfBody = bodyH / 2
    const paths: Record<string, makerjs.IPath> = {
        topArc: new makerjs.paths.Arc([0, halfBody], r, 0, 180),
        left: new makerjs.paths.Line([-r, halfBody], [-r, -halfBody]),
        bottomArc: new makerjs.paths.Arc([0, -halfBody], r, 180, 360),
        right: new makerjs.paths.Line([r, -halfBody], [r, halfBody]),
    }

    return { paths }
}

// ── Backplane outline ──────────────────────────────────────────────────

/**
 * Generate a rectangular backplane outline with rounded corners
 * sized to fit the wave's amplitude.
 */
export function createBackplaneOutline(
    width: number,
    height: number,
    cornerRadius: number = 12,
): makerjs.IModel {
    // We use ConnectTheDots instead of Rectangle to guarantee it exports as a single closed
    // polyline in DXF so that the area calculation metrics recognize it as the backplane.
    return new makerjs.models.ConnectTheDots(true, [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
    ])
}

/**
 * Generate an organic backplane outline that follows the wave path smoothly.
 */
export function createOrganicBackplaneOutline(
    rybPositions: { x: number; y: number }[],
    maxRybHeight: number,
    organicOffset: number
): makerjs.IModel {
    const points: number[][] = []

    // Top curve
    for (let i = 0; i < rybPositions.length; i++) {
        const p = rybPositions[i]
        points.push([p.x, p.y + maxRybHeight / 2 + organicOffset])
    }
    // Bottom curve
    for (let i = rybPositions.length - 1; i >= 0; i--) {
        const p = rybPositions[i]
        points.push([p.x, p.y - maxRybHeight / 2 - organicOffset])
    }

    return new makerjs.models.ConnectTheDots(true, points)
}

/**
 * Very simple stroke font for numbers 0-9
 */
function createTextModel(text: string, scale: number = 1): makerjs.IModel {
    const DIGITS: Record<string, number[][]> = {
        '0': [[0, 0], [1, 0], [1, 2], [0, 2], [0, 0]],
        '1': [[0.5, 0], [0.5, 2]],
        '2': [[0, 2], [1, 2], [1, 1], [0, 1], [0, 0], [1, 0]],
        '3': [[0, 2], [1, 2], [1, 1], [0, 1], [1, 1], [1, 0], [0, 0]],
        '4': [[0, 2], [0, 1], [1, 1], [1, 2], [1, 0]],
        '5': [[1, 2], [0, 2], [0, 1], [1, 1], [1, 0], [0, 0]],
        '6': [[1, 2], [0, 2], [0, 0], [1, 0], [1, 1], [0, 1]],
        '7': [[0, 2], [1, 2], [1, 0]],
        '8': [[0, 0], [1, 0], [1, 2], [0, 2], [0, 0], [0, 1], [1, 1]],
        '9': [[1, 0], [1, 2], [0, 2], [0, 1], [1, 1]],
    }
    const models: Record<string, makerjs.IModel> = {}
    let curX = 0
    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        const pts = DIGITS[char]
        if (pts) {
            const paths: Record<string, makerjs.IPath> = {}
            for (let j = 0; j < pts.length - 1; j++) {
                paths[`l_${j}`] = new makerjs.paths.Line(
                    [pts[j][0] * scale + curX, pts[j][1] * scale],
                    [pts[j + 1][0] * scale + curX, pts[j + 1][1] * scale]
                )
            }
            models[`char_${i}`] = { paths }
        }
        curX += 1.5 * scale
    }
    return { models }
}

// ── Full CNC sheet layout ──────────────────────────────────────────────

export interface CncSheetLayout {
    sheets: makerjs.IModel[]
    sheetCount: number
}

export function generateCncLayout(
    rybProfiles: { width: number; height: number; shape: string; freeformPts?: { x: number, y: number }[] }[],
    backplaneParams: BackplaneParams,
    rybPositions: { x: number; y: number }[], // The actual wave path points where rybs sit
): makerjs.IModel {
    const SHEET_W = 1220
    const SHEET_H = 2440
    const PADDING = 15

    const models: Record<string, makerjs.IModel> = {}
    let modelIdx = 0
    let sheetCount = 0

    function addSheet() {
        // Use ConnectTheDots instead of Rectangle so it stays a closed single entity
        const sheet = new makerjs.models.ConnectTheDots(true, [
            [0, 0], [SHEET_W, 0], [SHEET_W, SHEET_H], [0, SHEET_H]
        ])
        makerjs.model.move(sheet, [0, sheetCount * (SHEET_H + 50)])
        models[`sheet_${modelIdx++}`] = sheet
        sheetCount++
    }

    addSheet()

    // Current packing position
    let curX = PADDING
    let curY = PADDING + (sheetCount - 1) * (SHEET_H + 50)
    let rowHeight = 0

    // Place each ryb profile on the sheet(s)
    for (let i = 0; i < rybProfiles.length; i++) {
        const profile = rybProfiles[i]
        const w = profile.width
        const h = profile.height

        // Check if we need to advance to next row
        if (curX + w + PADDING > SHEET_W) {
            curX = PADDING
            curY += rowHeight + PADDING
            rowHeight = 0

            // Check if we need to advance to next sheet
            if (curY + h + PADDING > sheetCount * (SHEET_H + 50)) {
                addSheet()
                curY = PADDING + (sheetCount - 1) * (SHEET_H + 50)
            }
        }

        // Create the ryb shape
        let rybModel: makerjs.IModel
        const hasTab = backplaneParams.enabled
        const tw = backplaneParams.materialThickness
        const th = backplaneParams.slotDepth

        if (profile.shape === 'circle') {
            rybModel = new makerjs.models.Ellipse(w / 2, h / 2)
            makerjs.model.move(rybModel, [w / 2, h / 2])
        } else if (profile.shape === 'freeform' && profile.freeformPts && profile.freeformPts.length > 2) {
            const fpts = profile.freeformPts
            const minX = Math.min(...fpts.map(p => p.x)), maxX = Math.max(...fpts.map(p => p.x))
            const minY = Math.min(...fpts.map(p => p.y)), maxY = Math.max(...fpts.map(p => p.y))
            const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1
            const scaledPts: [number, number][] = fpts.map(p => [
                ((p.x - minX) / rangeX) * w,
                ((p.y - minY) / rangeY) * h
            ])
            const paths: Record<string, makerjs.IPath> = {}
            for (let j = 0; j < scaledPts.length; j++) {
                paths[`l_${j}`] = new makerjs.paths.Line(scaledPts[j], scaledPts[(j + 1) % scaledPts.length])
            }
            rybModel = { paths }
        } else {
            if (hasTab) {
                const ty1 = h / 2 - th / 2
                const ty2 = h / 2 + th / 2
                rybModel = new makerjs.models.ConnectTheDots(true, [
                    [0, 0], [w, 0], [w, h], [0, h],
                    [0, ty2], [-tw, ty2], [-tw, ty1], [0, ty1]
                ])
            } else {
                rybModel = new makerjs.models.ConnectTheDots(true, [
                    [0, 0], [w, 0], [w, h], [0, h]
                ])
            }
        }

        if (hasTab && (profile.shape === 'circle' || profile.shape === 'freeform')) {
            const tab = new makerjs.models.Rectangle(tw + 1, th) // +1 for overlap to ensure clean union
            makerjs.model.move(tab, [-tw, h / 2 - th / 2])
            makerjs.model.combineUnion(rybModel, tab)
            rybModel = { models: { base: rybModel, tab } }
        }

        const rybGroup = { models: { outline: rybModel } }

        // Measure true bounds (including tab and freeform offsets) to pack accurately
        const bbox = makerjs.measure.modelExtents(rybGroup)

        // Position it such that the bottom-left of the bounding box is at [curX, curY]
        makerjs.model.moveRelative(rybGroup, [curX - (bbox?.low?.[0] ?? 0), curY - (bbox?.low?.[1] ?? 0)])
        models[`ryb_${modelIdx++}`] = rybGroup

        curX += ((bbox?.high?.[0] ?? w) - (bbox?.low?.[0] ?? 0)) + PADDING
        rowHeight = Math.max(rowHeight, h)
    }

    // Place backplane with slots if enabled
    if (backplaneParams.enabled && rybPositions.length > 0) {
        // Calculate bounds of wave
        const pathXs = rybPositions.map(p => p.x)
        const pathYs = rybPositions.map(p => p.y)
        const waveMinX = Math.min(...pathXs)
        const waveMaxX = Math.max(...pathXs)
        const waveMinY = Math.min(...pathYs)
        const waveMaxY = Math.max(...pathYs)

        const waveWidth = waveMaxX - waveMinX
        const waveAmp = waveMaxY - waveMinY

        let bpGroup: makerjs.IModel
        let bpHeightTotal: number

        const slotW = backplaneParams.materialThickness
        const slotH = backplaneParams.slotDepth

        if (backplaneParams.shape === 'organic') {
            const maxRybHeight = Math.max(...rybProfiles.map(p => p.height))
            bpHeightTotal = maxRybHeight + (backplaneParams.organicOffset * 2)

            curX = PADDING
            curY += rowHeight + PADDING * 2

            if (curY + bpHeightTotal + PADDING > sheetCount * (SHEET_H + 50)) {
                addSheet()
                curY = PADDING + (sheetCount - 1) * (SHEET_H + 50)
            }

            const bpOutline = createOrganicBackplaneOutline(rybPositions, maxRybHeight, backplaneParams.organicOffset)
            const bpGroupModels: Record<string, makerjs.IModel> = { outline: bpOutline }

            let slotIdx = 0
            for (let i = 0; i < rybPositions.length; i++) {
                const pos = rybPositions[i]
                const slotModel = createSlotWithDogbone(slotW, slotH)
                makerjs.model.move(slotModel, [pos.x, pos.y])
                bpGroupModels[`slot_${slotIdx}`] = slotModel
                slotIdx++
            }

            bpGroup = { models: bpGroupModels }
            // Move so the minimum X/Y maps to the current sheet padding position
            const offsetX = PADDING - waveMinX + (maxRybHeight / 2) + backplaneParams.organicOffset
            const offsetY = curY - waveMinY + (maxRybHeight / 2) + backplaneParams.organicOffset
            makerjs.model.move(bpGroup, [offsetX, offsetY])

        } else {
            // Rectangular fallback
            const bpWidth = Math.min(waveWidth + 40, SHEET_W - 2 * PADDING)
            const bpHeight = Math.min(Math.max(waveAmp + 300, 500), SHEET_H - curY - PADDING * 2)
            bpHeightTotal = bpHeight

            curX = PADDING
            curY += rowHeight + PADDING * 2

            if (curY + bpHeightTotal + PADDING > sheetCount * (SHEET_H + 50)) {
                addSheet()
                curY = PADDING + (sheetCount - 1) * (SHEET_H + 50)
            }

            const bpOutline = createBackplaneOutline(bpWidth, bpHeightTotal, 12)
            const bpGroupModels: Record<string, makerjs.IModel> = { outline: bpOutline }

            let slotIdx = 0
            for (let i = 0; i < rybPositions.length; i++) {
                const pos = rybPositions[i]
                const slotModel = createSlotWithDogbone(slotW, slotH)

                // Map the slot's wave position into the backplane rectangle
                const sx = 20 + ((pos.x - waveMinX) / (waveWidth || 1)) * (bpWidth - 40)
                const sy = (bpHeightTotal / 2) + (pos.y - ((waveMaxY + waveMinY) / 2))

                makerjs.model.move(slotModel, [sx, sy])
                bpGroupModels[`slot_${slotIdx}`] = slotModel
                slotIdx++
            }

            bpGroup = { models: bpGroupModels }
            makerjs.model.move(bpGroup, [curX, curY])
        }

        models[`backplane`] = bpGroup
        curY += bpHeightTotal + PADDING
    }

    return { models }
}

// ── DXF export ─────────────────────────────────────────────────────────

/**
 * Export a makerjs model to DXF string.
 */
export function exportToDxf(model: makerjs.IModel): string {
    return makerjs.exporter.toDXF(model)
}

/**
 * Export a makerjs model to SVG string.
 */
export function exportToSvg(model: makerjs.IModel, options?: makerjs.exporter.ISVGRenderOptions): string {
    return makerjs.exporter.toSVG(model, options)
}
