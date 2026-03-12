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
 * Compute the 2D projected dimensions of a rotated 3D tab onto the backplane.
 */
export function computeProjectedSlotDimensions(profile: { rotateX?: number; rotateY?: number; rotateZ?: number; thickness?: number }, tw: number, th: number) {
    const Rx = (profile.rotateX || 0) * Math.PI / 180
    const Ry = (profile.rotateY ?? -90) * Math.PI / 180
    const tz = profile.thickness || tw

    const w = tw * Math.abs(Math.cos(Ry)) + th * Math.abs(Math.sin(Rx) * Math.sin(Ry)) + tz * Math.abs(Math.cos(Rx) * Math.sin(Ry))
    const h = th * Math.abs(Math.cos(Rx)) + tz * Math.abs(Math.sin(Rx))
    const shiftX = (-tw / 2) * Math.cos(Ry)

    return { w, h, shiftX }
}

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
export function createSlotWithDogbone(width: number, height: number, dogboneRadius: number): makerjs.IModel {
    // Use true CNC dogbone fillets (circles cut out of the internal corners)
    // Style 0 (default) does all 4 corners.
    // If the slot is too small, fallback to a simple rectangle
    if (width <= dogboneRadius * 2 || height <= dogboneRadius * 2) {
        const m = new makerjs.models.Rectangle(width, height)
        makerjs.model.center(m)
        return m
    }
    const m = new makerjs.models.Dogbone(width, height, dogboneRadius, 0, false)
    makerjs.model.center(m)
    return m
}

/**
 * Create a simple vector number model (stick font style) to avoid needing external TTF fonts.
 */
export function createRybNumberModel(num: number, height: number): makerjs.IModel {
    const models: Record<string, makerjs.IModel> = {}
    const str = num.toString()
    const w = height * 0.6
    const spacing = height * 0.2
    let curX = 0

    for (let i = 0; i < str.length; i++) {
        const char = str[i]
        const paths: Record<string, makerjs.IPath> = {}
        const segments: number[][][] = []

        switch (char) {
            case '0': segments.push([[0, 0], [w, 0]], [[w, 0], [w, height]], [[w, height], [0, height]], [[0, height], [0, 0]]); break;
            case '1': segments.push([[w / 2, 0], [w / 2, height]], [[w / 4, height * 0.75], [w / 2, height]], [[w / 4, 0], [w * 0.75, 0]]); break;
            case '2': segments.push([[0, height], [w, height]], [[w, height], [w, height / 2]], [[w, height / 2], [0, height / 2]], [[0, height / 2], [0, 0]], [[0, 0], [w, 0]]); break;
            case '3': segments.push([[0, height], [w, height]], [[w, height], [w, 0]], [[w, 0], [0, 0]], [[0, height / 2], [w, height / 2]]); break;
            case '4': segments.push([[0, height], [0, height / 2]], [[0, height / 2], [w, height / 2]], [[w, height], [w, 0]]); break;
            case '5': segments.push([[w, height], [0, height]], [[0, height], [0, height / 2]], [[0, height / 2], [w, height / 2]], [[w, height / 2], [w, 0]], [[w, 0], [0, 0]]); break;
            case '6': segments.push([[w, height], [0, height]], [[0, height], [0, 0]], [[0, 0], [w, 0]], [[w, 0], [w, height / 2]], [[w, height / 2], [0, height / 2]]); break;
            case '7': segments.push([[0, height], [w, height]], [[w, height], [0, 0]]); break;
            case '8': segments.push([[0, 0], [w, 0]], [[w, 0], [w, height]], [[w, height], [0, height]], [[0, height], [0, 0]], [[0, height / 2], [w, height / 2]]); break;
            case '9': segments.push([[w, height / 2], [0, height / 2]], [[0, height / 2], [0, height]], [[0, height], [w, height]], [[w, height], [w, 0]]); break;
        }

        let lineIdx = 0
        for (const seg of segments) {
            paths[`l${lineIdx++}`] = new makerjs.paths.Line(seg[0], seg[1])
        }

        const charModel: makerjs.IModel = { paths }
        makerjs.model.move(charModel, [curX, 0])
        models[`char_${i}`] = charModel
        curX += w + spacing
    }

    const group = { models }
    makerjs.model.moveRelative(group, [-(curX - spacing) / 2, -height / 2])
    return group
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
    highResWavePath: { x: number; y: number }[],
    maxRybHeight: number,
    organicOffset: number
): makerjs.IModel {
    const points: number[][] = []

    // Top curve
    for (let i = 0; i < highResWavePath.length; i++) {
        const p = highResWavePath[i]
        points.push([p.x, p.y + maxRybHeight / 2 + organicOffset])
    }
    // Bottom curve
    for (let i = highResWavePath.length - 1; i >= 0; i--) {
        const p = highResWavePath[i]
        points.push([p.x, p.y - maxRybHeight / 2 - organicOffset])
    }

    return new makerjs.models.ConnectTheDots(true, points)
}

// ── Full CNC sheet layout ──────────────────────────────────────────────

export interface CncSheetLayout {
    sheets: makerjs.IModel[]
    sheetCount: number
}

