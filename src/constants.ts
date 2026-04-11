import type { DimensionUnit, Unit, AxisDimension, RibShape, RibSizeTransform, FreeformRibPoint, CurveType, BezierControlPoint, CurveSegment, CustomRyb, CustomRybSequence } from './core/domain/types'

export const MATERIALS = [
  { id: 'mdf', name: 'Premium MDF', price: 45, color: '#E8E4DC', roughness: 0.8 },
  { id: 'birch-plywood', name: 'Birch Plywood', price: 65, color: '#D4B896', roughness: 0.6 },
  { id: 'walnut-plywood', name: 'Walnut Plywood', price: 85, color: '#5D4E37', roughness: 0.5 },
  { id: 'white-pvc', name: 'White PVC', price: 55, color: '#F5F5F5', roughness: 0.3 },
]

export const FINISHES = [
  { id: 'raw', name: 'Raw', price: 0 },
  { id: 'matte-white', name: 'Matte White', price: 15 },
  { id: 'matte-black', name: 'Matte Black', price: 15 },
  { id: 'gloss', name: 'High Gloss', price: 25 },
  { id: 'natural-oil', name: 'Natural Oil', price: 20 },
]

export const RIB_SHAPES = [
  { id: 'square', name: 'Square', icon: '◼️' },
  { id: 'circle', name: 'Circle', icon: '⚪' },
  { id: 'rectangle', name: 'Rectangle', icon: '▬' },
  { id: 'freeform', name: 'Freeform', icon: '✏️' },
]

export const PRESETS = [
  { id: 'gentle', name: 'Gentle Wave', icon: '〰️', params: { waveHeight: 2, waveFrequency: 1.5, ribCount: 12 } },
  { id: 'steep', name: 'Steep Wave', icon: '🌊', params: { waveHeight: 4, waveFrequency: 2, ribCount: 10 } },
  { id: 'flat', name: 'Flat Shelf', icon: '▬', params: { waveHeight: 0, waveFrequency: 0, ribCount: 8 } },
  { id: 'organic', name: 'Organic', icon: '🌿', params: { waveHeight: 3, waveFrequency: 2.5, ribCount: 15 } },
]

export const INITIAL_SITE_CONFIG = {
  previewCycleIntervalMs: 10000,
  previewFadeDurationMs: 800,
  cameraSweepSpeed: 0.15,
  cameraSweepAmplitude: 0.3,
  meshCurveSegments: 32,
  meshExtrudeSteps: 1,
  orthoZoomPadding: 1.1,
  perspectiveZoomMultiplier: 1.1,
}

export const MM_PER_INCH = 25.4
