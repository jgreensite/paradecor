/**
 * useDesignerState — RYB-112 (EPIC-16)
 *
 * Canonical home for all ShelfParams state and the pure functions that drive
 * the visual editor's parametric geometry pipeline.
 *
 * WHY A HOOK:
 *   App.tsx previously held ~300 lines of interleaved state + handlers. Moving
 *   them here makes each concern independently testable, satisfies hexagonal
 *   architecture constraints (no THREE.js / vendor imports at this layer), and
 *   is the mandatory prerequisite before RYB-113 (upload) and RYB-114 (custom
 *   ryb) can be safely extracted.
 *
 * EXPORTS:
 *   - Pure functions (re-exported so integration tests can use the real source)
 *   - useDesignerState() hook (all state + handlers)
 */

import { useState, useMemo, useCallback } from 'react'
import type {
  Unit,
  DimensionUnit,
  AxisDimension,
  RibSizeTransform,
  ShelfParams,
} from '../core/domain/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

export const MM_PER_INCH = 25.4

// ─── Pure unit-conversion helpers ─────────────────────────────────────────────

export function toMM(dim: DimensionUnit): number {
  return dim.unit === 'mm' ? dim.value : dim.value * MM_PER_INCH
}

export function toPhysical(mmValue: number, unit: Unit): number {
  return unit === 'mm' ? mmValue : mmValue / MM_PER_INCH
}

export function createAxisDimension(physicalValue: number, unit: Unit): AxisDimension {
  return { physical: { value: physicalValue, unit }, factor: 1 }
}

export function updateAxisDimensionFromPhysical(
  dim: AxisDimension,
  newPhysical: DimensionUnit,
): AxisDimension {
  const newMM = toMM(newPhysical)
  const baseMM =
    dim.factor === 1
      ? toMM({ value: 1, unit: newPhysical.unit })
      : toMM(dim.physical) / dim.factor
  const newFactor = baseMM > 0 ? newMM / baseMM : 1
  return {
    physical: newPhysical,
    factor: Math.max(0.1, Math.min(10, newFactor)),
  }
}

export function updateAxisDimensionFromFactor(
  dim: AxisDimension,
  newFactor: number,
): AxisDimension {
  const clampedFactor = Math.max(0.1, Math.min(10, newFactor))
  const newMM = (toMM(dim.physical) / dim.factor) * clampedFactor
  return {
    physical: { ...dim.physical, value: toPhysical(newMM, dim.physical.unit) },
    factor: clampedFactor,
  }
}

// ─── Pure geometry / parametric helpers ───────────────────────────────────────

export function generateWavePath(
  lengthMM: number,
  _heightMM: number,
  waveHeight: number,
  waveFrequency: number,
  ribCount: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i <= ribCount; i++) {
    const t = i / ribCount
    const xPos = t * lengthMM - lengthMM / 2
    const waveY = Math.sin(t * Math.PI * 2 * waveFrequency) * waveHeight * 25
    points.push({ x: xPos, y: waveY })
  }
  return points
}

export function interpolateTransform(
  transforms: RibSizeTransform[],
  position: number,
): { scaleX: number; scaleY: number; rotation: number } {
  if (transforms.length === 0) return { scaleX: 1, scaleY: 1, rotation: 0 }
  const sorted = [...transforms].sort((a, b) => a.position - b.position)
  if (position <= sorted[0].position)
    return { scaleX: sorted[0].scaleX, scaleY: sorted[0].scaleY, rotation: sorted[0].rotation }
  if (position >= sorted[sorted.length - 1].position)
    return {
      scaleX: sorted[sorted.length - 1].scaleX,
      scaleY: sorted[sorted.length - 1].scaleY,
      rotation: sorted[sorted.length - 1].rotation,
    }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (position >= sorted[i].position && position <= sorted[i + 1].position) {
      const t =
        (position - sorted[i].position) / (sorted[i + 1].position - sorted[i].position)
      return {
        scaleX: sorted[i].scaleX + (sorted[i + 1].scaleX - sorted[i].scaleX) * t,
        scaleY: sorted[i].scaleY + (sorted[i + 1].scaleY - sorted[i].scaleY) * t,
        rotation: sorted[i].rotation + (sorted[i + 1].rotation - sorted[i].rotation) * t,
      }
    }
  }
  return { scaleX: 1, scaleY: 1, rotation: 0 }
}

