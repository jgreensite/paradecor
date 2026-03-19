import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, Float, GizmoHelper, GizmoViewport, Text } from '@react-three/drei'
import { SignInButton, UserButton, useUser } from '@clerk/react'
import * as THREE from 'three'
// @ts-ignore
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
// @ts-ignore
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import makerjs from 'makerjs'
import { createSlotWithDogbone, createBackplaneOutline, generateCncLayout } from './backplane'

type Unit = 'in' | 'mm'
type ViewMode = '3d' | 'top' | 'front' | 'side'
type RibShape = 'square' | 'circle' | 'rectangle' | 'freeform'

interface DimensionUnit {
  value: number
  unit: Unit
}

interface RibSizeTransform {
  position: number
  scaleX: number
  scaleY: number
  rotation: number
}

interface AxisDimension {
  physical: DimensionUnit
  factor: number
}

interface ShelfParams {
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

interface FreeformRibPoint {
  x: number
  y: number
}

type CurveType = 'line' | 'bezier'

interface BezierControlPoint {
  x: number
  y: number
}

interface CurveSegment {
  type: CurveType
  start: BezierControlPoint
  end: BezierControlPoint
  control1?: BezierControlPoint
  control2?: BezierControlPoint
}

interface CustomRyb {
  id: string
  name: string
  index: number
  segments: CurveSegment[]
  depth: number
}

interface CustomRybSequence {
  rybs: CustomRyb[]
  spacingType: 'even' | 'custom'
  customSpacing?: number
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  selectedIndex: number
}

const MATERIALS = [
  { id: 'mdf', name: 'Premium MDF', price: 45, color: '#E8E4DC', roughness: 0.8 },
  { id: 'birch-plywood', name: 'Birch Plywood', price: 65, color: '#D4B896', roughness: 0.6 },
  { id: 'walnut-plywood', name: 'Walnut Plywood', price: 85, color: '#5D4E37', roughness: 0.5 },
  { id: 'white-pvc', name: 'White PVC', price: 55, color: '#F5F5F5', roughness: 0.3 },
]

const FINISHES = [
  { id: 'raw', name: 'Raw', price: 0 },
  { id: 'matte-white', name: 'Matte White', price: 15 },
  { id: 'matte-black', name: 'Matte Black', price: 15 },
  { id: 'gloss', name: 'High Gloss', price: 25 },
  { id: 'natural-oil', name: 'Natural Oil', price: 20 },
]

const RIB_SHAPES = [
  { id: 'square', name: 'Square', icon: '◼️' },
  { id: 'circle', name: 'Circle', icon: '⚪' },
  { id: 'rectangle', name: 'Rectangle', icon: '▬' },
  { id: 'freeform', name: 'Freeform', icon: '✏️' },
]

const PRESETS = [
  { id: 'gentle', name: 'Gentle Wave', icon: '〰️', params: { waveHeight: 2, waveFrequency: 1.5, ribCount: 12 } },
  { id: 'steep', name: 'Steep Wave', icon: '🌊', params: { waveHeight: 4, waveFrequency: 2, ribCount: 10 } },
  { id: 'flat', name: 'Flat Shelf', icon: '▬', params: { waveHeight: 0, waveFrequency: 0, ribCount: 8 } },
  { id: 'organic', name: 'Organic', icon: '🌿', params: { waveHeight: 3, waveFrequency: 2.5, ribCount: 15 } },
]

// ── Developer-configurable site parameters ──────────────────────────
// Change values here — they are referenced throughout the app.
const INITIAL_SITE_CONFIG = {
  previewCycleIntervalMs: 10000,
  previewFadeDurationMs: 800,
  cameraSweepSpeed: 0.15,
  cameraSweepAmplitude: 0.3,
  meshCurveSegments: 32,
  meshExtrudeSteps: 1,
  orthoZoomPadding: 1.1,
  perspectiveZoomMultiplier: 1.1,
}

const MM_PER_INCH = 25.4

function toMM(dim: DimensionUnit): number {
  return dim.unit === 'mm' ? dim.value : dim.value * MM_PER_INCH
}

function toPhysical(mmValue: number, unit: Unit): number {
  return unit === 'mm' ? mmValue : mmValue / MM_PER_INCH
}

function createAxisDimension(physicalValue: number, unit: Unit): AxisDimension {
  return {
    physical: { value: physicalValue, unit },
    factor: 1
  }
}

function updateAxisDimensionFromPhysical(dim: AxisDimension, newPhysical: DimensionUnit): AxisDimension {
  const newMM = toMM(newPhysical)
  const baseMM = dim.factor === 1 ? toMM({ value: 1, unit: newPhysical.unit }) : toMM(dim.physical) / dim.factor
  const newFactor = baseMM > 0 ? newMM / baseMM : 1
  return {
    physical: newPhysical,
    factor: Math.max(0.1, Math.min(10, newFactor))
  }
}

function updateAxisDimensionFromFactor(dim: AxisDimension, newFactor: number): AxisDimension {
  const clampedFactor = Math.max(0.1, Math.min(10, newFactor))
  const newMM = toMM(dim.physical) / dim.factor * clampedFactor
  return {
    physical: { ...dim.physical, value: toPhysical(newMM, dim.physical.unit) },
    factor: clampedFactor
  }
}

function generateWavePath(lengthMM: number, heightMM: number, waveHeight: number, waveFrequency: number, ribCount: number): { x: number, y: number }[] {
  const points: { x: number, y: number }[] = []

  for (let i = 0; i <= ribCount; i++) {
    const t = i / ribCount
    const xPos = t * lengthMM - lengthMM / 2
    const waveY = Math.sin(t * Math.PI * 2 * waveFrequency) * waveHeight * 25
    points.push({ x: xPos, y: waveY })
  }

  return points
}

function interpolateTransform(transforms: RibSizeTransform[], position: number): { scaleX: number, scaleY: number, rotation: number } {
  if (transforms.length === 0) return { scaleX: 1, scaleY: 1, rotation: 0 }

  const sorted = [...transforms].sort((a, b) => a.position - b.position)

  if (position <= sorted[0].position) return { scaleX: sorted[0].scaleX, scaleY: sorted[0].scaleY, rotation: sorted[0].rotation }
  if (position >= sorted[sorted.length - 1].position) return { scaleX: sorted[sorted.length - 1].scaleX, scaleY: sorted[sorted.length - 1].scaleY, rotation: sorted[sorted.length - 1].rotation }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (position >= sorted[i].position && position <= sorted[i + 1].position) {
      const t = (position - sorted[i].position) / (sorted[i + 1].position - sorted[i].position)
      return {
        scaleX: sorted[i].scaleX + (sorted[i + 1].scaleX - sorted[i].scaleX) * t,
        scaleY: sorted[i].scaleY + (sorted[i + 1].scaleY - sorted[i].scaleY) * t,
        rotation: sorted[i].rotation + (sorted[i + 1].rotation - sorted[i].rotation) * t,
      }
    }
  }

  return { scaleX: 1, scaleY: 1, rotation: 0 }
}

function generateRibGeometry(
  shape: RibShape,
  widthMM: number,
  heightMM: number,
  depthMM: number,
  flatEdge: boolean,
  freeformPoints?: FreeformRibPoint[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []
  const normals: number[] = []

  if (shape === 'square' || shape === 'rectangle') {
    const w = widthMM / 2
    const h = heightMM / 2
    const zF = flatEdge ? depthMM : depthMM / 2
    const zB = flatEdge ? 0 : -depthMM / 2

    const frontFace = [[-w, -h, zF], [w, -h, zF], [w, h, zF], [-w, h, zF]]
    const backFace = [[-w, -h, zB], [-w, h, zB], [w, h, zB], [w, -h, zB]]
    const faces = [
      frontFace, backFace,
      [[-w, h, zF], [w, h, zF], [w, h, zB], [-w, h, zB]],
      [[-w, -h, zB], [w, -h, zB], [w, -h, zF], [-w, -h, zF]],
      [[w, -h, zF], [w, -h, zB], [w, h, zB], [w, h, zF]],
      [[-w, -h, zB], [-w, -h, zF], [-w, h, zF], [-w, h, zB]],
    ]

    faces.forEach(face => {
      const baseIdx = vertices.length / 3
      face.forEach(v => vertices.push(...v))
      const v0 = new THREE.Vector3(...face[0])
      const v1 = new THREE.Vector3(...face[1])
      const v2 = new THREE.Vector3(...face[2])
      const edge1 = new THREE.Vector3().subVectors(v1, v0)
      const edge2 = new THREE.Vector3().subVectors(v2, v0)
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize()
      for (let i = 0; i < 4; i++) normals.push(normal.x, normal.y, normal.z)
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3)
    })

  } else if (shape === 'circle') {
    const radiusX = widthMM / 2
    const radiusY = heightMM / 2
    const segments = 24
    const zF = flatEdge ? depthMM : depthMM / 2
    const zB = flatEdge ? 0 : -depthMM / 2

    const frontCenter = vertices.length / 3
    vertices.push(0, 0, zF)
    normals.push(0, 0, 1)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      vertices.push(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, zF)
      normals.push(0, 0, 1)
    }
    for (let i = 0; i < segments; i++) indices.push(frontCenter, frontCenter + i + 1, frontCenter + i + 2)

    const backCenter = vertices.length / 3
    vertices.push(0, 0, zB)
    normals.push(0, 0, -1)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      vertices.push(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, zB)
      normals.push(0, 0, -1)
    }
    for (let i = 0; i < segments; i++) indices.push(backCenter, backCenter + i + 2, backCenter + i + 1)

    const sideStart = vertices.length / 3
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const x = Math.cos(angle) * radiusX
      const y = Math.sin(angle) * radiusY
      vertices.push(x, y, zF)
      normals.push(Math.cos(angle), Math.sin(angle), 0)
      vertices.push(x, y, zB)
      normals.push(Math.cos(angle), Math.sin(angle), 0)
    }
    for (let i = 0; i < segments; i++) {
      const a = sideStart + i * 2
      indices.push(a, a + 1, a + 3, a, a + 3, a + 2)
    }

  } else if (shape === 'freeform' && freeformPoints && freeformPoints.length > 2) {
    const minX = Math.min(...freeformPoints.map(p => p.x))
    const maxX = Math.max(...freeformPoints.map(p => p.x))
    const minY = Math.min(...freeformPoints.map(p => p.y))
    const maxY = Math.max(...freeformPoints.map(p => p.y))
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1

    const scaledPoints = freeformPoints.map(p => ({
      x: ((p.x - minX) / rangeX - 0.5) * widthMM,
      y: ((p.y - minY) / rangeY - 0.5) * heightMM,
    }))

    const zF = flatEdge ? depthMM : depthMM / 2
    const zB = flatEdge ? 0 : -depthMM / 2

    const frontCenter = vertices.length / 3
    vertices.push(0, 0, zF)
    normals.push(0, 0, 1)
    scaledPoints.forEach(p => { vertices.push(p.x, p.y, zF); normals.push(0, 0, 1) })
    for (let i = 0; i < scaledPoints.length; i++) indices.push(frontCenter, frontCenter + i + 1, frontCenter + ((i + 1) % scaledPoints.length) + 1)

    const backCenter = vertices.length / 3
    vertices.push(0, 0, zB)
    normals.push(0, 0, -1)
    scaledPoints.forEach(p => { vertices.push(p.x, p.y, zB); normals.push(0, 0, -1) })
    for (let i = 0; i < scaledPoints.length; i++) indices.push(backCenter, backCenter + ((i + 1) % scaledPoints.length) + 1, backCenter + i + 1)

    const sideStart = vertices.length / 3
    for (let i = 0; i < scaledPoints.length; i++) {
      const curr = scaledPoints[i]
      const next = scaledPoints[(i + 1) % scaledPoints.length]
      const dx = next.x - curr.x
      const dy = next.y - curr.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / len
      const ny = dx / len

      vertices.push(curr.x, curr.y, zF, curr.x, curr.y, zB, next.x, next.y, zB, next.x, next.y, zF)
      normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0)
      const base = sideStart + i * 4
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  // Final check to avoid WebGL context loss on missing attributes
  if (vertices.length === 0) {
    console.warn(`generateRibGeometry[${shape}]: No vertices generated! Falling back to unit point.`)
    vertices.push(0, 0, 0, 0.1, 0, 0, 0, 0.1, 0)
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1)
    indices.push(0, 1, 2)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  
  try {
    geometry.computeVertexNormals()
  } catch (e) {
    console.error(`Error computing vertex normals for shape ${shape}:`, e)
  }

  return geometry
}

