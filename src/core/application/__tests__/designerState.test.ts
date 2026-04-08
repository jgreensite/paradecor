/**
 * RYB-096 / RYB-111: Visual Editor Hook Binding Integration Tests
 *
 * RYB-096 established the test specification (locked behaviour of pure functions).
 * RYB-111 confirmed 54/73 new tests passing.
 * RYB-112 extracted those functions into src/hooks/useDesignerState.ts.
 *
 * This file now imports the REAL implementations so any regression introduced
 * during future refactoring (RYB-113, RYB-114) will be caught immediately.
 *
 * Test coverage areas:
 *  1. Unit conversion pipeline   (toMM, toPhysical)
 *  2. Global unit change         (atomic DimensionUnit batch convert)
 *  3. Wave path generation       (generateWavePath)
 *  4. Transform interpolation    (interpolateTransform)
 *  5. Axis dimension helpers     (createAxisDimension, updateAxisDimension*)
 *  6. Bounding box contracts     (calculateShelfBoundingBox, calculateRibBoundingBox)
 *  7. Sheet calculation          (calculateSheetsNeeded)
 *  8. Keyframe↔shelf mapping    (keyframeToShelfIndex — pure spec)
 *  9. Custom ryb curve pipeline  (getCurvePoints, getAllPointsFromRyb)
 * 10. End-to-end snapshot        (wave→rib pipeline invariants)
 */

import { describe, it, expect } from 'vitest'
import type { DimensionUnit, AxisDimension, ShelfParams, RibSizeTransform, CustomRyb, CurveSegment } from '../../../core/domain/types'
import {
  MM_PER_INCH,
  toMM,
  toPhysical,
  createAxisDimension,
  updateAxisDimensionFromPhysical,
  updateAxisDimensionFromFactor,
  generateWavePath,
  interpolateTransform,
  calculateSheetsNeeded,
  DEFAULT_SHELF_PARAMS,
} from '../../../hooks/useDesignerState'

// ─── Bounding box helpers (still pure, tested inline) ─────────────────────────
// These drive camera positioning (ZoomToFit) — locked separately until extracted.

function calculateShelfBoundingBox(params: ShelfParams) {
  const lengthMM = toMM(params.length)
  const waveHeightMM = toMM(params.height)
  const ribDepthMM = toMM(params.ribDepth)
  const waveAmplitude = params.waveHeight * 10
  const totalHeight = waveHeightMM + waveAmplitude
  return { width: lengthMM, height: totalHeight, depth: ribDepthMM }
}

function calculateRibBoundingBox(params: ShelfParams) {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor
  return { width: widthMM, height: heightMM, depth: depthMM }
}

// ─── Curve pipeline (still in App.tsx — locked until RYB-114) ─────────────────

function getCurvePoints(segment: CurveSegment, resolution = 20): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  if (segment.type === 'line') {
    points.push(segment.start, segment.end)
  } else if (segment.type === 'bezier' && segment.control1 && segment.control2) {
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution
      const x =
        Math.pow(1 - t, 3) * segment.start.x +
        3 * Math.pow(1 - t, 2) * t * segment.control1.x +
        3 * (1 - t) * Math.pow(t, 2) * segment.control2.x +
        Math.pow(t, 3) * segment.end.x
      const y =
        Math.pow(1 - t, 3) * segment.start.y +
        3 * Math.pow(1 - t, 2) * t * segment.control1.y +
        3 * (1 - t) * Math.pow(t, 2) * segment.control2.y +
        Math.pow(t, 3) * segment.end.y
      points.push({ x, y })
    }
  }
  return points
}

function getAllPointsFromRyb(ryb: CustomRyb): { x: number; y: number }[] {
  const allPoints: { x: number; y: number }[] = []
  ryb.segments.forEach(seg => { allPoints.push(...getCurvePoints(seg)) })
  return allPoints
}

/** Pure keyframe→shelf index function matching the useCallback in App.tsx */
function keyframeToShelfIndex(keyframeIdx: number, keyframeCount: number, ribCount: number): number | undefined {
  if (keyframeCount <= 1) return undefined
  if (ribCount <= 1) return 0
  const t = keyframeIdx / (keyframeCount - 1)
  return Math.round(t * (ribCount - 1))
}