export function calculateSheetsNeeded(params: ShelfParams): { sheets: number; efficiency: number } {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const totalArea = widthMM * heightMM * params.ribCount
  const sheetArea = 48 * 96 * MM_PER_INCH * MM_PER_INCH
  const sheets = Math.max(1, Math.ceil(totalArea / sheetArea))
  const efficiency = Math.min(95, Math.round((totalArea / (sheets * sheetArea)) * 100))
  return { sheets, efficiency }
}

// ─── Preset definitions ────────────────────────────────────────────────────────

export interface Preset {
  id: string
  name: string
  icon: string
  params: { waveHeight: number; waveFrequency: number; ribCount: number }
}

export const PRESETS: Preset[] = [
  { id: 'gentle', name: 'Gentle Wave', icon: '〰️', params: { waveHeight: 2, waveFrequency: 1.5, ribCount: 12 } },
  { id: 'steep', name: 'Steep Wave', icon: '🌊', params: { waveHeight: 4, waveFrequency: 2, ribCount: 10 } },
  { id: 'flat', name: 'Flat Shelf', icon: '▬', params: { waveHeight: 0, waveFrequency: 0, ribCount: 8 } },
  { id: 'organic', name: 'Organic', icon: '🌿', params: { waveHeight: 3, waveFrequency: 2.5, ribCount: 15 } },
]

// ─── Default initial params ────────────────────────────────────────────────────

export const DEFAULT_SHELF_PARAMS: ShelfParams = {
  length: { value: 48, unit: 'in' },
  height: { value: 24, unit: 'in' },
  ribDepth: { value: 8, unit: 'in' },
  materialThickness: { value: 0.75, unit: 'in' },
  ribCount: 10,
  waveHeight: 2,
  waveFrequency: 1.5,
  ribShape: 'square',
  ribSize: { value: 150, unit: 'mm' },
  ribX: createAxisDimension(150, 'mm'),
  ribY: createAxisDimension(150, 'mm'),
  ribZ: createAxisDimension(10, 'mm'),
  ribRotateX: 180,
  ribRotateY: -90,
  ribRotateZ: 0,
  sizeTransforms: [],
  flatEdge: true,
  backplaneEnabled: true,
  backplaneShape: 'rectangular',
  backplaneOrganicOffset: 20,
  backplaneMaterialThickness: 12,
  backplaneSlotDepth: 60,
  backplaneDogboneRadius: 3.5,
  material: 'birch-plywood',
  finish: 'raw',
  backplaneBezier: null,
}

// ─── Hook public API ───────────────────────────────────────────────────────────

export interface DesignerStateHandlers {
  /** Current unit selection ('mm' | 'in') */
  globalUnit: Unit
  /** Full shelf parameter object */
  params: ShelfParams
  /** Currently active preset id */
  activePreset: string
  /** Sheet material calculation result */
  calculations: { sheets: number; efficiency: number }

  /** Change a single param key */
  handleParamChange: <K extends keyof ShelfParams>(key: K, value: ShelfParams[K]) => void

  /** Switch global measurement system and convert all DimensionUnit fields atomically */
  handleGlobalUnitChange: (newUnit: Unit) => void

  /** Apply one of the named wave presets */
  handlePresetClick: (presetId: string) => void

  /** Axis-specific callbacks (stable references via useCallback) */
  handleRibXPhysicalChange: (physical: DimensionUnit) => void
  handleRibXFactorChange: (factor: number) => void
  handleRibYPhysicalChange: (physical: DimensionUnit) => void
  handleRibYFactorChange: (factor: number) => void
  handleRibZPhysicalChange: (physical: DimensionUnit) => void
  handleRibZFactorChange: (factor: number) => void
}

/**
 * useDesignerState
 *
 * Encapsulates all ShelfParams state and the handlers that mutate it.
 * Owns no 3D / THREE.js / vendor dependencies — safe at any layer.
 */