function generateAllRibParams(params: ShelfParams, wavePath: { x: number, y: number }[], freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null) {
  const baseX = toMM(params.ribX.physical) * params.ribX.factor
  const baseY = toMM(params.ribY.physical) * params.ribY.factor

  const activeTransforms = params.sizeTransforms.length > 0
    ? params.sizeTransforms
    : [{ position: 0, scaleX: 1, scaleY: 1, rotation: 0 }, { position: 1, scaleX: 1, scaleY: 1, rotation: 0 }]

  const profiles: { width: number; height: number; shape: RibShape; freeformPts?: FreeformRibPoint[], rotateX: number, rotateY: number, rotateZ: number }[] = []

  // Pre-calculate points for all keyframes in the sequence to avoid redundant math in the loop
  const keyframePoints = customRybSequence?.rybs.map(ryb => getAllPointsFromRyb(ryb)) || []

  for (let i = 0; i < wavePath.length; i++) {
    const t = i / (wavePath.length - 1 || 1)
    const transform = interpolateTransform(activeTransforms, t)

    let scaledWidth = baseX * transform.scaleX
    let scaledHeight = baseY * transform.scaleY

    // Apply backplane bezier stretching if enabled
    if (params.backplaneBezier) {
      const lengthMM = toMM(params.length)
      const bpH = getCustomRybHeightAtX(params.backplaneBezier, wavePath[i].x, lengthMM, scaledHeight)
      scaledHeight = bpH + (params.backplaneOrganicOffset * 0.5) // Stretch to fit backplane + some clearance
    }

    let ribFreeformPoints = freeformPoints

    // Priority: If we have a custom sequence and the shape is freeform, use it regardless of length
    if (params.ribShape === 'freeform' && keyframePoints.length > 0) {
      const rybCount = keyframePoints.length
      
      if (rybCount === 1) {
        // Single keyframe: no interpolation needed, just scale it
        ribFreeformPoints = keyframePoints[0].map(p => ({ x: p.x * 2, y: p.y * 2 }))
      } else {
        const rybT = t * (rybCount - 1)
        const rybIdx0 = Math.min(Math.floor(rybT), rybCount - 2)
        const rybIdx1 = rybIdx0 + 1
        const localT = rybT - rybIdx0

        const points0 = keyframePoints[rybIdx0]
        const points1 = keyframePoints[rybIdx1]

        const maxLen = Math.max(points0.length, points1.length)
        const interpolatedPoints: FreeformRibPoint[] = []
        for (let j = 0; j < maxLen; j++) {
          const p0 = points0[Math.min(j, points0.length - 1)]
          const p1 = points1[Math.min(j, points1.length - 1)]
          interpolatedPoints.push({
            x: (p0.x + (p1.x - p0.x) * localT) * 2,
            y: (p0.y + (p1.y - p0.y) * localT) * 2
          })
        }
        ribFreeformPoints = interpolatedPoints
      }
    }

    profiles.push({
      width: scaledWidth,
      height: scaledHeight,
      shape: params.ribShape,
      freeformPts: ribFreeformPoints,
      rotateX: params.ribRotateX + transform.rotation,
      rotateY: params.ribRotateY,
      rotateZ: params.ribRotateZ
    })
  }

  return profiles
}

function generateAllRibs(params: ShelfParams, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null): { positions: { x: number, y: number, z: number }[], rotations: [number, number, number][], profiles: any[] } {
  const lengthMM = toMM(params.length)
  const waveHeightMM = toMM(params.height)

  const wavePath = generateWavePath(lengthMM, waveHeightMM, params.waveHeight, params.waveFrequency, params.ribCount)
  const profiles = generateAllRibParams(params, wavePath, freeformPoints, customRybSequence)

  const positions: { x: number, y: number, z: number }[] = []
  const rotations: [number, number, number][] = []

  for (let i = 0; i < wavePath.length; i++) {
    const point = wavePath[i]
    const p = profiles[i]

    positions.push({ x: point.x, y: point.y, z: 0 })
    rotations.push([
      THREE.MathUtils.degToRad(p.rotateX),
      THREE.MathUtils.degToRad(p.rotateY),
      THREE.MathUtils.degToRad(p.rotateZ)
    ])
  }

  return { positions, rotations, profiles }
}

function Backplane3D({ wavePath, lengthMM, depthMM, materialThicknessMM, enabled, shape, organicOffset, slotLayouts }: { wavePath: { x: number, y: number, z: number }[], lengthMM: number, depthMM: number, materialThicknessMM: number, enabled: boolean, shape: 'rectangular' | 'organic', organicOffset: number, slotLayouts: { x: number, y: number, w: number, h: number, shiftX: number, rybH: number, rotateZ: number }[] }) {
  if (!enabled || wavePath.length < 2) return null

  const bpDepth = materialThicknessMM

  const getH = (x: number) => {
    try {
      if (!slotLayouts || slotLayouts.length === 0) return 300; // Fallback height
      const sorted = [...slotLayouts].sort((a, b) => a.x - b.x);
      if (!sorted[0]) return 300;

      // If a custom bezier is provided, it ALWAYS defines the height for the organic backplane
      // Note: In a more advanced version, we might want to evaluate the bezier directly here.
      // For now, slotLayouts already uses the evaluated heights from generateAllRibParams.
      
      if (x <= sorted[0].x) return sorted[0].rybH;
      if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].rybH;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (x >= sorted[i].x && x <= sorted[i+1].x) {
          const t = (x - sorted[i].x) / (sorted[i+1].x - sorted[i].x || 1);
          return sorted[i].rybH + t * (sorted[i+1].rybH - sorted[i].rybH);
        }
      }
      return sorted[0].rybH;
    } catch (e) {
      return 300;
    }
  }

  const renderSlotLabels = () => (
    <group position={[0, 0, -depthMM * 0.6 + bpDepth + 1]}>
      {slotLayouts.map((slot, i) => (
        <group key={i} position={[slot.x, slot.y, 0]}>
          <Suspense fallback={null}>
            <Text 
              position={[0, slot.h / 2 + 15, 0]} 
              fontSize={8} 
              color="#FFFFFF" 
              outlineWidth={0.5} 
              outlineColor="#000000" 
              anchorX="center" 
              anchorY="bottom"
            >
              {`${slot.w.toFixed(1)} × ${slot.h.toFixed(1)}`}
            </Text>
          </Suspense>
        </group>
      ))}
    </group>
  )

  // Robust shape generation with safety checks
  const bpShape = useMemo(() => {
    try {
      if (shape !== 'organic') return null;
      const s = new THREE.Shape()
      const pts: THREE.Vector2[] = []
      
      // Filter out duplicate or too-close points to avoid degenerate triangulation
      const filteredPath = wavePath.filter((p, i) => i === 0 || Math.abs(p.x - wavePath[i-1].x) > 0.1)
      
      for (let i = 0; i < filteredPath.length; i++) {
        const p = filteredPath[i]
        const h = getH(p.x) + (organicOffset * 2)
        pts.push(new THREE.Vector2(p.x, p.y - h / 2))
      }
      
      for (let i = filteredPath.length - 1; i >= 0; i--) {
        const p = filteredPath[i]
        const h = getH(p.x) + (organicOffset * 2)
        pts.push(new THREE.Vector2(p.x, p.y + h / 2))
      }
      
      if (pts.length < 3) return null
      s.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        s.lineTo(pts[i].x, pts[i].y)
      }
      s.closePath()
      return s
    } catch (e) {
      console.error("Failed to generate organic backplane shape:", e)
      return null
    }
  }, [wavePath, shape, organicOffset, slotLayouts])

  if (shape === 'organic' && bpShape) {
    return (
      <group>
        <mesh position={[0, 0, -depthMM * 0.6]} castShadow={false} receiveShadow>
          <extrudeGeometry args={[bpShape, { depth: bpDepth, bevelEnabled: false }]} />
          <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.05} />
        </mesh>
        {renderSlotLabels()}
      </group>
    )
  }

  // Rectangular fallback
  const minY = Math.min(...wavePath.map(p => p.y - getH(p.x) / 2))
  const maxY = Math.max(...wavePath.map(p => p.y + getH(p.x) / 2))
  const bpHeight = (maxY - minY) + (organicOffset * 2)
  const centerX = (wavePath[0].x + wavePath[wavePath.length - 1].x) / 2
  const centerY = (minY + maxY) / 2

  return (
    <group>
      <mesh position={[centerX, centerY, -depthMM * 0.6 + bpDepth / 2]} castShadow={false} receiveShadow>
        <boxGeometry args={[lengthMM * 1.05, bpHeight, bpDepth]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.05} />
      </mesh>
      {renderSlotLabels()}
    </group>
  )
}

function calculateRibBoundingBox(params: ShelfParams, freeformPoints?: FreeformRibPoint[]): { width: number, height: number, depth: number } {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  if (params.ribShape === 'freeform' && freeformPoints && freeformPoints.length > 2) {
    const minX = Math.min(...freeformPoints.map(p => p.x))
    const maxX = Math.max(...freeformPoints.map(p => p.x))
    const minY = Math.min(...freeformPoints.map(p => p.y))
    const maxY = Math.max(...freeformPoints.map(p => p.y))
    return {
      width: (maxX - minX) / 100 * widthMM,
      height: (maxY - minY) / 100 * heightMM,
      depth: depthMM
    }
  }

  return { width: widthMM, height: heightMM, depth: depthMM }
}

function calculateShelfBoundingBox(params: ShelfParams): { width: number, height: number, depth: number, center: THREE.Vector3 } {
  const lengthMM = toMM(params.length)
  const waveHeightMM = toMM(params.height)
  const ribDepthMM = toMM(params.ribDepth)

  const waveAmplitude = params.waveHeight * 10
  const totalHeight = waveHeightMM + waveAmplitude

  return {
    width: lengthMM,
    height: totalHeight,
    depth: ribDepthMM,
    center: new THREE.Vector3(0, 0, 0)
  }
}
function ZoomToFit({ boundingBox, viewMode, target, siteConfig, isSingleRib = false, isPreview = false }: { boundingBox: { width: number, height: number, depth: number, center?: THREE.Vector3 }, viewMode: ViewMode, target?: THREE.Vector3, siteConfig: typeof INITIAL_SITE_CONFIG, isSingleRib?: boolean, isPreview?: boolean }) {
  const { camera, size: canvasSize } = useThree()
  console.log(`ZoomToFit [Render] (${isPreview ? 'preview' : 'full'}): width=${boundingBox.width} viewMode=${viewMode}`)

  useFrame(() => {
    if (viewMode !== '3d') return
    const bb = boundingBox
    const w = bb.width || (isSingleRib ? 150 : 1200)
    const h = bb.height || (isSingleRib ? 150 : 600)
    const d = bb.depth || (isSingleRib ? 20 : 200)
    const maxDim = Math.max(w, h, d)

    const center = target || bb.center || new THREE.Vector3(0, 0, 0)
    const zoomMult = isPreview ? 1.8 : (isSingleRib ? 1.5 : siteConfig.perspectiveZoomMultiplier || 1.2)
    const distance = maxDim * zoomMult
    
    // Only set on first frame or if maxDim changes drastically
    if (camera.position.length() < 10 || Math.abs(camera.position.z - (center.z + distance)) > 5000) {
       console.log(`ZoomToFit [useFrame-3d]: setting position`)
       camera.position.set(center.x + distance * 0.4, center.y + distance * 0.6, center.z + distance)
       camera.lookAt(center)
    }
  })

  // Orthographic effects remain as effects because they are snapshots
  useEffect(() => {
    if (viewMode === '3d') return
    const center = target || boundingBox.center || new THREE.Vector3(0, 0, 0)
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) || 50
    const padding = siteConfig.orthoZoomPadding

    let visibleWidth: number, visibleHeight: number
    if (viewMode === 'top') {
      visibleWidth = boundingBox.width
      visibleHeight = boundingBox.depth
    } else if (viewMode === 'front') {
      visibleWidth = boundingBox.width
      visibleHeight = boundingBox.height
    } else { // side
      visibleWidth = boundingBox.depth
      visibleHeight = boundingBox.height
    }

    const zoomX = canvasSize.width / ((visibleWidth || 1000) * padding)
    const zoomY = canvasSize.height / ((visibleHeight || 1000) * padding)
    const orthoZoom = Math.min(zoomX, zoomY)

    console.log(`ZoomToFit [${viewMode}]: center=${center.x},${center.y},${center.z} orthoZoom=${orthoZoom}`)

    const dist = maxDim * 2
    if (viewMode === 'top') {
      camera.position.set(center.x, center.y + dist, center.z)
    } else if (viewMode === 'front') {
      camera.position.set(center.x, center.y, center.z + dist)
    } else if (viewMode === 'side') {
      camera.position.set(center.x + dist, center.y, center.z)
    }
    camera.lookAt(center)
    if ('zoom' in camera) {
      ; (camera as THREE.OrthographicCamera).zoom = orthoZoom
      camera.updateProjectionMatrix()
    }
  }, [camera, boundingBox.width, boundingBox.height, boundingBox.depth, viewMode, target, canvasSize, siteConfig.orthoZoomPadding])

  return null
}


// Gentle auto-rotating camera sweep for preview canvases
function CameraSweep({ enabled = true, siteConfig }: { enabled?: boolean, siteConfig: typeof INITIAL_SITE_CONFIG }) {
  const { camera } = useThree()
  const initialPos = useRef<THREE.Vector3 | null>(null)

  useFrame((_, delta) => {
    if (!enabled) return
    if (!initialPos.current) initialPos.current = camera.position.clone()
    const time = Date.now() * 0.001 * siteConfig.cameraSweepSpeed
    const amp = siteConfig.cameraSweepAmplitude
    camera.position.x = initialPos.current.x + Math.sin(time) * amp * initialPos.current.length() * 0.1
    camera.position.y = initialPos.current.y + Math.cos(time * 0.7) * amp * initialPos.current.length() * 0.05
    camera.lookAt(0, 0, 0)
  })

  return null
}