/** Pure batch-convert for global unit change — mirrors handleGlobalUnitChange body */
function applyGlobalUnitChange(params: ShelfParams, newUnit: 'mm' | 'in'): ShelfParams {
  const convert = (dim: DimensionUnit): DimensionUnit => {
    if (dim.unit === newUnit) return dim
    return {
      value: newUnit === 'mm' ? dim.value * MM_PER_INCH : dim.value / MM_PER_INCH,
      unit: newUnit,
    }
  }
  return {
    ...params,
    length: convert(params.length),
    height: convert(params.height),
    ribDepth: convert(params.ribDepth),
    materialThickness: convert(params.materialThickness),
    ribSize: convert(params.ribSize),
    ribX: { ...params.ribX, physical: convert(params.ribX.physical) },
    ribY: { ...params.ribY, physical: convert(params.ribY.physical) },
    ribZ: { ...params.ribZ, physical: convert(params.ribZ.physical) },
  }
}

// Re-use the authoritative default fixture from the hook
const DEFAULT_PARAMS = DEFAULT_SHELF_PARAMS

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unit Conversion Pipeline
// ─────────────────────────────────────────────────────────────────────────────
describe('Unit conversion pipeline', () => {
  it('toMM: passes mm values through unchanged', () => {
    expect(toMM({ value: 100, unit: 'mm' })).toBe(100)
  })

  it('toMM: converts inches to mm using 25.4 factor', () => {
    expect(toMM({ value: 1, unit: 'in' })).toBeCloseTo(25.4)
    expect(toMM({ value: 12, unit: 'in' })).toBeCloseTo(304.8)
  })

  it('toPhysical: converts mm back to inches', () => {
    expect(toPhysical(25.4, 'in')).toBeCloseTo(1)
    expect(toPhysical(100, 'mm')).toBe(100)
  })

  it('toMM/toPhysical: round-trip is lossless', () => {
    const original = 7.5
    const mm = original * MM_PER_INCH
    expect(toPhysical(mm, 'in')).toBeCloseTo(original, 10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Global Unit Change — Atomic State Transition
// ─────────────────────────────────────────────────────────────────────────────
describe('Global unit change — atomic params transformation', () => {
  it('converts all DimensionUnit fields when switching in → mm', () => {
    const result = applyGlobalUnitChange(DEFAULT_PARAMS, 'mm')
    expect(result.length.unit).toBe('mm')
    expect(result.length.value).toBeCloseTo(48 * MM_PER_INCH)
    expect(result.height.unit).toBe('mm')
    expect(result.height.value).toBeCloseTo(24 * MM_PER_INCH)
    expect(result.ribDepth.unit).toBe('mm')
    expect(result.materialThickness.unit).toBe('mm')
    expect(result.ribX.physical.unit).toBe('mm')
    expect(result.ribY.physical.unit).toBe('mm')
    expect(result.ribZ.physical.unit).toBe('mm')
  })

  it('does NOT convert already-matching unit fields', () => {
    const result = applyGlobalUnitChange(DEFAULT_PARAMS, 'mm')
    expect(result.ribX.physical.value).toBeCloseTo(DEFAULT_PARAMS.ribX.physical.value)
    expect(result.ribY.physical.value).toBeCloseTo(DEFAULT_PARAMS.ribY.physical.value)
  })

  it('idempotent: converting mm→mm leaves params unchanged', () => {
    const mmParams = applyGlobalUnitChange(DEFAULT_PARAMS, 'mm')
    const again = applyGlobalUnitChange(mmParams, 'mm')
    expect(again.length.value).toBeCloseTo(mmParams.length.value)
  })

  it('round-trip in→mm→in restores original values', () => {
    const asMm = applyGlobalUnitChange(DEFAULT_PARAMS, 'mm')
    const backToIn = applyGlobalUnitChange(asMm, 'in')
    expect(backToIn.length.value).toBeCloseTo(DEFAULT_PARAMS.length.value, 8)
    expect(backToIn.height.value).toBeCloseTo(DEFAULT_PARAMS.height.value, 8)
    expect(backToIn.ribDepth.value).toBeCloseTo(DEFAULT_PARAMS.ribDepth.value, 8)
    expect(backToIn.materialThickness.value).toBeCloseTo(DEFAULT_PARAMS.materialThickness.value, 8)
  })

  it('non-DimensionUnit fields are preserved unchanged', () => {
    const result = applyGlobalUnitChange(DEFAULT_PARAMS, 'mm')
    expect(result.ribCount).toBe(DEFAULT_PARAMS.ribCount)
    expect(result.waveHeight).toBe(DEFAULT_PARAMS.waveHeight)
    expect(result.waveFrequency).toBe(DEFAULT_PARAMS.waveFrequency)
    expect(result.ribShape).toBe(DEFAULT_PARAMS.ribShape)
    expect(result.ribRotateX).toBe(DEFAULT_PARAMS.ribRotateX)
    expect(result.flatEdge).toBe(DEFAULT_PARAMS.flatEdge)
    expect(result.backplaneEnabled).toBe(DEFAULT_PARAMS.backplaneEnabled)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Wave Path Generation
// ─────────────────────────────────────────────────────────────────────────────
describe('generateWavePath', () => {
  it('returns ribCount+1 points', () => {
    const path = generateWavePath(1200, 600, 2, 1.5, 10)
    expect(path).toHaveLength(11)
  })

  it('first point x is at -lengthMM/2', () => {
    const path = generateWavePath(1000, 500, 2, 1.5, 8)
    expect(path[0].x).toBeCloseTo(-500)
  })

  it('last point x is approximately +lengthMM/2', () => {
    const path = generateWavePath(1000, 500, 2, 1.5, 8)
    expect(path[path.length - 1].x).toBeCloseTo(500)
  })

  it('waveHeight=0 produces a flat path (all y=0)', () => {
    const path = generateWavePath(1200, 600, 0, 1.5, 10)
    path.forEach(p => expect(p.y).toBeCloseTo(0))
  })

  it('waveFrequency=0 produces a flat path (sin(0)=0)', () => {
    const path = generateWavePath(1200, 600, 3, 0, 10)
    path.forEach(p => expect(p.y).toBeCloseTo(0))
  })

  it('wave amplitude scales with waveHeight × 25', () => {
    const path = generateWavePath(1200, 600, 4, 1.5, 100)
    const maxY = Math.max(...path.map(p => Math.abs(p.y)))
    expect(maxY).toBeCloseTo(100, 0)
  })

  it('points are evenly distributed along x-axis', () => {
    const path = generateWavePath(1000, 500, 2, 1.5, 5)
    const step = 1000 / 5
    for (let i = 0; i < path.length - 1; i++) {
      expect(path[i + 1].x - path[i].x).toBeCloseTo(step, 8)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Transform Interpolation
// ─────────────────────────────────────────────────────────────────────────────
describe('interpolateTransform', () => {
  it('empty transforms returns identity (1,1,0)', () => {
    expect(interpolateTransform([], 0.5)).toEqual({ scaleX: 1, scaleY: 1, rotation: 0 })
  })

  it('exact position match at keyframe returns that keyframe values', () => {
    const transforms: RibSizeTransform[] = [
      { position: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      { position: 0.5, scaleX: 2, scaleY: 0.5, rotation: 90 },
      { position: 1, scaleX: 1, scaleY: 1, rotation: 0 },
    ]
    const result = interpolateTransform(transforms, 0.5)
    expect(result.scaleX).toBeCloseTo(2)
    expect(result.scaleY).toBeCloseTo(0.5)
    expect(result.rotation).toBeCloseTo(90)
  })

  it('interpolates linearly between two keyframes', () => {
    const transforms: RibSizeTransform[] = [
      { position: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      { position: 1, scaleX: 3, scaleY: 1, rotation: 180 },
    ]
    const mid = interpolateTransform(transforms, 0.5)
    expect(mid.scaleX).toBeCloseTo(2)
    expect(mid.rotation).toBeCloseTo(90)
  })

  it('position before first keyframe clamps to first keyframe', () => {
    const transforms: RibSizeTransform[] = [
      { position: 0.2, scaleX: 2, scaleY: 2, rotation: 45 },
      { position: 1, scaleX: 1, scaleY: 1, rotation: 0 },
    ]
    const result = interpolateTransform(transforms, 0.0)
    expect(result.scaleX).toBeCloseTo(2)
    expect(result.rotation).toBeCloseTo(45)
  })

  it('position after last keyframe clamps to last keyframe', () => {
    const transforms: RibSizeTransform[] = [
      { position: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      { position: 0.8, scaleX: 3, scaleY: 3, rotation: 90 },
    ]
    const result = interpolateTransform(transforms, 1.0)
    expect(result.scaleX).toBeCloseTo(3)
    expect(result.rotation).toBeCloseTo(90)
  })

  it('handles unsorted transforms by sorting first', () => {
    const transforms: RibSizeTransform[] = [
      { position: 1, scaleX: 1, scaleY: 1, rotation: 180 },
      { position: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    ]
    expect(interpolateTransform(transforms, 0.5).rotation).toBeCloseTo(90)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Axis Dimension Helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('Axis dimension helpers', () => {
  describe('createAxisDimension', () => {
    it('creates dimension with factor=1', () => {
      const dim = createAxisDimension(150, 'mm')
      expect(dim.physical.value).toBe(150)
      expect(dim.physical.unit).toBe('mm')
      expect(dim.factor).toBe(1)
    })
  })

  describe('updateAxisDimensionFromFactor', () => {
    it('clamps factor to [0.1, 10]', () => {
      const dim = createAxisDimension(100, 'mm')
      expect(updateAxisDimensionFromFactor(dim, 0.001).factor).toBeCloseTo(0.1)
      expect(updateAxisDimensionFromFactor(dim, 999).factor).toBeCloseTo(10)
    })

    it('updates physical value proportionally to new factor', () => {
      const dim = createAxisDimension(100, 'mm')
      const updated = updateAxisDimensionFromFactor(dim, 2)
      expect(updated.factor).toBeCloseTo(2)
      expect(toMM(updated.physical)).toBeCloseTo(200)
    })
  })

  describe('updateAxisDimensionFromPhysical', () => {
    it('updates physical value and recalculates factor within bounds', () => {
      const dim = createAxisDimension(100, 'mm')
      const updated = updateAxisDimensionFromPhysical(dim, { value: 200, unit: 'mm' })
      expect(updated.physical.value).toBe(200)
      expect(updated.factor).toBeGreaterThan(0.1)
      expect(updated.factor).toBeLessThanOrEqual(10)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Bounding Box Calculations
// ─────────────────────────────────────────────────────────────────────────────
describe('Bounding box calculations', () => {
  describe('calculateShelfBoundingBox', () => {
    it('width equals toMM(length)', () => {
      const bb = calculateShelfBoundingBox(DEFAULT_PARAMS)
      expect(bb.width).toBeCloseTo(toMM(DEFAULT_PARAMS.length))
    })

    it('height includes wave amplitude (waveHeight × 10)', () => {
      const bb = calculateShelfBoundingBox(DEFAULT_PARAMS)
      const expected = toMM(DEFAULT_PARAMS.height) + DEFAULT_PARAMS.waveHeight * 10
      expect(bb.height).toBeCloseTo(expected)
    })

    it('flat shelf (waveHeight=0): height equals toMM(height)', () => {
      const flat = { ...DEFAULT_PARAMS, waveHeight: 0 }
      expect(calculateShelfBoundingBox(flat).height).toBeCloseTo(toMM(flat.height))
    })

    it('depth equals toMM(ribDepth)', () => {
      const bb = calculateShelfBoundingBox(DEFAULT_PARAMS)
      expect(bb.depth).toBeCloseTo(toMM(DEFAULT_PARAMS.ribDepth))
    })
  })

  describe('calculateRibBoundingBox', () => {
    it('dimensions scale by axis factor', () => {
      const params = { ...DEFAULT_PARAMS, ribX: { physical: { value: 100, unit: 'mm' as const }, factor: 1.5 } }
      expect(calculateRibBoundingBox(params).width).toBeCloseTo(150)
    })

    it('default 150mm square ribs produce equal width and height', () => {
      const bb = calculateRibBoundingBox(DEFAULT_PARAMS)
      expect(bb.width).toBeCloseTo(150)
      expect(bb.height).toBeCloseTo(150)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Sheet Material Calculation (Pricing)
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateSheetsNeeded', () => {
  it('returns at least 1 sheet for any valid params', () => {
    expect(calculateSheetsNeeded(DEFAULT_PARAMS).sheets).toBeGreaterThanOrEqual(1)
  })

  it('does not inflate sheet count based on material thickness', () => {
    const thin = calculateSheetsNeeded({
      ...DEFAULT_PARAMS,
      materialThickness: { value: 6, unit: 'mm' },
    })
    const thick = calculateSheetsNeeded({
      ...DEFAULT_PARAMS,
      materialThickness: { value: 25, unit: 'mm' },
    })

    expect(thick.sheets).toBe(thin.sheets)
  })

  it('efficiency is in [0, 95] range', () => {
    const { efficiency } = calculateSheetsNeeded(DEFAULT_PARAMS)
    expect(efficiency).toBeGreaterThanOrEqual(0)
    expect(efficiency).toBeLessThanOrEqual(95)
  })

  it('doubling ribCount roughly doubles sheets', () => {
    const r1 = calculateSheetsNeeded(DEFAULT_PARAMS)
    const r2 = calculateSheetsNeeded({ ...DEFAULT_PARAMS, ribCount: DEFAULT_PARAMS.ribCount * 2 })
    expect(r2.sheets).toBeGreaterThanOrEqual(r1.sheets * 2 - 1)
  })

  it('matches the default design quote assumption of one sheet', () => {
    expect(calculateSheetsNeeded(DEFAULT_PARAMS).sheets).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Keyframe ↔ Shelf Position Mapping
// ─────────────────────────────────────────────────────────────────────────────
describe('keyframeToShelfIndex', () => {
  it('returns undefined when fewer than 2 keyframes', () => {
    expect(keyframeToShelfIndex(0, 1, 10)).toBeUndefined()
  })

  it('first keyframe maps to shelf index 0', () => {
    expect(keyframeToShelfIndex(0, 3, 10)).toBe(0)
  })

  it('last keyframe maps to ribCount-1', () => {
    expect(keyframeToShelfIndex(2, 3, 10)).toBe(9)
  })

  it('middle keyframe maps to midpoint of shelf', () => {
    expect(keyframeToShelfIndex(1, 3, 10)).toBe(5)
  })

  it('single rib shelf: returns 0', () => {
    expect(keyframeToShelfIndex(0, 3, 1)).toBe(0)
  })

  it('mapping is monotonically increasing', () => {
    const indices = [0, 1, 2, 3, 4].map(k => keyframeToShelfIndex(k, 5, 12) as number)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1])
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Custom Ryb Curve Pipeline
// ─────────────────────────────────────────────────────────────────────────────
describe('Custom ryb curve pipeline', () => {
  const simpleLine: CurveSegment = {
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 100 },
  }

  const simpleBezier: CurveSegment = {
    type: 'bezier',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    control1: { x: 25, y: 100 },
    control2: { x: 75, y: 100 },
  }

  describe('getCurvePoints', () => {
    it('line segment returns exactly 2 points: start and end', () => {
      const pts = getCurvePoints(simpleLine)
      expect(pts).toHaveLength(2)
      expect(pts[0]).toEqual({ x: 0, y: 0 })
      expect(pts[1]).toEqual({ x: 100, y: 100 })
    })

    it('bezier segment returns resolution+1 points', () => {
      expect(getCurvePoints(simpleBezier, 20)).toHaveLength(21)
    })

    it('bezier first point equals start', () => {
      const pts = getCurvePoints(simpleBezier, 10)
      expect(pts[0].x).toBeCloseTo(0)
      expect(pts[0].y).toBeCloseTo(0)
    })

    it('bezier last point equals end', () => {
      const pts = getCurvePoints(simpleBezier, 10)
      expect(pts[pts.length - 1].x).toBeCloseTo(100)
      expect(pts[pts.length - 1].y).toBeCloseTo(0)
    })

    it('bezier control points create curve (midpoint bulges)', () => {
      const pts = getCurvePoints(simpleBezier, 20)
      expect(pts[10].y).toBeGreaterThan(0)
    })
  })

  describe('getAllPointsFromRyb', () => {
    it('collects points from all segments', () => {
      const ryb: CustomRyb = {
        id: 'test-ryb',
        name: 'Test Ryb',
        index: 0,
        depth: 20,
        segments: [simpleLine, simpleBezier],
      }
      expect(getAllPointsFromRyb(ryb)).toHaveLength(23)
    })

    it('empty segments returns empty array', () => {
      const ryb: CustomRyb = { id: 'empty', name: 'Empty', index: 0, depth: 20, segments: [] }
      expect(getAllPointsFromRyb(ryb)).toHaveLength(0)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. End-to-End Wave Path → Rib Positioning Snapshot
// ─────────────────────────────────────────────────────────────────────────────
describe('Full rib params pipeline — snapshot contract', () => {
  it('generates correct number of rib positions', () => {
    const lengthMM = toMM(DEFAULT_PARAMS.length)
    const heightMM = toMM(DEFAULT_PARAMS.height)
    const path = generateWavePath(lengthMM, heightMM, DEFAULT_PARAMS.waveHeight, DEFAULT_PARAMS.waveFrequency, DEFAULT_PARAMS.ribCount)
    expect(path.length).toBe(DEFAULT_PARAMS.ribCount + 1)
  })

  it('rib positions span the full shelf length', () => {
    const lengthMM = toMM(DEFAULT_PARAMS.length)
    const heightMM = toMM(DEFAULT_PARAMS.height)
    const path = generateWavePath(lengthMM, heightMM, DEFAULT_PARAMS.waveHeight, DEFAULT_PARAMS.waveFrequency, DEFAULT_PARAMS.ribCount)
    const xs = path.map(p => p.x)
    expect(Math.min(...xs)).toBeCloseTo(-lengthMM / 2, 1)
    expect(Math.max(...xs)).toBeCloseTo(lengthMM / 2, 1)
  })

  it('flat shelf (waveHeight=0) has all ribs at y=0', () => {
    const flat = { ...DEFAULT_PARAMS, waveHeight: 0 }
    const path = generateWavePath(toMM(flat.length), toMM(flat.height), flat.waveHeight, flat.waveFrequency, flat.ribCount)
    path.forEach(p => expect(p.y).toBeCloseTo(0))
  })

  it('identity sizeTransforms give scaleX=1 for all rib positions', () => {
    for (let i = 0; i < DEFAULT_PARAMS.ribCount; i++) {
      const t = i / (DEFAULT_PARAMS.ribCount - 1 || 1)
      const transform = interpolateTransform(DEFAULT_PARAMS.sizeTransforms, t)
      expect(transform.scaleX).toBeCloseTo(1)
      expect(transform.scaleY).toBeCloseTo(1)
      expect(transform.rotation).toBeCloseTo(0)
    }
  })

  it('bounding box dimensions are consistent across unit changes', () => {
    const bbInch = calculateShelfBoundingBox(DEFAULT_PARAMS)
    const bbMM = calculateShelfBoundingBox(applyGlobalUnitChange(DEFAULT_PARAMS, 'mm'))
    expect(bbMM.width).toBeCloseTo(bbInch.width, 3)
    expect(bbMM.height).toBeCloseTo(bbInch.height, 3)
    expect(bbMM.depth).toBeCloseTo(bbInch.depth, 3)
  })
})