export function generateCncLayout(
    rybProfiles: { width: number; height: number; shape: string; freeformPts?: { x: number, y: number }[]; rotateX?: number; rotateY?: number; rotateZ?: number; thickness?: number }[],
    backplaneParams: BackplaneParams,
    rybPositions: { x: number; y: number; angle?: number }[], // The actual wave path points where rybs sit
    highResWavePath?: { x: number; y: number }[] // Used explicitly to draw a smooth curve for the backplane outline
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
        let rybOutlineModel: makerjs.IModel
        const hasTab = backplaneParams.enabled
        const tw = backplaneParams.materialThickness
        const th = backplaneParams.slotDepth

        if (profile.shape === 'circle') {
            rybOutlineModel = new makerjs.models.Ellipse(w / 2, h / 2)
            makerjs.model.move(rybOutlineModel, [w / 2, h / 2])
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
            rybOutlineModel = { paths }
        } else {
            if (hasTab) {
                const ty1 = h / 2 - th / 2
                const ty2 = h / 2 + th / 2
                rybOutlineModel = new makerjs.models.ConnectTheDots(true, [
                    [0, 0], [w, 0], [w, h], [0, h],
                    [0, ty2], [-tw, ty2], [-tw, ty1], [0, ty1]
                ])
            } else {
                rybOutlineModel = new makerjs.models.ConnectTheDots(true, [
                    [0, 0], [w, 0], [w, h], [0, h]
                ])
            }
        }

        if (hasTab && (profile.shape === 'circle' || profile.shape === 'freeform')) {
            const tab = new makerjs.models.Rectangle(tw + 1, th) // +1 for overlap to ensure clean union
            makerjs.model.move(tab, [-tw, h / 2 - th / 2])
            makerjs.model.combineUnion(rybOutlineModel, tab)
        }

        // Create a new model to hold the outline and the number
        const rybModel: makerjs.IModel = {
            paths: rybOutlineModel.paths ? { ...rybOutlineModel.paths } : undefined,
            models: rybOutlineModel.models ? { ...rybOutlineModel.models } : undefined
        }

        // Add ryb numbering label
        const numModel = createRybNumberModel(i + 1, 15) // 15mm high text
        // We ensure `rybModel` has a models object to attach it to.
        rybModel.models = rybModel.models || {}
        rybModel.models.num = numModel

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

        // Slot base geometry is now computed dynamically per ryb based on its rotation

        if (backplaneParams.shape === 'organic') {
            const maxRybHeight = Math.max(...rybProfiles.map(p => p.height))
            bpHeightTotal = maxRybHeight + (backplaneParams.organicOffset * 2)

            curX = PADDING
            curY += rowHeight + PADDING * 2

            if (curY + bpHeightTotal + PADDING > sheetCount * (SHEET_H + 50)) {
                addSheet()
                curY = PADDING + (sheetCount - 1) * (SHEET_H + 50)
            }

            const outlinePath = highResWavePath || rybPositions;
            const bpOutline = createOrganicBackplaneOutline(outlinePath, maxRybHeight, backplaneParams.organicOffset)
            const bpGroupModels: Record<string, makerjs.IModel> = { outline: bpOutline }

            let slotIdx = 0
            for (let i = 0; i < rybPositions.length; i++) {
                const pos = rybPositions[i]
                const profile = rybProfiles[i]
                const { w, h, shiftX } = computeProjectedSlotDimensions(profile, backplaneParams.materialThickness, backplaneParams.slotDepth)

                const slotModel = createSlotWithDogbone(w, h, backplaneParams.dogboneRadius)
                makerjs.model.move(slotModel, [shiftX, 0])

                if (pos.angle !== undefined) {
                    makerjs.model.rotate(slotModel, pos.angle)
                }
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
                const profile = rybProfiles[i]
                const { w, h, shiftX } = computeProjectedSlotDimensions(profile, backplaneParams.materialThickness, backplaneParams.slotDepth)

                const slotModel = createSlotWithDogbone(w, h, backplaneParams.dogboneRadius)
                makerjs.model.move(slotModel, [shiftX, 0])

                if (pos.angle !== undefined) {
                    makerjs.model.rotate(slotModel, pos.angle)
                }

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

        // --- Backplane Extents & Auto-Rotation ---
        // If the backplane is wider than the sheet width but fits within the height, rotate 90 deg
        const bpBounds = makerjs.measure.modelExtents(bpGroup)
        if (bpBounds) {
            const bpW = bpBounds.high[0] - bpBounds.low[0]
            const bpH = bpBounds.high[1] - bpBounds.low[1]
            if (bpW > SHEET_W && bpW <= SHEET_H && bpH <= SHEET_W) {
                // Better fit if rotated
                makerjs.model.rotate(bpGroup, 90, [curX, curY]) // Rotate around its placement point
                // Note: rotating 90 deg pushes it left (negative x) and up (positive y)
                // Re-measure after rotation
                const newBounds = makerjs.measure.modelExtents(bpGroup)
                if (newBounds) {
                    makerjs.model.moveRelative(bpGroup, [curX - newBounds.low[0], curY - newBounds.low[1]])
                    curY += (newBounds.high[1] - newBounds.low[1]) + PADDING
                }
            } else {
                curY += bpH + PADDING
            }
        } else {
            curY += bpHeightTotal + PADDING
        }

        models[`backplane`] = bpGroup
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