function SingleRibPreview({ params, freeformPoints, customRybSequence }: { params: ShelfParams, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null }) {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  // Sync with the selected keyframe in the custom sequence if it exists
  const activeFreeformPoints = useMemo(() => {
    if (params.ribShape === 'freeform' && customRybSequence && customRybSequence.rybs.length > 0) {
      const selectedRyb = customRybSequence.rybs[customRybSequence.selectedIndex || 0]
      if (selectedRyb) {
        return getAllPointsFromRyb(selectedRyb).map(p => ({ x: p.x * 2, y: p.y * 2 }))
      }
    }
    return freeformPoints
  }, [params.ribShape, freeformPoints, customRybSequence])

  const geometry = useMemo(() =>
    generateRibGeometry(params.ribShape, widthMM, heightMM, depthMM, params.flatEdge, activeFreeformPoints),
    [params.ribShape, widthMM, heightMM, depthMM, params.flatEdge, activeFreeformPoints]
  )

  const material = useMemo(() => {
    const mat = MATERIALS.find(m => m.id === params.material) || MATERIALS[0]
    return new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, metalness: 0.05, side: THREE.DoubleSide })
  }, [params.material])

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(params.ribRotateX),
    THREE.MathUtils.degToRad(params.ribRotateY),
    THREE.MathUtils.degToRad(params.ribRotateZ)
  ]

  return <mesh geometry={geometry} material={material} rotation={rotation} castShadow receiveShadow />
}

function ShelfMesh({ params, freeformPoints, customRybSequence, highlightIndex }: { params: ShelfParams, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null, highlightIndex?: number }) {
  const selectedMaterial = MATERIALS.find(m => m.id === params.material) || MATERIALS[0]
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  const memoKey = useMemo(() =>
    `${params.length.value}-${params.length.unit}-${params.height.value}-${params.height.unit}-${params.ribDepth.value}-${params.ribCount}-${params.waveHeight}-${params.waveFrequency}-${params.ribShape}-${params.ribX.physical.value}-${params.ribX.factor}-${params.ribY.physical.value}-${params.ribY.factor}-${params.ribZ.physical.value}-${params.ribZ.factor}-${params.ribRotateX}-${params.ribRotateY}-${params.ribRotateZ}-${params.flatEdge}-${params.sizeTransforms.map(t => `${t.scaleX}-${t.scaleY}`).join(',')}`,
    [params.length.value, params.length.unit, params.height.value, params.height.unit, params.ribDepth.value, params.ribCount, params.waveHeight, params.waveFrequency, params.ribShape, params.ribX.physical.value, params.ribX.factor, params.ribY.physical.value, params.ribY.factor, params.ribZ.physical.value, params.ribZ.factor, params.ribRotateX, params.ribRotateY, params.ribRotateZ, params.flatEdge, params.sizeTransforms]
  )

  const { positions, rotations, profiles } = useMemo(() => {
    const result = generateAllRibs(params, freeformPoints, customRybSequence)
    console.log('ShelfMesh generateAllRibs result:', {
      positionsCount: result.positions.length,
      firstPos: result.positions[0]
    })
    return result
  }, [memoKey, freeformPoints, customRybSequence])

  // Geometry caching and disposal to fix lag
  const geometryCacheRef = useRef<Map<string, THREE.BufferGeometry>>(new Map())

  // Clean up geometries on unmount
  useEffect(() => {
    return () => {
      geometryCacheRef.current.forEach(geo => geo.dispose())
      geometryCacheRef.current.clear()
    }
  }, [])

  const geometries = useMemo(() => {
    const newGeometries: THREE.BufferGeometry[] = []
    const currentCache = geometryCacheRef.current
    
    // We'll keep track of which geometries are used in this render to dispose of old ones?
    // Actually, for simplicity, let's just clear and rebuild if shape type changes,
    // or keep a rolling cache. For now, a simple dimension-based cache.
    
    positions.forEach((_, i) => {
      const p = profiles[i]
      // Create a cache key for this specific rib shape/size
      const cacheKey = `${p.shape}-${Math.round(p.width*10)/10}-${Math.round(p.height*10)/10}-${Math.round(depthMM*10)/10}-${params.flatEdge}-${p.freeformPts ? JSON.stringify(p.freeformPts) : 'no-ff'}`
      
      let geo = currentCache.get(cacheKey)
      if (!geo) {
        geo = generateRibGeometry(p.shape, p.width, p.height, depthMM, params.flatEdge, p.freeformPts)
        currentCache.set(cacheKey, geo)
      }
      newGeometries.push(geo)
    })

    // Optional: Dispose of geometries in cache that weren't used in this render?
    // For now, let's just keep them to avoid churn. 
    // If the cache grows too large, we can implement a more complex eviction policy.
    
    return newGeometries
  }, [positions, profiles, depthMM, params.flatEdge, params.ribShape])


  const slotLayouts = useMemo(() => {
    return positions.map((pos, i) => {
      const p = profiles[i]
      const Rx = (p.rotateX || 0) * Math.PI / 180
      const Ry = (p.rotateY ?? -90) * Math.PI / 180
      const tz = params.ribZ.physical.value * params.ribZ.factor
      const tw = params.backplaneMaterialThickness
      const th = params.backplaneSlotDepth

      const w = tw * Math.abs(Math.cos(Ry)) + th * Math.abs(Math.sin(Rx) * Math.sin(Ry)) + tz * Math.abs(Math.cos(Rx) * Math.sin(Ry))
      const h = th * Math.abs(Math.cos(Rx)) + tz * Math.abs(Math.sin(Rx))
      const shiftX = (-tw / 2) * Math.cos(Ry)
      const rybH = p.height * Math.abs(Math.cos(Rx)) + tz * Math.abs(Math.sin(Rx))

      return { x: pos.x, y: pos.y, w, h, shiftX, rybH, rotateZ: p.rotateZ || 0 }
    })
  }, [positions, profiles, params.ribZ.physical.value, params.ribZ.factor, params.backplaneMaterialThickness, params.backplaneSlotDepth])

  // Simplest material to ensure visibility
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({ 
      color: selectedMaterial.color, 
      roughness: 0.7, 
      metalness: 0.1, 
      side: THREE.DoubleSide
    })
  }, [selectedMaterial])

  const highlightMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({ 
      color: '#C67B5C', 
      roughness: 0.4, 
      metalness: 0.1, 
      emissive: '#C67B5C', 
      emissiveIntensity: 0.3, 
      side: THREE.DoubleSide
    })
  }, [])

  const lengthMM = toMM(params.length)
  const ribDepthMM = toMM(params.ribDepth)

  // Debug: if no positions, render a visible red box so we know the Canvas works
  if (positions.length === 0) {
    return (
      <mesh>
        <boxGeometry args={[100, 100, 100]} />
        <meshStandardMaterial color="red" />
      </mesh>
    )
  }

  return (
    <group>
      {positions.map((pos, index) => {
        const geometry = geometries[index]
        if (!geometry) return null
        return (
          <mesh
            key={`rib-${index}`}
            geometry={geometry}
            material={highlightIndex === index ? highlightMaterial : material}
            position={[pos.x, pos.y, pos.z]}
            rotation={rotations[index]}
            frustumCulled={false}
          />
        )
      })}
      <Backplane3D
        wavePath={positions}
        lengthMM={lengthMM}
        depthMM={ribDepthMM}
        materialThicknessMM={params.backplaneMaterialThickness}
        enabled={params.backplaneEnabled}
        shape={params.backplaneShape}
        organicOffset={params.backplaneOrganicOffset}
        slotLayouts={slotLayouts}
      />
    </group>
  )
}

function Scene({ 
  params, 
  viewMode, 
  freeformPoints, 
  customRybSequence, 
  isSingleRib = false, 
  canvasId, 
  autoSweep = false, 
  enableOrbit = true, 
  siteConfig, 
  showGizmo = false, 
  isPreview = false, 
  highlightIndex, 
  theme = 'light',
  uploadedMesh = null,
  uploadedMeshRotation = { x: 0, y: 0, z: 0 },
  uploadedMeshScale = 1.0
}: { 
  params: ShelfParams, 
  viewMode: ViewMode, 
  freeformPoints?: FreeformRibPoint[], 
  customRybSequence?: CustomRybSequence | null, 
  isSingleRib?: boolean, 
  canvasId?: string, 
  autoSweep?: boolean, 
  enableOrbit?: boolean, 
  siteConfig: typeof INITIAL_SITE_CONFIG, 
  showGizmo?: boolean, 
  isPreview?: boolean, 
  highlightIndex?: number, 
  theme?: 'light' | 'dark',
  uploadedMesh?: THREE.Mesh | null,
  uploadedMeshRotation?: { x: number, y: number, z: number },
  uploadedMeshScale?: number
}) {
  console.log(`Rendering Scene [${canvasId || 'unknown'}]:`, { isSingleRib, viewMode, theme })
  const lengthMM = toMM(params.length)
  const heightMM = toMM(params.height)

  const boundingBox = useMemo(() =>
    isSingleRib
      ? { ...calculateRibBoundingBox(params, freeformPoints), center: new THREE.Vector3(0, 0, 0) }
      : calculateShelfBoundingBox(params),
    [params, freeformPoints, isSingleRib]
  )

  const target = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  return (
    <>
      <color attach="background" args={[theme === 'dark' ? '#2C2A26' : '#f5f5f4']} />
      
      <ambientLight intensity={1.2} />
      <directionalLight position={[2000, 3000, 2000]} intensity={1.0} />
      <pointLight position={[-1000, 1000, -1000]} intensity={0.5} />

      <ZoomToFit boundingBox={boundingBox} viewMode={viewMode} target={target} siteConfig={siteConfig} isSingleRib={isSingleRib} isPreview={isPreview} />

      {isSingleRib ? (
        <Float speed={2} rotationIntensity={viewMode === '3d' ? 0.1 : 0} floatIntensity={0.3}>
          <SingleRibPreview params={params} freeformPoints={freeformPoints} customRybSequence={customRybSequence} />
        </Float>
      ) : (
        <group>
          <ShelfMesh params={params} freeformPoints={freeformPoints} customRybSequence={customRybSequence} highlightIndex={highlightIndex} />
          
          {uploadedMesh && (
            <primitive 
              object={uploadedMesh} 
              rotation={[
                THREE.MathUtils.degToRad(uploadedMeshRotation.x),
                THREE.MathUtils.degToRad(uploadedMeshRotation.y),
                THREE.MathUtils.degToRad(uploadedMeshRotation.z)
              ]}
              scale={[uploadedMeshScale, uploadedMeshScale, uploadedMeshScale]}
            />
          )}
        </group>
      )}

      <axesHelper args={[1000]} />
      
      {autoSweep && viewMode === '3d' && <CameraSweep siteConfig={siteConfig} />}

      {enableOrbit && viewMode === '3d' && <OrbitControls target={target} enablePan enableZoom enableDamping dampingFactor={0.05} minDistance={10} maxDistance={20000} makeDefault />}
      
      {showGizmo && (
        <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
          <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
        </GizmoHelper>
      )}
    </>
  )
}

function calculateSheetsNeeded(params: ShelfParams): { sheets: number, efficiency: number } {
  const lengthMM = toMM(params.length)
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const thicknessMM = toMM(params.materialThickness)

  const ribArea = widthMM * heightMM * thicknessMM
  const totalArea = ribArea * params.ribCount
  const sheetArea = 48 * 96 * MM_PER_INCH * MM_PER_INCH

  const sheets = Math.ceil(totalArea / sheetArea)
  const efficiency = Math.min(95, Math.round((totalArea / (sheets * sheetArea)) * 100))

  return { sheets, efficiency }
}

function UnitInput({ label, value, onChange, minMM = 1, maxMM = 10000, step = 0.1 }: { label: string, value: DimensionUnit, onChange: (dim: DimensionUnit) => void, minMM?: number, maxMM?: number, step?: number }) {
  const currentMin = value.unit === 'mm' ? minMM : minMM / MM_PER_INCH
  const currentMax = value.unit === 'mm' ? maxMM : maxMM / MM_PER_INCH
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={currentMin} max={currentMax} step={step} value={Number(value.value.toFixed(2))} onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} className="w-20 px-2 py-1 text-sm bg-cream border border-stone/20 rounded-md focus:outline-none focus:border-oak" />
      <select value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as Unit })} className="px-2 py-1 text-sm bg-cream border border-stone/20 rounded-md focus:outline-none focus:border-oak">
        <option value="in">in</option>
        <option value="mm">mm</option>
      </select>
    </div>
  )
}

function AxisDimensionControl({ label, axisDim, onPhysicalChange, onFactorChange, maxMM = 600 }: { label: string, axisDim: AxisDimension, onPhysicalChange: (dim: DimensionUnit) => void, onFactorChange: (factor: number) => void, maxMM?: number }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-charcoal">{label} (Physical)</label>
      <UnitInput label={label} value={axisDim.physical} onChange={onPhysicalChange} minMM={1} maxMM={maxMM} step={axisDim.physical.unit === 'mm' ? 1 : 0.125} />
      <label className="text-xs font-medium text-charcoal">{label} Factor</label>
      <input type="range" min={0.1} max={3} step={0.1} value={axisDim.factor} onChange={(e) => onFactorChange(Number(e.target.value))} className="w-full accent-charcoal" />
      <span className="text-xs text-warm-gray">{axisDim.factor.toFixed(2)}x</span>
    </div>
  )
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

