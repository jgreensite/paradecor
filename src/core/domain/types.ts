/**
 * Core Domain Types — Rybform
 *
 * These are the authoritative shared type definitions for the parametric shelf
 * designer. They live in core/domain to remain infrastructure-agnostic and
 * importable by application services, ports, and the UI layer without creating
 * circular dependencies.
 *
 * Architecture boundary: this file must NOT import from React, vendor SDKs,
 * or infrastructure. It is pure TypeScript.
 */

// ── Unit System ────────────────────────────────────────────────────────

export type Unit = 'in' | 'mm'

export type ViewMode = '3d' | 'top' | 'front' | 'side'

export type RibShape = 'square' | 'circle' | 'rectangle' | 'freeform'

// ── Dimension Primitives ────────────────────────────────────────────────

export interface DimensionUnit {
  value: number
  unit: Unit
}

export interface RibSizeTransform {
  position: number
  scaleX: number
  scaleY: number
  rotation: number
}

export interface AxisDimension {
  physical: DimensionUnit
  factor: number
}

// ── Freeform / Bezier Geometry ──────────────────────────────────────────

export interface FreeformRibPoint {
  x: number
  y: number
}

export type CurveType = 'line' | 'bezier'

export interface BezierControlPoint {
  x: number
  y: number
}

export interface CurveSegment {
  type: CurveType
  start: BezierControlPoint
  end: BezierControlPoint
  control1?: BezierControlPoint
  control2?: BezierControlPoint
}

// ── Custom Ryb / Keyframe Sequence ──────────────────────────────────────

export interface CustomRyb {
  id: string
  name: string
  index: number
  segments: CurveSegment[]
  depth: number
}

export interface CustomRybSequence {
  rybs: CustomRyb[]
  spacingType: 'even' | 'custom'
  customSpacing?: number
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  selectedIndex: number
}

// ── Shelf Parameters ────────────────────────────────────────────────────

/**
 * The complete parametric description of a shelf design.
 * This is what gets serialised into Stripe/Supabase order metadata.
 */
export interface ShelfParams {
  length: DimensionUnit
  height: DimensionUnit
  ribDepth: DimensionUnit
  materialThickness: DimensionUnit
  ribCount: number
  waveHeight: number
  waveFrequency: number
  ribShape: RibShape
  ribSize: DimensionUnit
  ribX: AxisDimension
  ribY: AxisDimension
  ribZ: AxisDimension
  ribRotateX: number
  ribRotateY: number
  ribRotateZ: number
  sizeTransforms: RibSizeTransform[]
  flatEdge: boolean
  backplaneEnabled: boolean
  backplaneShape: 'rectangular' | 'organic'
  backplaneOrganicOffset: number
  backplaneMaterialThickness: number
  backplaneSlotDepth: number
  backplaneDogboneRadius: number
  material: string
  finish: string
  backplaneBezier?: CustomRyb | null
}
