import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'

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
  rodDiameter: DimensionUnit
  rodCount: number
  material: string
  finish: string
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
const SITE_CONFIG = {
  previewCycleIntervalMs: 10000,
  previewFadeDurationMs: 800,
  cameraSweepSpeed: 0.15,
  cameraSweepAmplitude: 0.3,
  meshCurveSegments: 32,
  meshExtrudeSteps: 1,
  orthoZoomPadding: 1.4,
  perspectiveZoomMultiplier: 2.0,
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
  rotX: number,
  rotY: number,
  rotZ: number,
  flatEdge: boolean,
  freeformPoints?: FreeformRibPoint[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []
  const normals: number[] = []

  const thickness = flatEdge ? 0 : depthMM / 2

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

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const euler = new THREE.Euler(THREE.MathUtils.degToRad(rotX), THREE.MathUtils.degToRad(rotY), THREE.MathUtils.degToRad(rotZ))
  geometry.rotateX(euler.x)
  geometry.rotateY(euler.y)
  geometry.rotateZ(euler.z)

  return geometry
}

function generateAllRibs(params: ShelfParams, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null): { geometries: THREE.BufferGeometry[], positions: { x: number, y: number, z: number }[], rotations: number[] } {
  const lengthMM = toMM(params.length)
  const waveHeightMM = toMM(params.height)
  const depthMM = toMM(params.ribDepth)

  const baseX = toMM(params.ribX.physical) * params.ribX.factor
  const baseY = toMM(params.ribY.physical) * params.ribY.factor
  const baseZ = toMM(params.ribZ.physical) * params.ribZ.factor

  const wavePath = generateWavePath(lengthMM, waveHeightMM, params.waveHeight, params.waveFrequency, params.ribCount)

  const geometries: THREE.BufferGeometry[] = []
  const positions: { x: number, y: number, z: number }[] = []
  const rotations: number[] = []

  const activeTransforms = params.sizeTransforms.length > 0
    ? params.sizeTransforms
    : [{ position: 0, scaleX: 1, scaleY: 1, rotation: 0 }, { position: 1, scaleX: 1, scaleY: 1, rotation: 0 }]

  for (let i = 0; i < wavePath.length; i++) {
    const point = wavePath[i]
    const t = i / (wavePath.length - 1 || 1)
    const transform = interpolateTransform(activeTransforms, t)

    const scaledWidth = baseX * transform.scaleX
    const scaledHeight = baseY * transform.scaleY
    const scaledDepth = baseZ

    // Multi-ryb: interpolate freeform points from the sequence
    let ribFreeformPoints = freeformPoints
    if (customRybSequence && customRybSequence.rybs.length > 1 && params.ribShape === 'freeform') {
      const rybCount = customRybSequence.rybs.length
      // Map rib position (t) to ryb index, interpolating between adjacent rybs
      const rybT = t * (rybCount - 1)
      const rybIdx0 = Math.min(Math.floor(rybT), rybCount - 1)
      const rybIdx1 = Math.min(rybIdx0 + 1, rybCount - 1)
      const localT = rybT - rybIdx0

      const points0 = getAllPointsFromRyb(customRybSequence.rybs[rybIdx0])
      const points1 = getAllPointsFromRyb(customRybSequence.rybs[rybIdx1])

      // Interpolate between the two sets of points
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

    const geometry = generateRibGeometry(
      params.ribShape, scaledWidth, scaledHeight, scaledDepth,
      params.ribRotateX + transform.rotation, params.ribRotateY, params.ribRotateZ,
      params.flatEdge, ribFreeformPoints
    )
    geometries.push(geometry)
    positions.push({ x: point.x, y: point.y, z: 0 })
    rotations.push(0)
  }

  return { geometries, positions, rotations }
}

function Rods({ positions, rodDiameterMM, depthMM, rodCount = 1, flatEdge = true }: { positions: { x: number, y: number, z: number }[], rodDiameterMM: number, depthMM: number, rodCount?: number, flatEdge?: boolean }) {
  const rodLength = 80

  return (
    <group>
      {positions.map((pos, ribIndex) => (
        <group key={ribIndex}>
          {Array.from({ length: rodCount }).map((_, rodIndex) => {
            const spacing = rodCount > 1 ? depthMM / (rodCount + 1) : 0
            const zOffset = rodCount > 1 ? spacing * (rodIndex + 1) : depthMM * 0.1
            const wallOffset = flatEdge ? depthMM * 0.1 : 0
            const zPos = -wallOffset - (rodCount > 1 ? zOffset : depthMM * 0.1)
            return (
              <group key={rodIndex} position={[pos.x, pos.y, zPos]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[rodDiameterMM / 2, rodDiameterMM / 2, rodLength, 12]} />
                  <meshStandardMaterial color="#4A4744" metalness={0.8} roughness={0.2} />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}
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

function ZoomToFit({ boundingBox, viewMode, target }: { boundingBox: { width: number, height: number, depth: number, center?: THREE.Vector3 }, viewMode: ViewMode, target?: THREE.Vector3 }) {
  const { camera, size: canvasSize } = useThree()

  useEffect(() => {
    const center = target || boundingBox.center || new THREE.Vector3(0, 0, 0)
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) || 50
    const padding = SITE_CONFIG.orthoZoomPadding

    if (viewMode === '3d') {
      const distance = maxDim * SITE_CONFIG.perspectiveZoomMultiplier
      camera.position.set(center.x + distance * 0.5, center.y + distance * 0.4, center.z + distance * 0.8)
      camera.lookAt(center)
    } else {
      // Orthographic: compute zoom from bounding box and canvas size
      const aspect = canvasSize.width / canvasSize.height
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

      // Fit the larger dimension with padding
      const zoomX = canvasSize.width / ((visibleWidth || 50) * padding)
      const zoomY = canvasSize.height / ((visibleHeight || 50) * padding)
      const orthoZoom = Math.min(zoomX, zoomY)

      const dist = maxDim * 2
      if (viewMode === 'top') {
        camera.position.set(center.x, center.y + dist, center.z)
      } else if (viewMode === 'front') {
        camera.position.set(center.x, center.y, center.z + dist)
      } else {
        camera.position.set(center.x + dist, center.y, center.z)
      }
      camera.lookAt(center)
      if ('zoom' in camera) {
        ; (camera as THREE.OrthographicCamera).zoom = orthoZoom
        camera.updateProjectionMatrix()
      }
    }
  }, [camera, boundingBox, viewMode, target, canvasSize])

  return null
}

// Gentle auto-rotating camera sweep for preview canvases
function CameraSweep({ enabled = true }: { enabled?: boolean }) {
  const { camera } = useThree()
  const initialPos = useRef<THREE.Vector3 | null>(null)

  useFrame((_, delta) => {
    if (!enabled) return
    if (!initialPos.current) initialPos.current = camera.position.clone()
    const time = Date.now() * 0.001 * SITE_CONFIG.cameraSweepSpeed
    const amp = SITE_CONFIG.cameraSweepAmplitude
    camera.position.x = initialPos.current.x + Math.sin(time) * amp * initialPos.current.length() * 0.1
    camera.position.y = initialPos.current.y + Math.cos(time * 0.7) * amp * initialPos.current.length() * 0.05
    camera.lookAt(0, 0, 0)
  })

  return null
}

function SingleRibPreview({ params, freeformPoints }: { params: ShelfParams, freeformPoints?: FreeformRibPoint[] }) {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  const geometry = useMemo(() =>
    generateRibGeometry(params.ribShape, widthMM, heightMM, depthMM, params.ribRotateX, params.ribRotateY, params.ribRotateZ, params.flatEdge, freeformPoints),
    [params.ribShape, widthMM, heightMM, depthMM, params.ribRotateX, params.ribRotateY, params.ribRotateZ, params.flatEdge, freeformPoints]
  )

  const material = useMemo(() => {
    const mat = MATERIALS.find(m => m.id === params.material) || MATERIALS[0]
    return new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, metalness: 0.05, side: THREE.DoubleSide })
  }, [params.material])

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}

function ShelfMesh({ params, freeformPoints, customRybSequence }: { params: ShelfParams, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null }) {
  const groupRef = useRef<THREE.Group>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const selectedMaterial = MATERIALS.find(m => m.id === params.material) || MATERIALS[0]

  const memoKey = useMemo(() =>
    `${params.length.value}-${params.length.unit}-${params.height.value}-${params.height.unit}-${params.ribDepth.value}-${params.ribCount}-${params.waveHeight}-${params.waveFrequency}-${params.ribShape}-${params.ribX.physical.value}-${params.ribX.factor}-${params.ribY.physical.value}-${params.ribY.factor}-${params.ribZ.physical.value}-${params.ribZ.factor}-${params.ribRotateX}-${params.ribRotateY}-${params.ribRotateZ}-${params.flatEdge}-${params.sizeTransforms.map(t => `${t.scaleX}-${t.scaleY}`).join(',')}`,
    [params.length.value, params.length.unit, params.height.value, params.height.unit, params.ribDepth.value, params.ribCount, params.waveHeight, params.waveFrequency, params.ribShape, params.ribX.physical.value, params.ribX.factor, params.ribY.physical.value, params.ribY.factor, params.ribZ.physical.value, params.ribZ.factor, params.ribRotateX, params.ribRotateY, params.ribRotateZ, params.flatEdge, params.sizeTransforms]
  )

  const { geometries, positions, rotations } = useMemo(() => generateAllRibs(params, freeformPoints, customRybSequence), [memoKey, freeformPoints, customRybSequence])

  useEffect(() => {
    return () => {
      geometries.forEach(geometry => geometry.dispose())
      if (materialRef.current) materialRef.current.dispose()
    }
  }, [geometries])

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: selectedMaterial.color, roughness: selectedMaterial.roughness, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    materialRef.current = mat
    return mat
  }, [selectedMaterial])

  const rodDiameterMM = toMM(params.rodDiameter)
  const depthMM = toMM(params.ribDepth)

  return (
    <group ref={groupRef}>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={material} position={[positions[index].x, positions[index].y, positions[index].z]} castShadow receiveShadow />
      ))}
      {params.rodCount > 0 && positions.length > 0 && <Rods positions={positions} rodDiameterMM={rodDiameterMM} depthMM={depthMM} rodCount={params.rodCount} flatEdge={params.flatEdge} />}
    </group>
  )
}

function Scene({ params, viewMode, freeformPoints, customRybSequence, isSingleRib = false, canvasId, autoSweep = false, enableOrbit = true }: { params: ShelfParams, viewMode: ViewMode, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null, isSingleRib?: boolean, canvasId?: string, autoSweep?: boolean, enableOrbit?: boolean }) {
  const lengthMM = toMM(params.length)
  const heightMM = toMM(params.height)
  const cameraDistance = Math.max(lengthMM, heightMM) * 1.5

  const boundingBox = useMemo(() =>
    isSingleRib
      ? { ...calculateRibBoundingBox(params, freeformPoints), center: new THREE.Vector3(0, 0, 0) }
      : calculateShelfBoundingBox(params),
    [params, freeformPoints, isSingleRib]
  )

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 20]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <pointLight position={[0, 0, 30]} intensity={0.5} />

      <Float speed={isSingleRib ? 2 : 1} rotationIntensity={viewMode === '3d' && !isSingleRib ? 0.1 : 0} floatIntensity={0.3}>
        {isSingleRib ? <SingleRibPreview params={params} freeformPoints={freeformPoints} /> : <ShelfMesh params={params} freeformPoints={freeformPoints} customRybSequence={customRybSequence} />}
      </Float>

      <ZoomToFit boundingBox={boundingBox} viewMode={viewMode} target={new THREE.Vector3(0, 0, 0)} />
      {autoSweep && viewMode === '3d' && <CameraSweep />}

      <ContactShadows position={[0, -heightMM / 2 - 15, 0]} opacity={0.4} scale={Math.max(lengthMM, 100)} blur={2} far={50} />

      {enableOrbit && viewMode === '3d' && <OrbitControls enablePan enableDamping dampingFactor={0.05} minDistance={20} maxDistance={500} makeDefault />}
      {viewMode === 'top' && <OrthographicCamera makeDefault position={[0, 100, 0]} zoom={10} near={1} far={500} onUpdate={c => c.lookAt(0, 0, 0)} />}
      {viewMode === 'front' && <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={10} near={1} far={500} onUpdate={c => c.lookAt(0, 0, 0)} />}
      {viewMode === 'side' && <OrthographicCamera makeDefault position={[100, 0, 0]} zoom={10} near={1} far={500} onUpdate={c => c.lookAt(0, 0, 0)} />}
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

function UnitInput({ label, value, onChange, min = 0.1, max = 1000, step = 0.1 }: { label: string, value: DimensionUnit, onChange: (dim: DimensionUnit) => void, min?: number, max?: number, step?: number }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={min} max={max} step={step} value={value.value} onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} className="w-20 px-2 py-1 text-sm bg-cream border border-stone/20 rounded-md focus:outline-none focus:border-oak" />
      <select value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as Unit })} className="px-2 py-1 text-sm bg-cream border border-stone/20 rounded-md focus:outline-none focus:border-oak">
        <option value="in">in</option>
        <option value="mm">mm</option>
      </select>
    </div>
  )
}