function createDefaultRyb(index: number): CustomRyb {
  // Vertically-aligned shelf-like shape
  return {
    id: generateId(),
    name: `Ryb ${index + 1}`,
    index,
    depth: 20,
    segments: [
      { type: 'line', start: { x: 20, y: 10 }, end: { x: 20, y: 200 } },
      { type: 'bezier', start: { x: 20, y: 200 }, end: { x: 80, y: 150 }, control1: { x: 30, y: 230 }, control2: { x: 60, y: 220 } },
      { type: 'bezier', start: { x: 80, y: 150 }, end: { x: 20, y: 10 }, control1: { x: 100, y: 80 }, control2: { x: 50, y: 10 } },
    ]
  }
}

function getCurvePoints(segment: CurveSegment, resolution: number = 20): BezierControlPoint[] {
  const points: BezierControlPoint[] = []

  if (segment.type === 'line') {
    points.push(segment.start, segment.end)
  } else if (segment.type === 'bezier' && segment.control1 && segment.control2) {
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution
      const x = Math.pow(1 - t, 3) * segment.start.x +
        3 * Math.pow(1 - t, 2) * t * segment.control1.x +
        3 * (1 - t) * Math.pow(t, 2) * segment.control2.x +
        Math.pow(t, 3) * segment.end.x
      const y = Math.pow(1 - t, 3) * segment.start.y +
        3 * Math.pow(1 - t, 2) * t * segment.control1.y +
        3 * (1 - t) * Math.pow(t, 2) * segment.control2.y +
        Math.pow(t, 3) * segment.end.y
      points.push({ x, y })
    }
  }

  return points
}

function createRybFromWave(lengthMM: number, h: number, waveHeight: number, waveFrequency: number): CustomRyb {
  const ribCount = 12
  const wavePath = generateWavePath(lengthMM, 0, waveHeight, waveFrequency, ribCount)
  
  const segments: CurveSegment[] = []
  
  // Top edge (following the wave)
  for(let i=0; i<wavePath.length-1; i++) {
    const p1 = wavePath[i]
    const p2 = wavePath[i+1]
    segments.push({
      type: 'line',
      start: { x: (p1.x + lengthMM/2)/lengthMM * 400 + 50, y: 150 + p1.y - h/2 },
      end: { x: (p2.x + lengthMM/2)/lengthMM * 400 + 50, y: 150 + p2.y - h/2 }
    })
  }
  // Right edge
  segments.push({
    type: 'line',
    start: { x: 450, y: 150 + wavePath[wavePath.length-1].y - h/2 },
    end: { x: 450, y: 150 + wavePath[wavePath.length-1].y + h/2 }
  })
  // Bottom edge (straight-ish or mirrored wave, let's do mirrored/equal height)
  for(let i=wavePath.length-1; i>0; i--) {
    const p1 = wavePath[i]
    const p2 = wavePath[i-1]
    segments.push({
      type: 'line',
      start: { x: (p1.x + lengthMM/2)/lengthMM * 400 + 50, y: 150 + p1.y + h/2 },
      end: { x: (p2.x + lengthMM/2)/lengthMM * 400 + 50, y: 150 + p2.y + h/2 }
    })
  }
  // Left edge
  segments.push({
    type: 'line',
    start: { x: 50, y: 150 + wavePath[0].y + h/2 },
    end: { x: 50, y: 150 + wavePath[0].y - h/2 }
  })
  
  return {
    id: generateId(),
    name: 'Organic Base',
    index: 0,
    depth: 20,
    segments
  }
}

function getAllPointsFromRyb(ryb: CustomRyb): BezierControlPoint[] {
  const allPoints: BezierControlPoint[] = []
  ryb.segments.forEach(seg => {
    allPoints.push(...getCurvePoints(seg))
  })
  return allPoints
}

function getCustomRybHeightAtX(ryb: CustomRyb, x: number, lengthMM: number, defaultH: number): number {
  const pts = getAllPointsFromRyb(ryb)
  if (pts.length < 2) return defaultH
  
  // Normalize x from shelf space [-lengthMM/2, lengthMM/2] to editor canvas space [0, 500]
  const normalizedX = (x + lengthMM / 2) / (lengthMM || 1) * 500
  
  // Find points on either side of normalizedX
  const sorted = [...pts].sort((a, b) => a.x - b.x)
  if (normalizedX <= sorted[0].x) return sorted[0].y
  if (normalizedX >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (normalizedX >= sorted[i].x && normalizedX <= sorted[i+1].x) {
      const t = (normalizedX - sorted[i].x) / (sorted[i+1].x - sorted[i].x || 1)
      return sorted[i].y + t * (sorted[i+1].y - sorted[i].y)
    }
  }
  return defaultH
}

interface CustomRybEditorProps {
  initialPoints?: FreeformRibPoint[]
  initialSequence?: CustomRybSequence | null
  onSave: (points: FreeformRibPoint[], sequence: CustomRybSequence) => void
  onClose: () => void
}