export function useDesignerState(): DesignerStateHandlers {
  const [globalUnit, setGlobalUnit] = useState<Unit>('mm')
  const [params, setParams] = useState<ShelfParams>(DEFAULT_SHELF_PARAMS)
  const [activePreset, setActivePreset] = useState('gentle')

  // ── Param change ─────────────────────────────────────────────────────────────
  const handleParamChange = useCallback(
    <K extends keyof ShelfParams>(key: K, value: ShelfParams[K]) => {
      setParams(prev => ({ ...prev, [key]: value }))
    },
    [],
  )

  // ── Global unit change ────────────────────────────────────────────────────────
  const handleGlobalUnitChange = useCallback(
    (newUnit: Unit) => {
      setGlobalUnit(prev => {
        if (prev === newUnit) return prev
        return newUnit
      })
      setParams(prev => {
        const convert = (dim: DimensionUnit): DimensionUnit => {
          if (dim.unit === newUnit) return dim
          return {
            value: newUnit === 'mm' ? dim.value * MM_PER_INCH : dim.value / MM_PER_INCH,
            unit: newUnit,
          }
        }
        return {
          ...prev,
          length: convert(prev.length),
          height: convert(prev.height),
          ribDepth: convert(prev.ribDepth),
          materialThickness: convert(prev.materialThickness),
          ribSize: convert(prev.ribSize),
          ribX: { ...prev.ribX, physical: convert(prev.ribX.physical) },
          ribY: { ...prev.ribY, physical: convert(prev.ribY.physical) },
          ribZ: { ...prev.ribZ, physical: convert(prev.ribZ.physical) },
        }
      })
    },
    [],
  )

  // ── Preset application ────────────────────────────────────────────────────────
  const handlePresetClick = useCallback((presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setActivePreset(presetId)
    setParams(prev => ({
      ...prev,
      waveHeight: preset.params.waveHeight,
      waveFrequency: preset.params.waveFrequency,
      ribCount: preset.params.ribCount,
    }))
  }, [])

  // ── Stable axis callbacks ─────────────────────────────────────────────────────
  const handleRibXPhysicalChange = useCallback((physical: DimensionUnit) => {
    setParams(prev => ({ ...prev, ribX: updateAxisDimensionFromPhysical(prev.ribX, physical) }))
  }, [])

  const handleRibXFactorChange = useCallback((factor: number) => {
    setParams(prev => ({ ...prev, ribX: updateAxisDimensionFromFactor(prev.ribX, factor) }))
  }, [])

  const handleRibYPhysicalChange = useCallback((physical: DimensionUnit) => {
    setParams(prev => ({ ...prev, ribY: updateAxisDimensionFromPhysical(prev.ribY, physical) }))
  }, [])

  const handleRibYFactorChange = useCallback((factor: number) => {
    setParams(prev => ({ ...prev, ribY: updateAxisDimensionFromFactor(prev.ribY, factor) }))
  }, [])

  const handleRibZPhysicalChange = useCallback((physical: DimensionUnit) => {
    setParams(prev => ({ ...prev, ribZ: updateAxisDimensionFromPhysical(prev.ribZ, physical) }))
  }, [])

  const handleRibZFactorChange = useCallback((factor: number) => {
    setParams(prev => ({ ...prev, ribZ: updateAxisDimensionFromFactor(prev.ribZ, factor) }))
  }, [])

  // ── Derived: sheet calculation ────────────────────────────────────────────────
  const calculations = useMemo(
    () => calculateSheetsNeeded(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      params.length.value, params.length.unit,
      params.height.value, params.height.unit,
      params.materialThickness.value, params.materialThickness.unit,
      params.ribCount,
      params.ribX.physical.value, params.ribX.factor,
      params.ribY.physical.value, params.ribY.factor,
    ],
  )

  return {
    globalUnit,
    params,
    activePreset,
    calculations,
    handleParamChange,
    handleGlobalUnitChange,
    handlePresetClick,
    handleRibXPhysicalChange,
    handleRibXFactorChange,
    handleRibYPhysicalChange,
    handleRibYFactorChange,
    handleRibZPhysicalChange,
    handleRibZFactorChange,
  }
}
