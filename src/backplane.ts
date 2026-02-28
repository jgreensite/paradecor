/**
 * Backplane module — generates backplane profile, slots with dogbone fillets,
 * and CNC-quality DXF export using makerjs.
 */
import makerjs from 'makerjs'

// ── Types ──────────────────────────────────────────────────────────────

export interface BackplaneParams {
    enabled: boolean
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
        left: new makerjs.paths.Line([-r, -halfBody], [-r, halfBody]),
        right: new makerjs.paths.Line([r, halfBody], [r, -halfBody]),
        topArc: new makerjs.paths.Arc([0, halfBody], r, 0, 180),
        bottomArc: new makerjs.paths.Arc([0, -halfBody], r, 180, 360),
    }

    return { paths }
}

// ── Backplane outline ──────────────────────────────────────────────────

/**
 * Generate a rectangular backplane outline with rounded corners.
 */
export function createBackplaneOutline(
    width: number,
    height: number,
    cornerRadius: number = 12,
): makerjs.IModel {
    return new makerjs.models.RoundRectangle(width, height, cornerRadius)
}

// ── Full CNC sheet layout ──────────────────────────────────────────────

export interface CncSheetLayout {
    sheets: makerjs.IModel[]
    sheetCount: number
}

/**
 * Generate a complete CNC cut file model with ryb profiles + backplane + slots
 * laid out on standard 1220×2440mm sheets.
 */
export function generateCncLayout(
    rybProfiles: { width: number; height: number; shape: string }[],
    backplaneParams: BackplaneParams,
    wavePath: { x: number; y: number }[],
    slotDefs: SlotDef[],
): makerjs.IModel {
    const SHEET_W = 1220
    const SHEET_H = 2440
    const PADDING = 15

    const models: Record<string, makerjs.IModel> = {}
    let modelIdx = 0

    // Current packing position
    let curX = PADDING
    let curY = PADDING
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
        }

        // Create the ryb shape
        let rybModel: makerjs.IModel
        if (profile.shape === 'circle') {
            rybModel = new makerjs.models.Ellipse(w / 2, h / 2)
        } else {
            rybModel = new makerjs.models.Rectangle(w, h)
        }

        // Position it
        makerjs.model.move(rybModel, [curX, curY])
        models[`ryb_${modelIdx++}`] = rybModel

        // Add label
        curX += w + PADDING
        rowHeight = Math.max(rowHeight, h)
    }

    // Place backplane with slots if enabled
    if (backplaneParams.enabled && slotDefs.length > 0) {
        // Compute backplane size from wave path extents
        const pathXs = wavePath.map(p => p.x)
        const pathYs = wavePath.map(p => p.y)
        const bpWidth = (Math.max(...pathXs) - Math.min(...pathXs)) + 2 * PADDING
        const bpHeight = (Math.max(...pathYs) - Math.min(...pathYs)) + 2 * PADDING + 120

        // Place backplane on a new row
        curX = PADDING
        curY += rowHeight + PADDING * 2
        rowHeight = 0

        // Backplane outline
        const bpOutline = createBackplaneOutline(bpWidth, Math.min(bpHeight, SHEET_H - curY - PADDING))
        makerjs.model.move(bpOutline, [curX, curY])
        models[`backplane_outline_${modelIdx++}`] = bpOutline

        // Add slots as subtractive shapes
        for (let s = 0; s < slotDefs.length; s++) {
            const slot = slotDefs[s]
            const slotModel = createSlotWithDogbone(slot.width, slot.height)

            // Position relative to backplane origin
            const slotX = curX + PADDING + slot.x - Math.min(...pathXs)
            const slotY = curY + PADDING + 60 + slot.y - Math.min(...pathYs)

            makerjs.model.move(slotModel, [slotX, slotY])
            if (slot.rotation !== 0) {
                makerjs.model.rotate(slotModel, slot.rotation, [slotX, slotY])
            }
            models[`slot_${modelIdx++}`] = slotModel
        }
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