function AxisDimensionControl({ label, axisDim, onPhysicalChange, onFactorChange }: { label: string, axisDim: AxisDimension, onPhysicalChange: (dim: DimensionUnit) => void, onFactorChange: (factor: number) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-charcoal">{label} (Physical)</label>
      <UnitInput label={label} value={axisDim.physical} onChange={onPhysicalChange} min={0.1} max={24} step={0.125} />
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

function getAllPointsFromRyb(ryb: CustomRyb): BezierControlPoint[] {
  const allPoints: BezierControlPoint[] = []
  ryb.segments.forEach(seg => {
    allPoints.push(...getCurvePoints(seg))
  })
  return allPoints
}

interface CustomRybEditorProps {
  onSave: (points: FreeformRibPoint[], sequence: CustomRybSequence) => void
  onClose: () => void
}

function CustomRybEditor({ onSave, onClose }: CustomRybEditorProps) {
  const [sequence, setSequence] = useState<CustomRybSequence>({
    rybs: [createDefaultRyb(0)],
    spacingType: 'even',
    interpolation: 'linear',
    selectedIndex: 0
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPoint, setSelectedPoint] = useState<{ rybIndex: number, segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{ segmentIndex: number, pointType: 'start' | 'end' | 'control1' | 'control2' } | null>(null)
  const [dragging, setDragging] = useState(false)

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

    setSelectedPoint(closest)
    if (closest) setDragging(true)
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
    const newRyb = createDefaultRyb(sequence.rybs.length)
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
  }, [sequence, selectedPoint, hoveredPoint])

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
          <button onClick={onClose} className="text-stone hover:text-charcoal">✕</button>
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
          className="w-full border border-stone/20 rounded-lg bg-white cursor-crosshair"
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
                while (newRybs.length < count) newRybs.push(createDefaultRyb(newRybs.length))
                while (newRybs.length > count) newRybs.pop()
                setSequence(prev => ({ ...prev, rybs: newRybs }))
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

function App() {
  const [params, setParams] = useState<ShelfParams>({
    length: { value: 48, unit: 'in' },
    height: { value: 24, unit: 'in' },
    ribDepth: { value: 8, unit: 'in' },
    materialThickness: { value: 0.75, unit: 'in' },
    ribCount: 10,
    waveHeight: 2,
    waveFrequency: 1.5,
    ribShape: 'square',
    ribSize: { value: 3, unit: 'in' },
    ribX: createAxisDimension(3, 'in'),
    ribY: createAxisDimension(3, 'in'),
    ribZ: createAxisDimension(1, 'in'),
    ribRotateX: 180,
    ribRotateY: -90,
    ribRotateZ: 0,
    sizeTransforms: [],
    flatEdge: true,
    rodDiameter: { value: 0.25, unit: 'in' },
    rodCount: 2,
    material: 'birch-plywood',
    finish: 'raw',
  })

  const [activeSection, setActiveSection] = useState('design')
  const [activePreset, setActivePreset] = useState('gentle')
  const [ribViewMode, setRibViewMode] = useState<ViewMode>('3d')
  const [shelfViewMode, setShelfViewMode] = useState<ViewMode>('3d')
  const [showExport, setShowExport] = useState(false)
  const [showFreeformDrawer, setShowFreeformDrawer] = useState(false)
  const [freeformPoints, setFreeformPoints] = useState<FreeformRibPoint[]>([])
  const [customRybSequence, setCustomRybSequence] = useState<CustomRybSequence | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [cyclingRybIndex, setCyclingRybIndex] = useState(0)
  const [cyclingFadeIn, setCyclingFadeIn] = useState(true)
  const [expandedRibEditor, setExpandedRibEditor] = useState(false)
  const [expandedShelfEditor, setExpandedShelfEditor] = useState(false)

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
      }, SITE_CONFIG.previewFadeDurationMs)
    }, SITE_CONFIG.previewCycleIntervalMs)
    return () => clearInterval(interval)
  }, [params.ribCount])

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

  const handleExport = (format: 'svg' | 'dxf') => {
    setIsExporting(true)
    setTimeout(() => { setIsExporting(false); setShowExport(false) }, 500)
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
            <button onClick={() => setShowExport(true)} className="text-sm tracking-wide text-oak hover:text-charcoal transition-colors">Export</button>
            <button className="btn-primary text-sm py-3 px-6">Get Started</button>
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
              <p className="text-stone mb-8">Design parametric shelves with primitive shapes. Rotate in 3D, scale along path.</p>
              <button onClick={() => document.getElementById('designer')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary">Start Designing</button>
            </div>
            <div className="relative h-[350px]">
              <div className="absolute inset-0">
                <Canvas shadows camera={{ position: [10, 8, 15], fov: 45 }}>
                  <Scene params={params} viewMode={'3d'} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} canvasId="hero-canvas" autoSweep enableOrbit={false} />
                </Canvas>
              </div>
              {/* Top Right Mini Preview - Cycling Single Ryb */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cream/90 backdrop-blur-sm rounded-lg overflow-hidden border-2 border-charcoal/10 shadow-lg">
                <div style={{ opacity: cyclingFadeIn ? 1 : 0, transition: `opacity ${SITE_CONFIG.previewFadeDurationMs}ms ease-in-out` }} className="w-full h-full">
                  <Canvas shadows camera={{ position: [15, 12, 20], fov: 40 }}>
                    <Scene params={params} viewMode={'3d'} freeformPoints={activeFreeformPoints} isSingleRib={true} canvasId="mini-canvas" autoSweep enableOrbit={false} />
                  </Canvas>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Designer */}
        <section id="designer" className="py-16 bg-ivory">
          <div className="max-w-7xl mx-auto px-6">
            {/* Single Rib Preview */}
            <div className="mb-8">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base text-charcoal">Single Ryb Editor</h3>
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
                <div className="flex gap-6 items-start">
                  <div className="w-64 h-64 bg-stone/5 rounded-lg overflow-hidden border border-stone/10">
                    <Canvas shadows camera={{ position: [15, 12, 20], fov: 40 }}>
                      <Scene params={params} viewMode={ribViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} isSingleRib={true} canvasId="rib-canvas" />
                    </Canvas>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <AxisDimensionControl label="X (Width)" axisDim={params.ribX} onPhysicalChange={handleRibXPhysicalChange} onFactorChange={handleRibXFactorChange} />
                    <AxisDimensionControl label="Y (Height)" axisDim={params.ribY} onPhysicalChange={handleRibYPhysicalChange} onFactorChange={handleRibYFactorChange} />
                    <AxisDimensionControl label="Z (Depth)" axisDim={params.ribZ} onPhysicalChange={handleRibZPhysicalChange} onFactorChange={handleRibZFactorChange} />
                  </div>
                  <div className="space-y-3 w-32">
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

            <div className="grid lg:grid-cols-12 gap-6">
              {/* Left */}
              <div className="lg:col-span-3 space-y-4">
                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Shelf Dimensions</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-warm-gray block mb-1">Length (X)</label>
                      <UnitInput label="Length" value={params.length} onChange={(v) => handleParamChange('length', v)} min={6} max={96} />
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray block mb-1">Wave Height (Y)</label>
                      <UnitInput label="Height" value={params.height} onChange={(v) => handleParamChange('height', v)} min={6} max={72} />
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
              </div>

              {/* Center - Sticky Preview */}
              <div className="lg:col-span-6">
                <div className="sticky top-24">
                  <div className="card h-full min-h-[450px] flex flex-col" style={{ minHeight: '50vh' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-base text-charcoal">Full Ryb Editor</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 bg-cream rounded-lg p-1">
                          {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                            <button key={mode} onClick={() => setShelfViewMode(mode)} className={`px-3 py-1 text-xs rounded-md transition-all ${shelfViewMode === mode ? 'bg-charcoal text-cream' : 'text-stone hover:text-charcoal'}`}>
                              {mode === '3d' ? '3D' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                          ))}
                          <button onClick={() => setShelfViewMode('3d')} className="px-2 py-1 text-xs rounded-md transition-all text-stone hover:text-charcoal ml-1">↺</button>
                        </div>
                        <button onClick={() => setExpandedShelfEditor(true)} className="px-2 py-1 text-xs rounded-md text-stone hover:text-charcoal hover:bg-cream transition-all" title="Expand editor">⤢</button>
                      </div>
                    </div>
                    <div className="flex-1 bg-gradient-to-b from-stone/5 to-stone/10 rounded-lg overflow-hidden relative" style={{ minHeight: '350px' }}>
                      <Canvas shadows camera={{ position: [10, 8, 15], fov: 45 }}>
                        <Scene params={params} viewMode={shelfViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} canvasId="shelf-canvas" />
                      </Canvas>
                    </div>
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
                      <input type="range" min={3} max={30} value={params.ribCount} onChange={(e) => {
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
                  <h3 className="font-display text-base text-charcoal mb-4">Wall Mount</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-warm-gray block mb-1">Rod Diameter</label>
                      <UnitInput label="Rod" value={params.rodDiameter} onChange={(v) => handleParamChange('rodDiameter', v)} min={0.125} max={1} />
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray block mb-1">Rods per Ryb</label>
                      <input type="range" min={1} max={4} value={params.rodCount} onChange={(e) => handleParamChange('rodCount', Number(e.target.value))} className="w-full accent-terracotta" />
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
              <button className="w-full py-3 bg-oak text-charcoal font-medium rounded-lg hover:bg-cream transition-colors" onClick={() => setShowExport(true)}>Export & Order</button>
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
            <div className="flex-1 bg-gradient-to-b from-stone/5 to-stone/10">
              <Canvas shadows camera={{ position: [15, 12, 20], fov: 40 }}>
                <Scene params={params} viewMode={ribViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} isSingleRib={true} canvasId="rib-expanded" />
              </Canvas>
            </div>
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
            <div className="flex-1 bg-gradient-to-b from-stone/5 to-stone/10">
              <Canvas shadows camera={{ position: [10, 8, 15], fov: 45 }}>
                <Scene params={params} viewMode={shelfViewMode} freeformPoints={activeFreeformPoints} customRybSequence={customRybSequence} canvasId="shelf-expanded" />
              </Canvas>
            </div>
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