function CustomRybEditor({ initialPoints, initialSequence, onSave, onClose }: CustomRybEditorProps) {
  const [sequence, setSequence] = useState<CustomRybSequence>(initialSequence || {
    rybs: [createDefaultRyb(0)],
    spacingType: 'even',
    interpolation: 'linear',
    selectedIndex: 0
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showOnionSkin, setShowOnionSkin] = useState(true)
  const [selectedPoint, setSelectedPoint] = useState<{ rybIndex: number, segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{ segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [editorMode, setEditorMode] = useState<'select' | 'pen' | 'delete' | 'convert'>('select')

  const currentRyb = sequence.rybs[sequence.selectedIndex]

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ryb = sequence.rybs[sequence.selectedIndex]
    let closestDist = 20
    let closest: { rybIndex: number, segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null = null

    ryb.segments.forEach((seg, segIdx) => {
      const checkPoint = (pt: BezierControlPoint, type: 'start' | 'end' | 'control1' | 'control2') => {
        const dist = Math.sqrt(Math.pow(pt.x - x, 2) + Math.pow(pt.y - y, 2))
        if (dist < closestDist) {
          closestDist = dist
          closest = { rybIndex: sequence.selectedIndex, segmentIndex: segIdx, pointType: type }
        }
      }
      checkPoint(seg.start, 'start')
      checkPoint(seg.end, 'end')
      if (seg.control1) checkPoint(seg.control1, 'control1')
      if (seg.control2) checkPoint(seg.control2, 'control2')
    })

    const foundPoint = closest as { rybIndex: number, segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null

    if (editorMode === 'select') {
      setSelectedPoint(foundPoint)
      if (foundPoint) setDragging(true)
    } else if (editorMode === 'delete') {
      if (foundPoint && ryb.segments.length > 1) {
        deleteSegment(foundPoint.segmentIndex)
      }
    } else if (editorMode === 'convert') {
      if (foundPoint) {
        toggleSegmentType(foundPoint.segmentIndex)
      }
    } else if (editorMode === 'pen') {
      const lastSegment = ryb.segments[ryb.segments.length - 1]
      const newRybs = [...sequence.rybs]
      const currentRybMut = { ...ryb, segments: [...ryb.segments] }

      const newSegmentIndex = currentRybMut.segments.length
      const newSegment: CurveSegment = {
        type: 'line',
        start: { ...lastSegment.end },
        end: { x, y }
      }
      currentRybMut.segments.push(newSegment)
      newRybs[sequence.selectedIndex] = currentRybMut

      setSequence(prev => ({ ...prev, rybs: newRybs }))

      setSelectedPoint({ rybIndex: sequence.selectedIndex, segmentIndex: newSegmentIndex, pointType: 'end' })
      setDragging(true)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    if (selectedPoint && dragging) {
      const newRybs = [...sequence.rybs]
      const ryb = { ...newRybs[selectedPoint.rybIndex] }
      const segment = { ...ryb.segments[selectedPoint.segmentIndex] }

      if (selectedPoint.pointType === 'start') segment.start = { x, y }
      else if (selectedPoint.pointType === 'end') segment.end = { x, y }
      else if (selectedPoint.pointType === 'control1' && segment.control1) segment.control1 = { x, y }
      else if (selectedPoint.pointType === 'control2' && segment.control2) segment.control2 = { x, y }

      ryb.segments[selectedPoint.segmentIndex] = segment
      newRybs[selectedPoint.rybIndex] = ryb
      setSequence(prev => ({ ...prev, rybs: newRybs }))
    } else {
      // Hover detection
      const ryb = sequence.rybs[sequence.selectedIndex]
      let closestDist = 20
      let closest: { segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null = null
      ryb.segments.forEach((seg, segIdx) => {
        const checkPt = (pt: BezierControlPoint, type: 'start' | 'end' | 'control1' | 'control2') => {
          const dist = Math.sqrt(Math.pow(pt.x - x, 2) + Math.pow(pt.y - y, 2))
          if (dist < closestDist) {
            closestDist = dist
            closest = { segmentIndex: segIdx, pointType: type }
          }
        }
        checkPt(seg.start, 'start')
        checkPt(seg.end, 'end')
        if (seg.control1) checkPt(seg.control1, 'control1')
        if (seg.control2) checkPt(seg.control2, 'control2')
      })
      setHoveredPoint(closest)
    }
  }

  const addRyb = () => {
    const prevRyb = sequence.rybs[sequence.rybs.length - 1]
    const newRyb: CustomRyb = {
      ...prevRyb,
      id: `ryb-${Date.now()}-${Math.random()}`,
      name: `Ryb ${sequence.rybs.length + 1}`,
      index: sequence.rybs.length,
      segments: prevRyb.segments.map(s => ({
        ...s,
        start: { ...s.start },
        end: { ...s.end },
        control1: s.control1 ? { ...s.control1 } : undefined,
        control2: s.control2 ? { ...s.control2 } : undefined
      }))
    }
    setSequence(prev => ({
      ...prev,
      rybs: [...prev.rybs, newRyb],
      selectedIndex: prev.rybs.length
    }))
  }

  const deleteRyb = (index: number) => {
    if (sequence.rybs.length <= 1) return
    const newRybs = sequence.rybs.filter((_, i) => i !== index)
    setSequence(prev => ({
      ...prev,
      rybs: newRybs,
      selectedIndex: Math.min(prev.selectedIndex, newRybs.length - 1)
    }))
  }

  const addSegment = () => {
    const newRybs = [...sequence.rybs]
    const ryb = { ...newRybs[sequence.selectedIndex] }
    const lastSegment = ryb.segments[ryb.segments.length - 1]
    ryb.segments.push({
      type: 'line',
      start: { ...lastSegment.end },
      end: { x: lastSegment.end.x + 30, y: lastSegment.end.y - 20 }
    })
    newRybs[sequence.selectedIndex] = ryb
    setSequence(prev => ({ ...prev, rybs: newRybs }))
  }

  const toggleSegmentType = (segIdx: number) => {
    const newRybs = [...sequence.rybs]
    const ryb = { ...newRybs[sequence.selectedIndex] }
    const seg = { ...ryb.segments[segIdx] }
    if (seg.type === 'line') {
      seg.type = 'bezier'
      const midX = (seg.start.x + seg.end.x) / 2
      const midY = (seg.start.y + seg.end.y) / 2
      seg.control1 = { x: midX - 20, y: midY - 20 }
      seg.control2 = { x: midX + 20, y: midY + 20 }
    } else {
      seg.type = 'line'
      delete seg.control1
      delete seg.control2
    }
    ryb.segments[segIdx] = seg
    newRybs[sequence.selectedIndex] = ryb
    setSequence(prev => ({ ...prev, rybs: newRybs }))
  }

  const renameRyb = (index: number, name: string) => {
    const newRybs = [...sequence.rybs]
    newRybs[index] = { ...newRybs[index], name }
    setSequence(prev => ({ ...prev, rybs: newRybs }))
  }

  const deleteSegment = (segIdx: number) => {
    const newRybs = [...sequence.rybs]
    const ryb = { ...newRybs[sequence.selectedIndex] }
    if (ryb.segments.length <= 1) return
    ryb.segments = ryb.segments.filter((_, i) => i !== segIdx)
    newRybs[sequence.selectedIndex] = ryb
    setSequence(prev => ({ ...prev, rybs: newRybs }))
    setSelectedPoint(null)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set appropriate cursor based on editor mode
    // Using simple inline styles to avoid needing custom CSS cursor images for now
    if (editorMode === 'pen') {
      canvas.style.cursor = 'crosshair'
    } else if (editorMode === 'delete') {
      canvas.style.cursor = 'no-drop'
    } else if (editorMode === 'convert') {
      canvas.style.cursor = 'pointer'
    } else {
      canvas.style.cursor = dragging ? 'grabbing' : (hoveredPoint ? 'grab' : 'default')
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#C67B5C'
    ctx.fillRect(0, 0, 4, canvas.height)
    ctx.font = '12px DM Sans'
    ctx.fillStyle = '#C67B5C'
    ctx.fillText('← Wall', 10, 20)

    const ryb = sequence.rybs[sequence.selectedIndex]
    const allPoints = getAllPointsFromRyb(ryb)

    if (allPoints.length > 0) {
      ctx.strokeStyle = '#2C2A26'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(allPoints[0].x, allPoints[0].y)
      allPoints.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.stroke()
      ctx.fillStyle = 'rgba(44, 42, 38, 0.1)'
      ctx.fill()
    }

    if (showOnionSkin && sequence.selectedIndex > 0) {
      const prevRyb = sequence.rybs[sequence.selectedIndex - 1]
      const prevPoints = getAllPointsFromRyb(prevRyb)
      if (prevPoints.length > 0) {
        ctx.strokeStyle = 'rgba(44, 42, 38, 0.15)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(prevPoints[0].x, prevPoints[0].y)
        prevPoints.forEach(p => ctx.lineTo(p.x, p.y))
        ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    ryb.segments.forEach((seg, segIdx) => {
      const drawPoint = (pt: BezierControlPoint, type: string, isSelected: boolean, pointType: string) => {
        const isHovered = hoveredPoint?.segmentIndex === segIdx && hoveredPoint?.pointType === pointType
        const radius = isSelected ? 8 : (isHovered ? 8 : 6)

        // Hover glow ring
        if (isHovered && !isSelected) {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(198, 123, 92, 0.2)'
          ctx.fill()
          ctx.strokeStyle = '#C67B5C'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = isSelected ? '#C67B5C' : (isHovered ? '#D4896E' : (type === 'control' ? '#8B5A3C' : '#2C2A26'))
        ctx.fill()
        if (isSelected) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      if (seg.control1) {
        ctx.strokeStyle = '#8B5A3C'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(seg.start.x, seg.start.y)
        ctx.lineTo(seg.control1.x, seg.control1.y)
        ctx.stroke()
        ctx.setLineDash([])
        drawPoint(seg.control1, 'control', selectedPoint?.segmentIndex === segIdx && selectedPoint?.pointType === 'control1', 'control1')
      }

      if (seg.control2) {
        ctx.strokeStyle = '#8B5A3C'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(seg.end.x, seg.end.y)
        ctx.lineTo(seg.control2.x, seg.control2.y)
        ctx.stroke()
        ctx.setLineDash([])
        drawPoint(seg.control2, 'control', selectedPoint?.segmentIndex === segIdx && selectedPoint?.pointType === 'control2', 'control2')
      }

      drawPoint(seg.start, 'endpoint', selectedPoint?.segmentIndex === segIdx && selectedPoint?.pointType === 'start', 'start')
      drawPoint(seg.end, 'endpoint', selectedPoint?.segmentIndex === segIdx && selectedPoint?.pointType === 'end', 'end')
    })
  }, [sequence, selectedPoint, hoveredPoint, showOnionSkin])

  const convertToFreeformPoints = (): FreeformRibPoint[] => {
    const ryb = sequence.rybs[sequence.selectedIndex]
    const points = getAllPointsFromRyb(ryb)
    return points.map(p => ({ x: p.x * 2, y: p.y * 2 }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 overflow-auto">
      <div className="bg-cream rounded-2xl p-6 max-w-3xl w-full mx-4 my-8 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-charcoal">Custom Ryb Editor</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-stone cursor-pointer">
              <input type="checkbox" checked={showOnionSkin} onChange={(e) => setShowOnionSkin(e.target.checked)} className="rounded border-stone/30 text-charcoal focus:ring-charcoal" />
              Onion Skin
            </label>
            <button onClick={onClose} className="text-stone hover:text-charcoal pl-2">✕</button>
          </div>
        </div>

        <p className="text-warm-gray text-sm mb-4">Edit bezier curves and lines. Click points to select and drag to move. The flat back edge is on the left.</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {sequence.rybs.map((ryb, idx) => (
            <button
              key={ryb.id}
              onClick={() => setSequence(prev => ({ ...prev, selectedIndex: idx }))}
              onDoubleClick={() => {
                const name = prompt('Rename ryb:', ryb.name)
                if (name) renameRyb(idx, name)
              }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${sequence.selectedIndex === idx ? 'bg-charcoal text-cream' : 'bg-stone/10 text-charcoal hover:bg-stone/20'}`}
              title="Double-click to rename"
            >
              {ryb.name}
            </button>
          ))}
          <button onClick={addRyb} className="px-3 py-1.5 text-sm rounded-lg bg-oak/20 text-charcoal hover:bg-oak/30">+ Add</button>
        </div>

        {/* Freeform Toolbar */}
        <div className="flex gap-2 mb-4 flex-wrap p-2 bg-stone/5 rounded-lg border border-stone/10">
          <button
            onClick={() => setEditorMode('select')}
            className={`px-4 py-1.5 text-sm rounded transition-all font-medium flex items-center gap-2 ${editorMode === 'select' ? 'bg-charcoal text-cream shadow-sm' : 'text-stone hover:text-charcoal hover:bg-stone/10'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>
            Select
          </button>
          <button
            onClick={() => setEditorMode('pen')}
            className={`px-4 py-1.5 text-sm rounded transition-all font-medium flex items-center gap-2 ${editorMode === 'pen' ? 'bg-charcoal text-cream shadow-sm' : 'text-stone hover:text-charcoal hover:bg-stone/10'}`}
            title="Click canvas to add connected points"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
            Pen
          </button>
          <button
            onClick={() => setEditorMode('convert')}
            className={`px-4 py-1.5 text-sm rounded transition-all font-medium flex items-center gap-2 ${editorMode === 'convert' ? 'bg-charcoal text-cream shadow-sm' : 'text-stone hover:text-charcoal hover:bg-stone/10'}`}
            title="Click existing points to toggle Line↔Bezier"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 21v-4a4 4 0 014-4h5l-3-3 3 3-3 3" /></svg>
            Convert
          </button>
          <button
            onClick={() => setEditorMode('delete')}
            className={`px-4 py-1.5 text-sm rounded transition-all font-medium flex items-center gap-2 ${editorMode === 'delete' ? 'bg-charcoal text-cream shadow-sm' : 'text-stone hover:text-charcoal hover:bg-stone/10'}`}
            title="Click points/segments to remove them"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
            Delete
          </button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={addSegment} className="px-3 py-1.5 text-sm rounded-lg bg-stone/10 text-charcoal hover:bg-stone/20">+ Add Segment</button>
          {sequence.rybs.length > 1 && (
            <button onClick={() => deleteRyb(sequence.selectedIndex)} className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200">Delete Ryb</button>
          )}
        </div>

        <div className="flex gap-1 mb-3 flex-wrap">
          {currentRyb.segments.map((seg, segIdx) => (
            <div key={segIdx} className="flex items-center gap-1">
              <button
                onClick={() => toggleSegmentType(segIdx)}
                className={`px-2 py-1 text-xs rounded transition-all ${seg.type === 'bezier' ? 'bg-oak/30 text-charcoal' : 'bg-stone/10 text-charcoal hover:bg-stone/20'}`}
                title={`Segment ${segIdx + 1}: Click to toggle line/bezier`}
              >
                S{segIdx + 1}: {seg.type === 'bezier' ? '◠ Bezier' : '— Line'}
              </button>
              {currentRyb.segments.length > 1 && (
                <button onClick={() => deleteSegment(segIdx)} className="px-1 py-1 text-xs text-red-500 hover:text-red-700" title="Delete segment">✕</button>
              )}
            </div>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          width={500}
          height={300}
          className="w-full border border-stone/20 rounded-lg bg-white"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => { setDragging(false) }}
          onMouseLeave={() => { setDragging(false) }}
        />

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <label className="text-xs text-warm-gray block mb-1">Spacing</label>
            <select
              value={sequence.spacingType}
              onChange={(e) => setSequence(prev => ({ ...prev, spacingType: e.target.value as 'even' | 'custom' }))}
              className="w-full px-3 py-2 text-sm bg-white border border-stone/20 rounded-lg"
            >
              <option value="even">Evenly Spaced</option>
              <option value="custom">Custom Spacing</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-warm-gray block mb-1">Interpolation</label>
            <select
              value={sequence.interpolation}
              onChange={(e) => setSequence(prev => ({ ...prev, interpolation: e.target.value as CustomRybSequence['interpolation'] }))}
              className="w-full px-3 py-2 text-sm bg-white border border-stone/20 rounded-lg"
            >
              <option value="linear">Linear</option>
              <option value="ease-in">Ease In</option>
              <option value="ease-out">Ease Out</option>
              <option value="ease-in-out">Ease In-Out</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-warm-gray block mb-1">Ryb Count</label>
            <input
              type="number"
              min={1}
              max={30}
              value={sequence.rybs.length}
              onChange={(e) => {
                const count = parseInt(e.target.value) || 1
                const newRybs = [...sequence.rybs]
                while (newRybs.length < count) {
                  const prevRyb = newRybs[newRybs.length - 1]
                  newRybs.push({
                    ...prevRyb,
                    id: `ryb-${Date.now()}-${Math.random()}`,
                    name: `Ryb ${newRybs.length + 1}`,
                    index: newRybs.length,
                    segments: prevRyb.segments.map(s => ({
                      ...s,
                      start: { ...s.start },
                      end: { ...s.end },
                      control1: s.control1 ? { ...s.control1 } : undefined,
                      control2: s.control2 ? { ...s.control2 } : undefined
                    }))
                  })
                }
                while (newRybs.length > count) newRybs.pop()
                if (sequence.selectedIndex >= newRybs.length) {
                  setSequence(prev => ({ ...prev, rybs: newRybs, selectedIndex: newRybs.length - 1 }))
                } else {
                  setSequence(prev => ({ ...prev, rybs: newRybs }))
                }
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-stone/20 rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone hover:text-charcoal">Cancel</button>
          <button onClick={() => {
            const points = convertToFreeformPoints()
            onSave(points, sequence)
          }} className="flex-1 px-4 py-2 bg-charcoal text-cream rounded-lg hover:bg-stone">Save & Use</button>
        </div>
      </div>
    </div>
  )
}

// FreeformDrawer removed — replaced by CustomRybEditor above

function DeveloperConfig({ config, onChange }: { config: typeof INITIAL_SITE_CONFIG, onChange: (c: typeof INITIAL_SITE_CONFIG) => void }) {
  const [open, setOpen] = useState(false)
  if (!open) return (
    <div className="mt-8 border-t border-stone/10 pt-4">
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-xs font-medium text-stone hover:text-charcoal transition-colors">
        <span>⚙️</span> Developer Parameters
      </button>
    </div>
  )

  return (
    <div className="mt-8 border-t border-stone/10 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-display text-charcoal flex items-center gap-2"><span>⚙️</span> Developer Parameters</h4>
        <button onClick={() => setOpen(false)} className="text-xs text-stone hover:text-charcoal pl-2">✕</button>
      </div>
      <div className="space-y-3 p-3 bg-stone/5 rounded-lg border border-stone/10">
        {Object.entries(config).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-[10px] text-stone uppercase tracking-wider">{key}</label>
            <input type="number" step="any" value={value} onChange={e => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) onChange({ ...config, [key]: num })
            }} className="w-full px-2 py-1 text-xs bg-white border border-stone/20 rounded focus:border-charcoal outline-none" />
          </div>
        ))}
      </div>
    </div>
  )
}

function App() {
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === 'admin'
  const [siteConfig, setSiteConfig] = useState(INITIAL_SITE_CONFIG)
  const [globalUnit, setGlobalUnit] = useState<Unit>('mm')

  const handleGlobalUnitChange = (newUnit: Unit) => {
    if (globalUnit === newUnit) return;
    setGlobalUnit(newUnit)
    const convert = (dim: DimensionUnit): DimensionUnit => {
      if (dim.unit === newUnit) return dim;
      return {
        value: newUnit === 'mm' ? dim.value * MM_PER_INCH : dim.value / MM_PER_INCH,
        unit: newUnit
      };
    }
    setParams(prev => ({
      ...prev,
      length: convert(prev.length),
      height: convert(prev.height),
      ribDepth: convert(prev.ribDepth),
      materialThickness: convert(prev.materialThickness),
      ribSize: convert(prev.ribSize),
      ribX: { ...prev.ribX, physical: convert(prev.ribX.physical) },
      ribY: { ...prev.ribY, physical: convert(prev.ribY.physical) },
      ribZ: { ...prev.ribZ, physical: convert(prev.ribZ.physical) },
    }))
  }

  const [params, setParams] = useState<ShelfParams>({
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
  })

  const [activeSection, setActiveSection] = useState('design')
  const [activePreset, setActivePreset] = useState('gentle')
  const [ribViewMode, setRibViewMode] = useState<ViewMode>('3d')
  const [shelfViewMode, setShelfViewMode] = useState<ViewMode>('3d')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [showExport, setShowExport] = useState(false)
  const [showFreeformDrawer, setShowFreeformDrawer] = useState(false)
  const [showBackplaneEditor, setShowBackplaneEditor] = useState(false)
  const [uploadedMesh, setUploadedMesh] = useState<THREE.Mesh | null>(null)
  const [uploadedMeshRotation, setUploadedMeshRotation] = useState({ x: 180, y: -90, z: 0 })
  const [uploadedMeshScale, setUploadedMeshScale] = useState(1.0)
  const [isSlicing, setIsSlicing] = useState(false)
  const [freeformPoints, setFreeformPoints] = useState<FreeformRibPoint[]>([])
  const [customRybSequence, setCustomRybSequence] = useState<CustomRybSequence | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const contents = event.target?.result
      if (!contents) return
      
      const extension = file.name.split('.').pop()?.toLowerCase()
      
      try {
        if (extension === 'stl') {
          const loader = new STLLoader()
          const geometry = loader.parse(contents as ArrayBuffer)
          const material = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, transparent: true, opacity: 0.5 })
          const mesh = new THREE.Mesh(geometry, material)
          setUploadedMesh(mesh)
        } else if (extension === 'obj') {
          const loader = new OBJLoader()
          const object = loader.parse(contents as string)
          let mesh: THREE.Mesh | null = null
          object.traverse((child: any) => {
            if (child.isMesh) mesh = child as THREE.Mesh
          })
          if (mesh) {
            (mesh as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, transparent: true, opacity: 0.5 })
            setUploadedMesh(mesh)
          }
        }
      } catch (err) {
        console.error('Error loading mesh:', err)
        alert('Failed to load 3D mesh. Please ensure it is a valid STL or OBJ file.')
      }
    }
    
    if (file.name.endsWith('.stl')) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  }

  const handleApplySlicing = () => {
    if (!uploadedMesh) return
    setIsSlicing(true)
    
    // Move heavy computation to a macrotask to keep UI responsive
    setTimeout(() => {
      try {
        const sequence = sliceMeshToRybs(uploadedMesh, params)
        setCustomRybSequence(sequence)
        handleParamChange('ribShape', 'freeform')
        alert(`Successfully converted 3D mesh into ${sequence.rybs.length} ribs.`)
      } catch (err) {
        console.error('Slicing error:', err)
        alert('Error slicing mesh. Please try a simpler model.')
      } finally {
        setIsSlicing(false)
      }
    }, 100)
  }

  function sliceMeshToRybs(mesh: THREE.Mesh, params: ShelfParams): CustomRybSequence {
    const ribCount = params.ribCount
    const rybs: CustomRyb[] = []
    
    mesh.geometry.computeBoundingBox()
    const bbox = mesh.geometry.boundingBox!
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const center = new THREE.Vector3()
    bbox.getCenter(center)
    
    const raycaster = new THREE.Raycaster()
    
    for (let i = 0; i < ribCount; i++) {
      const t = i / (ribCount - 1 || 1)
      const x = center.x - size.x/2 + t * size.x
      
      const segments: CurveSegment[] = []
      const resolution = 12 // Number of samples across depth
      const topPts: {x: number, y: number}[] = []
      const bottomPts: {x: number, y: number}[] = []
      
      for (let j = 0; j <= resolution; j++) {
          const tz = j / resolution
          const z = center.z - size.z/2 + tz * size.z
          
          // Ray from far above
          raycaster.set(new THREE.Vector3(x, center.y + size.y * 2, z), new THREE.Vector3(0, -1, 0))
          const intersectsTop = raycaster.intersectObject(mesh)
          
          // Ray from far below
          raycaster.set(new THREE.Vector3(x, center.y - size.y * 2, z), new THREE.Vector3(0, 1, 0))
          const intersectsBottom = raycaster.intersectObject(mesh)
          
          if (intersectsTop.length > 0 && intersectsBottom.length > 0) {
              // Map 3D mesh local space to 500x300 editor canvas space
              const canvasX = tz * 400 + 50
              const normTopY = (intersectsTop[0].point.y - center.y) / (size.y || 1)
              const normBottomY = (intersectsBottom[0].point.y - center.y) / (size.y || 1)
              
              const canvasTopY = 150 - normTopY * 100
              const canvasBottomY = 150 - normBottomY * 100
              
              topPts.push({x: canvasX, y: canvasTopY})
              bottomPts.push({x: canvasX, y: canvasBottomY})
          }
      }
      
      if (topPts.length > 1) {
          for(let k=0; k<topPts.length-1; k++) segments.push({type:'line', start: topPts[k], end: topPts[k+1]})
          segments.push({type:'line', start: topPts[topPts.length-1], end: bottomPts[bottomPts.length-1]})
          for(let k=bottomPts.length-1; k>0; k--) segments.push({type:'line', start: bottomPts[k], end: bottomPts[k-1]})
          segments.push({type:'line', start: bottomPts[0], end: topPts[0]})
      } else {
        // Fallback for empty slice
        segments.push({type:'line', start:{x:50,y:140}, end:{x:450,y:140}})
        segments.push({type:'line', start:{x:450,y:140}, end:{x:450,y:160}})
        segments.push({type:'line', start:{x:450,y:160}, end:{x:50,y:160}})
        segments.push({type:'line', start:{x:50,y:160}, end:{x:50,y:140}})
      }
      
      rybs.push({
          id: `ryb-${Date.now()}-${i}`,
          name: `Slice ${i+1}`,
          index: i,
          depth: 20,
          segments
      })
    }
    
    return {
      rybs,
      selectedIndex: 0,
      spacingType: 'even',
      interpolation: 'linear'
    } as CustomRybSequence
  }
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [cyclingRybIndex, setCyclingRybIndex] = useState(0)
  const [cyclingFadeIn, setCyclingFadeIn] = useState(true)
  const [expandedRibEditor, setExpandedRibEditor] = useState(false)
  const [expandedShelfEditor, setExpandedShelfEditor] = useState(false)
  const [selectedRibIndex, setSelectedRibIndex] = useState<number | undefined>(undefined)

  // Map a keyframe index (within customRybSequence.rybs) to the corresponding shelf position index
  const keyframeToShelfIndex = useCallback((keyframeIdx: number): number | undefined => {
    if (!customRybSequence || customRybSequence.rybs.length <= 1) return undefined
    const K = customRybSequence.rybs.length
    const N = params.ribCount
    if (N <= 1) return 0
    // keyframe k is at t = k / (K - 1), shelf position = round(t * (N - 1))
    const t = keyframeIdx / (K - 1)
    return Math.round(t * (N - 1))
  }, [customRybSequence, params.ribCount])

  // Only pass freeform points when shape is actually freeform
  const activeFreeformPoints = params.ribShape === 'freeform' ? freeformPoints : undefined

  // Cycle through ryb indices for the mini preview
  useEffect(() => {
    const totalRybs = params.ribCount
    if (totalRybs <= 1) return
    const interval = setInterval(() => {
      setCyclingFadeIn(false)
      setTimeout(() => {
        setCyclingRybIndex(prev => (prev + 1) % totalRybs)
        setCyclingFadeIn(true)
      }, siteConfig.previewFadeDurationMs)
    }, siteConfig.previewCycleIntervalMs)
    return () => clearInterval(interval)
  }, [params.ribCount, siteConfig.previewCycleIntervalMs, siteConfig.previewFadeDurationMs])

  const calculations = useMemo(() => calculateSheetsNeeded(params), [
    params.length.value, params.length.unit, params.height.value, params.height.unit,
    params.materialThickness.value, params.materialThickness.unit, params.ribCount,
    params.ribX.physical.value, params.ribX.factor, params.ribY.physical.value, params.ribY.factor
  ])

  const selectedMaterial = useMemo(() => MATERIALS.find(m => m.id === params.material) || MATERIALS[0], [params.material])
  const selectedFinish = useMemo(() => FINISHES.find(f => f.id === params.finish) || FINISHES[0], [params.finish])
  const basePrice = useMemo(() => selectedMaterial.price * calculations.sheets, [selectedMaterial.price, calculations.sheets])
  const finishPrice = useMemo(() => selectedFinish.price * params.ribCount, [selectedFinish.price, params.ribCount])
  const totalPrice = useMemo(() => basePrice + finishPrice + 35, [basePrice, finishPrice])

  const handleParamChange = (key: keyof ShelfParams, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

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

  const handlePresetClick = (presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId)
    if (preset) {
      setActivePreset(presetId)
      handleParamChange('waveHeight', preset.params.waveHeight)
      handleParamChange('waveFrequency', preset.params.waveFrequency)
      handleParamChange('ribCount', preset.params.ribCount)
    }
  }

  const userEmail = user?.primaryEmailAddress?.emailAddress

  const handleStripeCheckout = async () => {
    setIsRedirecting(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params, price: totalPrice, userEmail })
      })
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No Checkout URL returned:', data)
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setIsRedirecting(false)
    }
  }

  const handleExport = (format: 'svg' | 'dxf') => {
    setIsExporting(true)
    try {
      const lengthMM = toMM(params.length)
      const waveHeightMM = toMM(params.height)
      const widthMM = toMM(params.ribX.physical) * params.ribX.factor
      const heightMM = toMM(params.ribY.physical) * params.ribY.factor
      const sheetW = 1220
      const sheetH = 2440
      // Prepare ryb profiles
      const rybProfiles: { width: number; height: number; shape: string; freeformPts?: { x: number, y: number }[]; rotateX?: number; rotateY?: number; rotateZ?: number; thickness?: number }[] = []
      const rybPositions: { x: number; y: number; angle?: number }[] = []
      const wavePath = generateWavePath(lengthMM, waveHeightMM, params.waveHeight, params.waveFrequency, params.ribCount)

      const rybParams = generateAllRibParams(params, wavePath, freeformPoints, customRybSequence)
      const rybThicknessMM = toMM(params.ribZ.physical) * params.ribZ.factor

      for (let i = 0; i < params.ribCount; i++) {
        const p = rybParams[i]
        rybProfiles.push({
          width: p.width,
          height: p.height,
          shape: p.shape,
          freeformPts: p.freeformPts,
          rotateX: p.rotateX,
          rotateY: p.rotateY,
          rotateZ: p.rotateZ,
          thickness: rybThicknessMM
        })
        rybPositions.push({
          x: wavePath[i].x,
          y: wavePath[i].y,
          angle: p.rotateZ
        })
      }

      // Also generate high resolution path to give a physically accurate curved wave geometry boundary
      const highResWavePath = generateWavePath(lengthMM, waveHeightMM, params.waveHeight, params.waveFrequency, 100)

      // Generate the DXF/SVG model via the unified CNC layout builder
      const fullModel = generateCncLayout(
        rybProfiles,
        {
          enabled: params.backplaneEnabled,
          shape: params.backplaneShape,
          organicOffset: params.backplaneOrganicOffset,
          materialThickness: params.backplaneMaterialThickness,
          slotDepth: params.backplaneSlotDepth,
          dogboneRadius: params.backplaneDogboneRadius,
          autoSlots: true,
          manualSlotPositions: []
        },
        rybPositions,
        highResWavePath
      )

      if (format === 'svg') {
        const svg = makerjs.exporter.toSVG(fullModel, {
          units: makerjs.unitType.Millimeter,
          stroke: 'black',
          strokeWidth: '0.5px',
          fill: 'none',
        })
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `rybform-cutfile-${params.ribCount}rybs.svg`; a.click()
        URL.revokeObjectURL(url)
      } else {
        const dxf = makerjs.exporter.toDXF(fullModel, {
          units: makerjs.unitType.Millimeter
        })
        const blob = new Blob([dxf], { type: 'application/dxf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `rybform-cutfile-${params.ribCount}rybs.dxf`; a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
      setShowExport(false)
    }
  }

  const handleResetRyb = () => {
    setFreeformPoints([])
    setCustomRybSequence(null)
  }

  const handleResetAllRybs = () => {
    setFreeformPoints([])
    setCustomRybSequence(null)
    setParams(prev => ({ ...prev, ribShape: 'square' }))
  }

  return (
    <div className="min-h-screen grain">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-md border-b border-stone/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-charcoal text-cream flex items-center justify-center font-display text-xl">P</div>
            <span className="font-display text-2xl text-charcoal">Rybform</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => setActiveSection('design')} className={`text-sm tracking-wide transition-colors ${activeSection === 'design' ? 'text-charcoal' : 'text-warm-gray hover:text-stone'}`}>Designer</button>
            {user ? (
              <>
                {isAdmin && (
                  <button onClick={() => setShowExport(true)} className="text-sm tracking-wide text-oak hover:text-charcoal transition-colors">Export</button>
                )}
                <UserButton />
              </>
            ) : (
              <SignInButton mode="modal">
                <button className="btn-primary text-sm py-2 px-5">Sign In</button>
              </SignInButton>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero */}
        <section className="relative min-h-[50vh] flex items-center bg-gradient-to-b from-cream to-ivory overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-terracotta text-sm tracking-[0.2em] uppercase mb-4">Ryb-Based Design</p>
              <h1 className="font-display text-4xl md:text-5xl text-charcoal leading-[1.1] mb-6">
                Shape by shape,<span className="block italic text-oak">ryb by ryb</span>
              </h1>
              <p className="text-stone mb-6">Explore the beauty of parametric architecture. Real-time 3D generation for CNC fabrication.</p>
            </div>
            <div className="relative h-[350px]">
              <Canvas camera={{ position: [800, 600, 1200], fov: 45, near: 1, far: 10000 }} className="w-full h-full">
                <Scene params={params} viewMode={'3d'} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} canvasId="hero-canvas" autoSweep enableOrbit={true} siteConfig={siteConfig} showGizmo={false} />
              </Canvas>
              {/* Cycling Single Ryb Preview Overlay */}
              <div className="absolute top-4 right-4 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="w-36 h-36 bg-cream/90 backdrop-blur-md rounded-xl overflow-hidden border-2 border-charcoal/10 shadow-2xl">
                  <Canvas shadows camera={{ position: [20, 15, 25], fov: 35, near: 0.1, far: 5000 }} style={{ opacity: cyclingFadeIn ? 1 : 0, transition: `opacity ${siteConfig.previewFadeDurationMs}ms ease-in-out` }} className="w-full h-full">
                    <Scene params={params} viewMode={'3d'} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} isSingleRib={true} canvasId="mini-single-canvas" autoSweep enableOrbit={false} siteConfig={siteConfig} showGizmo={false} isPreview={true} />
                  </Canvas>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Designer */}
        <section id="designer" className="py-16 bg-ivory">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex justify-between items-baseline mb-8 pb-4 border-b border-stone/10">
              <h2 className="font-display text-3xl text-charcoal">Designer</h2>
              <p className="text-sm text-stone">Studio for Parametric Generative Design</p>
            </div>

            <div className="grid lg:grid-cols-4 gap-8">
              <aside className="lg:col-span-1 space-y-6">
                {/* 3D Shape Upload */}
                <div className="bg-cream rounded-xl p-5 border border-stone/10 shadow-sm">
                  <h3 className="font-display text-sm text-charcoal mb-4 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    3D Shape Integration
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-stone/10 border-dashed rounded-xl cursor-pointer bg-stone/5 hover:bg-stone/10 transition-all py-4 px-2">
                        <div className="flex flex-col items-center justify-center text-center">
                          <p className="mb-2 text-xs text-stone"><span className="font-semibold">Upload 3D Mesh</span></p>
                          <p className="text-[10px] text-stone/50 font-mono">STL or OBJ</p>
                        </div>
                        <input type="file" className="hidden" accept=".stl,.obj" onChange={handleFileUpload} />
                      </label>
                    </div>
                    {uploadedMesh && (
                        <div className="space-y-3 p-3 bg-oak/5 rounded-lg border border-oak/10 animate-in fade-in zoom-in duration-300">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-oak uppercase tracking-wider">Mesh Controls</span>
                            <button onClick={() => setUploadedMesh(null)} className="p-1 hover:bg-red-50 rounded text-stone hover:text-red-500">✕</button>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] text-stone/60 font-medium">Rotation X</label>
                            <input type="range" min="0" max="360" value={uploadedMeshRotation.x} onChange={(e) => setUploadedMeshRotation({...uploadedMeshRotation, x: parseInt(e.target.value)})} className="w-full accent-charcoal" />
                            <label className="text-[10px] text-stone/60 font-medium">Rotation Y</label>
                            <input type="range" min="0" max="360" value={uploadedMeshRotation.y} onChange={(e) => setUploadedMeshRotation({...uploadedMeshRotation, y: parseInt(e.target.value)})} className="w-full accent-charcoal" />
                            <label className="text-[10px] text-stone/60 font-medium">Scale</label>
                            <input type="number" step="0.1" value={uploadedMeshScale} onChange={(e) => setUploadedMeshScale(parseFloat(e.target.value))} className="w-full px-2 py-1 text-xs rounded border border-stone/20" />
                          </div>

                          <button 
                            disabled={isSlicing}
                            onClick={handleApplySlicing} 
                            className={`w-full px-4 py-2 rounded-lg transition-all text-xs font-bold shadow-sm ${isSlicing ? 'bg-stone/20 text-stone cursor-wait' : 'bg-charcoal text-white hover:bg-charcoal/90 hover:scale-[1.02]'}`}
                          >
                            {isSlicing ? 'Processing Mesh...' : 'Convert to Rybs'}
                          </button>
                        </div>
                    )}
                  </div>
                </div>

                {/* Unit Selection */}
                <div className="bg-cream rounded-xl p-5 border border-stone/10 shadow-sm">
                  <h3 className="text-xs font-bold text-stone/60 uppercase tracking-[0.1em] mb-3">Measurement System</h3>
                  <div className="flex bg-stone/5 p-1 rounded-lg border border-stone/10">
                    <button
                      onClick={() => handleGlobalUnitChange('mm')}
                      className={`flex-1 px-3 py-2 text-xs rounded-md transition-all font-medium ${globalUnit === 'mm' ? 'bg-white text-charcoal shadow-sm' : 'text-stone hover:text-charcoal'}`}
                    >
                      Metric (mm)
                    </button>
                    <button
                      onClick={() => handleGlobalUnitChange('in')}
                      className={`flex-1 px-3 py-2 text-xs rounded-md transition-all font-medium ${globalUnit === 'in' ? 'bg-white text-charcoal shadow-sm' : 'text-stone hover:text-charcoal'}`}
                    >
                      Imperial (in)
                    </button>
                  </div>
                </div>
              </aside>

              <div className="lg:col-span-3 space-y-6">

            {/* Single Rib Preview */}
            <div className="mb-6">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-base text-charcoal">Single Ryb Editor</h3>
                    {customRybSequence && customRybSequence.rybs.length > 1 && (
                      <div className="flex items-center gap-1 bg-cream rounded-lg px-2 py-0.5">
                        <button onClick={() => { const idx = Math.max(0, (customRybSequence.selectedIndex || 0) - 1); setCustomRybSequence({ ...customRybSequence, selectedIndex: idx }); setSelectedRibIndex(keyframeToShelfIndex(idx)) }} className="px-1.5 py-0.5 text-xs rounded hover:bg-stone/10 transition-all text-charcoal">◀</button>
                        <span className="text-xs text-charcoal font-medium px-1">Ryb {(customRybSequence.selectedIndex || 0) + 1}/{customRybSequence.rybs.length}</span>
                        <button onClick={() => { const idx = Math.min(customRybSequence.rybs.length - 1, (customRybSequence.selectedIndex || 0) + 1); setCustomRybSequence({ ...customRybSequence, selectedIndex: idx }); setSelectedRibIndex(keyframeToShelfIndex(idx)) }} className="px-1.5 py-0.5 text-xs rounded hover:bg-stone/10 transition-all text-charcoal">▶</button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-cream rounded-lg p-1">
                      {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                        <button key={mode} onClick={() => setRibViewMode(mode)} className={`px-3 py-1 text-xs rounded-md transition-all ${ribViewMode === mode ? 'bg-charcoal text-cream' : 'text-stone hover:text-charcoal'}`}>
                          {mode === '3d' ? '3D' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                      <button onClick={() => setRibViewMode('3d')} className="px-2 py-1 text-xs rounded-md transition-all text-stone hover:text-charcoal ml-1">↺</button>
                    </div>
                    <button onClick={() => setExpandedRibEditor(true)} className="px-2 py-1 text-xs rounded-md text-stone hover:text-charcoal hover:bg-cream transition-all" title="Expand editor">⤢</button>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4 single-ryb-layout">
                  <div className="w-full md:w-72 h-56 md:h-72 shrink-0 bg-stone/5 rounded-lg overflow-hidden border border-stone/10">
                    <Canvas camera={{ position: [200, 150, 250], fov: 40, near: 1, far: 10000 }} className="w-full h-full">
                      <Scene params={params} viewMode={ribViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} isSingleRib={true} canvasId="rib-canvas" siteConfig={siteConfig} enableOrbit={true} showGizmo={true} />
                    </Canvas>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <AxisDimensionControl label="X (Width)" axisDim={params.ribX} onPhysicalChange={handleRibXPhysicalChange} onFactorChange={handleRibXFactorChange} maxMM={1000} />
                      <AxisDimensionControl label="Y (Height)" axisDim={params.ribY} onPhysicalChange={handleRibYPhysicalChange} onFactorChange={handleRibYFactorChange} maxMM={10000} />
                      <AxisDimensionControl label="Z (Depth)" axisDim={params.ribZ} onPhysicalChange={handleRibZPhysicalChange} onFactorChange={handleRibZFactorChange} maxMM={50} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-warm-gray block mb-1">Rotate X°</label>
                        <input type="range" min={-180} max={180} step={15} value={params.ribRotateX} onChange={(e) => handleParamChange('ribRotateX', Number(e.target.value))} className="w-full accent-charcoal" />
                        <span className="text-xs text-charcoal">{params.ribRotateX}°</span>
                      </div>
                      <div>
                        <label className="text-xs text-warm-gray block mb-1">Rotate Y°</label>
                        <input type="range" min={-180} max={180} step={15} value={params.ribRotateY} onChange={(e) => handleParamChange('ribRotateY', Number(e.target.value))} className="w-full accent-charcoal" />
                        <span className="text-xs text-charcoal">{params.ribRotateY}°</span>
                      </div>
                      <div>
                        <label className="text-xs text-warm-gray block mb-1">Rotate Z°</label>
                        <input type="range" min={-180} max={180} step={15} value={params.ribRotateZ} onChange={(e) => handleParamChange('ribRotateZ', Number(e.target.value))} className="w-full accent-charcoal" />
                        <span className="text-xs text-charcoal">{params.ribRotateZ}°</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left */}
              <div className="lg:col-span-3 space-y-4">
                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Shelf Dimensions</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-warm-gray block mb-1">Length (X)</label>
                      <UnitInput label="Length" value={params.length} onChange={(v) => handleParamChange('length', v)} minMM={10} maxMM={10000} />
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray block mb-1">Wave Height (Y)</label>
                      <UnitInput label="Height" value={params.height} onChange={(v) => handleParamChange('height', v)} minMM={10} maxMM={10000} />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Ryb Shape</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {RIB_SHAPES.map((shape) => (
                      <button key={shape.id} onClick={() => { handleParamChange('ribShape', shape.id); if (shape.id === 'freeform') setShowFreeformDrawer(true) }} className={`p-3 text-center text-sm rounded-lg transition-all ${params.ribShape === shape.id ? 'bg-charcoal text-cream' : 'bg-cream text-charcoal hover:bg-stone/10'}`}>
                        <span className="block text-lg mb-1">{shape.icon}</span>
                        {shape.name}
                      </button>
                    ))}
                  </div>
                  {(freeformPoints.length > 0 || customRybSequence) && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={handleResetRyb} className="flex-1 px-3 py-1.5 text-xs bg-cream text-stone rounded-lg hover:bg-stone/10 transition-all">Reset Ryb</button>
                      <button onClick={handleResetAllRybs} className="flex-1 px-3 py-1.5 text-xs bg-terracotta/10 text-terracotta rounded-lg hover:bg-terracotta/20 transition-all">Reset All</button>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-stone/10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={params.flatEdge} onChange={(e) => handleParamChange('flatEdge', e.target.checked)} className="w-5 h-5 rounded border-stone/30 text-charcoal focus:ring-charcoal" />
                      <div>
                        <span className="text-sm font-medium text-charcoal">Flat Back Edge</span>
                        <p className="text-xs text-warm-gray">← Wall side (right in preview)</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Material</h3>
                  <div className="space-y-2">
                    {MATERIALS.map((mat) => (
                      <button key={mat.id} onClick={() => handleParamChange('material', mat.id)} className={`w-full p-2 text-left text-sm rounded-lg transition-all ${params.material === mat.id ? 'bg-charcoal text-cream' : 'bg-cream text-charcoal hover:bg-stone/5'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-current" style={{ backgroundColor: mat.color }} />
                          <span className="flex-1">{mat.name}</span>
                          <span className="text-xs opacity-70">${mat.price}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Developer Parameters */}
                <div className="pt-4">
                  <DeveloperConfig config={siteConfig} onChange={setSiteConfig} />
                </div>
              </div>

              {/* Center - Sticky Preview */}
              <div className="lg:col-span-6">
                <div className="card h-full flex flex-col" style={{ minHeight: '60vh' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-base text-charcoal">Full Ryb Editor</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 bg-cream rounded-lg p-1">
                        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="px-2 py-1 text-xs rounded-md transition-all text-stone hover:text-charcoal" title="Toggle Theme">
                          {theme === 'light' ? '🌙' : '☀️'}
                        </button>
                        {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                          <button key={mode} onClick={() => setShelfViewMode(mode)} className={`px-3 py-1 text-xs rounded-md transition-all ${shelfViewMode === mode ? 'bg-charcoal text-cream' : 'text-stone hover:text-charcoal'}`}>
                            {mode === '3d' ? '3D' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                        {/* Reset Camera Button */}
                        <button onClick={() => { setShelfViewMode('3d'); /* Toggle to force re-position */ setTimeout(() => setShelfViewMode('3d'), 50); }} className="px-2 py-1 text-xs rounded-md transition-all text-stone hover:text-charcoal ml-1" title="Reset Camera">↺</button>
                      </div>
                      <button onClick={() => setExpandedShelfEditor(true)} className="px-2 py-1 text-xs rounded-md text-stone hover:text-charcoal hover:bg-cream transition-all" title="Expand editor">⤢</button>
                    </div>
                  </div>
                  <Canvas shadows camera={{ position: [2000, 2000, 2000], fov: 45, near: 0.1, far: 20000 }} className={`flex-1 rounded-lg overflow-hidden relative ${theme === 'dark' ? 'bg-[#2C2A26]' : 'bg-stone-100'}`} style={{ minHeight: '500px' }}>
                    <Scene 
                      params={params} 
                      viewMode={shelfViewMode} 
                      freeformPoints={activeFreeformPoints} 
                      customRybSequence={customRybSequence} 
                      canvasId="shelf-canvas" 
                      siteConfig={siteConfig} 
                      enableOrbit={true} 
                      showGizmo={true} 
                      highlightIndex={selectedRibIndex} 
                      theme={theme}
                      uploadedMesh={uploadedMesh}
                      uploadedMeshRotation={uploadedMeshRotation}
                      uploadedMeshScale={uploadedMeshScale}
                    />
                  </Canvas>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-charcoal text-cream p-3 text-center rounded-lg">
                      <p className="text-xl font-display">{calculations.sheets}</p>
                      <p className="text-xs text-cream/60">Sheets</p>
                    </div>
                    <div className="bg-charcoal text-cream p-3 text-center rounded-lg">
                      <p className="text-xl font-display">{calculations.efficiency}%</p>
                      <p className="text-xs text-cream/60">Efficiency</p>
                    </div>
                    <div className="bg-charcoal text-cream p-3 text-center rounded-lg">
                      <p className="text-xl font-display">{params.ribCount}</p>
                      <p className="text-xs text-cream/60">Rybs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="lg:col-span-3 space-y-4">
                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Wave Path</h3>

                  {/* Presets moved here */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {PRESETS.map((preset) => (
                      <button key={preset.id} onClick={() => handlePresetClick(preset.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activePreset === preset.id ? 'bg-charcoal text-cream' : 'bg-cream text-stone hover:bg-stone/10'}`}>
                        <span className="mr-1">{preset.icon}</span>
                        {preset.name}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Ryb Count</span><span className="text-charcoal font-medium">{params.ribCount}</span></label>
                      <input type="range" min={3} max={200} value={params.ribCount} onChange={(e) => {
                        const newCount = Number(e.target.value)
                        handleParamChange('ribCount', newCount)
                      }} className="w-full accent-charcoal" />
                    </div>
                    <div>
                      <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Spacing</span><span className="text-charcoal font-medium">{params.ribCount > 1 ? (toMM(params.length) / (params.ribCount - 1)).toFixed(0) : '—'}mm</span></label>
                      <input type="range" min={10} max={200} step={5} value={params.ribCount > 1 ? Math.round(toMM(params.length) / (params.ribCount - 1)) : 100} onChange={(e) => {
                        const spacing = Number(e.target.value)
                        const lengthMM = toMM(params.length)
                        const newCount = Math.max(3, Math.min(30, Math.round(lengthMM / spacing) + 1))
                        handleParamChange('ribCount', newCount)
                      }} className="w-full accent-charcoal" />
                    </div>
                    <div>
                      <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Wave Amplitude</span><span className="text-charcoal font-medium">{params.waveHeight}"</span></label>
                      <input type="range" min={0} max={8} step={0.5} value={params.waveHeight} onChange={(e) => handleParamChange('waveHeight', Number(e.target.value))} className="w-full accent-oak" />
                    </div>
                    <div>
                      <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Frequency</span><span className="text-charcoal font-medium">{params.waveFrequency}</span></label>
                      <input type="range" min={0.5} max={4} step={0.25} value={params.waveFrequency} onChange={(e) => handleParamChange('waveFrequency', Number(e.target.value))} className="w-full accent-oak" />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Size Transform</h3>
                  <p className="text-xs text-warm-gray mb-3">Scale rybs along path</p>
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-xs w-12">Start</span>
                      <input type="number" min={0.1} max={3} step={0.1} value={params.sizeTransforms[0]?.scaleX || 1} onChange={(e) => { const val = Number(e.target.value); const newTransforms = [...params.sizeTransforms]; if (!newTransforms[0]) newTransforms[0] = { position: 0, scaleX: 1, scaleY: 1, rotation: 0 }; if (!newTransforms[1]) newTransforms[1] = { position: 1, scaleX: 1, scaleY: 1, rotation: 0 }; newTransforms[0].scaleX = val; newTransforms[0].scaleY = val; handleParamChange('sizeTransforms', newTransforms) }} className="w-16 px-2 py-1 text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs w-12">End</span>
                      <input type="number" min={0.1} max={3} step={0.1} value={params.sizeTransforms[1]?.scaleX || 1} onChange={(e) => { const val = Number(e.target.value); const newTransforms = [...params.sizeTransforms]; if (!newTransforms[0]) newTransforms[0] = { position: 0, scaleX: 1, scaleY: 1, rotation: 0 }; if (!newTransforms[1]) newTransforms[1] = { position: 1, scaleX: 1, scaleY: 1, rotation: 0 }; newTransforms[1].scaleX = val; newTransforms[1].scaleY = val; handleParamChange('sizeTransforms', newTransforms) }} className="w-16 px-2 py-1 text-sm" />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Backplane</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={params.backplaneEnabled} onChange={(e) => handleParamChange('backplaneEnabled', e.target.checked)} className="w-5 h-5 rounded border-stone/30 text-charcoal focus:ring-charcoal" />
                      <span className="text-sm font-medium text-charcoal">Enable Backplane</span>
                    </label>
                    {params.backplaneEnabled && (
                      <>
                        <div>
                          <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Shape</span></label>
                          <select value={params.backplaneShape} onChange={(e) => handleParamChange('backplaneShape', e.target.value)} className="w-full px-2 py-1.5 text-sm rounded bg-cream border border-stone/20">
                            <option value="rectangular">Rectangular</option>
                            <option value="organic">Organic Wave</option>
                          </select>
                        </div>
                        {params.backplaneShape === 'organic' && (
                          <div>
                            <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Organic Offset</span><span className="text-charcoal font-medium">{params.backplaneOrganicOffset}mm</span></label>
                            <input type="range" min={0} max={100} step={2} value={params.backplaneOrganicOffset} onChange={(e) => handleParamChange('backplaneOrganicOffset', Number(e.target.value))} className="w-full accent-charcoal" />
                          </div>
                        )}
                        {params.backplaneShape === 'organic' && (
                          <div className="pt-4 border-t border-stone/10 mt-2 flex justify-between items-center">
                            <button onClick={() => {
                              if (!params.backplaneBezier) {
                                const lengthMM = toMM(params.length)
                                const h = (params.ribY.physical.value * params.ribY.factor) + (params.backplaneOrganicOffset * 2)
                                const initialRyb = createRybFromWave(lengthMM, h, params.waveHeight, params.waveFrequency)
                                handleParamChange('backplaneBezier', initialRyb)
                              }
                              setShowBackplaneEditor(true)
                            }} className="w-full px-3 py-1.5 text-xs bg-oak/10 text-oak hover:bg-oak/20 rounded-md transition-all font-medium">Edit Backplane Curve</button>
                          </div>
                        )}
                        <div className="pt-2">
                          <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Material Thickness</span><span className="text-charcoal font-medium">{params.backplaneMaterialThickness}mm</span></label>
                          <input type="range" min={3} max={25} step={0.5} value={params.backplaneMaterialThickness} onChange={(e) => handleParamChange('backplaneMaterialThickness', Number(e.target.value))} className="w-full accent-charcoal" />
                        </div>
                        <div>
                          <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Slot Depth</span><span className="text-charcoal font-medium">{params.backplaneSlotDepth}mm</span></label>
                          <input type="range" min={20} max={200} step={5} value={params.backplaneSlotDepth} onChange={(e) => handleParamChange('backplaneSlotDepth', Number(e.target.value))} className="w-full accent-charcoal" />
                        </div>
                        <div>
                          <label className="flex justify-between text-xs text-warm-gray mb-1"><span>Dogbone Radius</span><span className="text-charcoal font-medium">{params.backplaneDogboneRadius}mm</span></label>
                          <input type="range" min={2} max={15} step={0.5} value={params.backplaneDogboneRadius} onChange={(e) => handleParamChange('backplaneDogboneRadius', Number(e.target.value))} className="w-full accent-charcoal" />
                          <p className="text-xs text-warm-gray mt-1">CNC bit clearance fillet</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

        {/* Price */}
        <section className="py-12 bg-charcoal text-cream">
          <div className="max-w-2xl mx-auto px-6">
            <div className="card bg-stone/20 border border-stone/30 p-6">
              <div className="text-center mb-4">
                <p className="font-display text-4xl mb-1">${totalPrice}</p>
                <p className="text-cream/50 text-sm">{params.length.value}{params.length.unit} × {params.height.value}{params.height.unit} • {params.ribCount} {params.ribShape} rybs</p>
              </div>
              {user ? (
                isAdmin ? (
                  <button disabled={isRedirecting} className="w-full py-3 bg-oak text-charcoal font-medium rounded-lg hover:bg-cream transition-colors disabled:opacity-50" onClick={handleStripeCheckout}>
                    {isRedirecting ? 'Redirecting...' : 'Export & Order'}
                  </button>
                ) : (
                  <button disabled className="w-full py-3 bg-stone/20 text-stone font-medium rounded-lg cursor-not-allowed">Admin access required to export</button>
                )
              ) : (
                <SignInButton mode="modal" fallbackRedirectUrl="/">
                  <button className="w-full py-3 bg-charcoal text-cream font-medium border border-cream/20 rounded-lg hover:bg-stone transition-colors">Sign in to Export</button>
                </SignInButton>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50">
          <div className="bg-cream rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="font-display text-2xl text-charcoal mb-6">Export Files</h2>
            <div className="space-y-4">
              <button onClick={() => handleExport('svg')} disabled={isExporting} className="w-full p-4 bg-charcoal text-cream rounded-xl hover:bg-stone flex items-center justify-between">
                <div className="text-left"><p className="font-medium">SVG Cut Files</p><p className="text-xs text-cream/60">Ribs laid flat with numbers</p></div>
                <span className="text-oak">↓</span>
              </button>
              <button onClick={() => handleExport('dxf')} disabled={isExporting} className="w-full p-4 bg-charcoal text-cream rounded-xl hover:bg-stone flex items-center justify-between">
                <div className="text-left"><p className="font-medium">DXF Cut Files</p><p className="text-xs text-cream/60">CAD-ready format</p></div>
                <span className="text-oak">↓</span>
              </button>
            </div>
            <button onClick={() => setShowExport(false)} className="w-full mt-4 py-3 text-stone hover:text-charcoal">Close</button>
          </div>
        </div>
      )}

      {/* Freeform Drawer */}
      {showFreeformDrawer && <CustomRybEditor onSave={(points, sequence) => { setFreeformPoints(points); setCustomRybSequence(sequence); setShowFreeformDrawer(false) }} onClose={() => setShowFreeformDrawer(false)} />}
      {showBackplaneEditor && (
        <CustomRybEditor 
          onSave={(points, sequence) => { 
            // For the backplane, we only care about the first ryb in the sequence for now
            // Or we treat the entire sequence as a series of keyframes?
            // User requested "draw beziers" so we'll use the selected ryb's shape.
            const selectedRyb = sequence.rybs[sequence.selectedIndex]
            handleParamChange('backplaneBezier', selectedRyb)
            setShowBackplaneEditor(false) 
          }} 
          onClose={() => setShowBackplaneEditor(false)} 
          initialSequence={params.backplaneBezier ? { rybs: [params.backplaneBezier], selectedIndex: 0, spacingType: 'even', interpolation: 'linear' } : undefined}
        />
      )}

      {/* Expanded Single Ryb Editor Modal */}
      {expandedRibEditor && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-ivory rounded-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-stone/10">
              <h3 className="font-display text-lg text-charcoal">Single Ryb Editor — Expanded</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-cream rounded-lg p-1">
                  {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                    <button key={mode} onClick={() => setRibViewMode(mode)} className={`px-3 py-1 text-xs rounded-md transition-all ${ribViewMode === mode ? 'bg-charcoal text-cream' : 'text-stone hover:text-charcoal'}`}>
                      {mode === '3d' ? '3D' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                  <button onClick={() => setRibViewMode('3d')} className="px-2 py-1 text-xs rounded-md transition-all text-stone hover:text-charcoal ml-1">↺</button>
                </div>
                <button onClick={() => setExpandedRibEditor(false)} className="px-3 py-1 text-sm rounded-md bg-charcoal text-cream hover:bg-stone transition-all">✖ Close</button>
              </div>
            </div>
            <Canvas camera={{ position: [200, 150, 250], fov: 40, near: 1, far: 10000 }} className="flex-1 bg-gradient-to-b from-stone/5 to-stone/10">
              <Scene params={params} viewMode={ribViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} isSingleRib={true} canvasId="rib-expanded" siteConfig={siteConfig} showGizmo={true} enableOrbit={true} />
            </Canvas>
          </div>
        </div>
      )}

      {/* Expanded Full Ryb Editor Modal */}
      {expandedShelfEditor && (
        <div className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-ivory rounded-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-stone/10">
              <h3 className="font-display text-lg text-charcoal">Full Ryb Editor — Expanded</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-cream rounded-lg p-1">
                  {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                    <button key={mode} onClick={() => setShelfViewMode(mode)} className={`px-3 py-1 text-xs rounded-md transition-all ${shelfViewMode === mode ? 'bg-charcoal text-cream' : 'text-stone hover:text-charcoal'}`}>
                      {mode === '3d' ? '3D' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                  <button onClick={() => setShelfViewMode('3d')} className="px-2 py-1 text-xs rounded-md transition-all text-stone hover:text-charcoal ml-1">↺</button>
                </div>
                <button onClick={() => setExpandedShelfEditor(false)} className="px-3 py-1 text-sm rounded-md bg-charcoal text-cream hover:bg-stone transition-all">✖ Close</button>
              </div>
            </div>
            <Canvas camera={{ position: [800, 600, 1200], fov: 45, near: 1, far: 10000 }} className="flex-1 bg-gradient-to-b from-stone/5 to-stone/10">
              <Scene params={params} viewMode={shelfViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} canvasId="shelf-expanded" siteConfig={siteConfig} showGizmo={true} enableOrbit={true} highlightIndex={selectedRibIndex} />
            </Canvas>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-charcoal text-cream py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-charcoal text-cream flex items-center justify-center font-display text-lg">R</div>
            <span className="font-display text-xl">Rybform</span>
          </div>
          <p className="text-cream/50 text-sm">Parametric rib-based furniture</p>
        </div>
      </footer>
    </div>
  )
}

export default App
