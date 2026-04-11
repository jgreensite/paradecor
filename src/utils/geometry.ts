import * as THREE from 'three'
import type { 
  Unit, RibShape, 
  DimensionUnit, AxisDimension, RibSizeTransform,
  ShelfParams, FreeformRibPoint,
  CurveSegment, CustomRyb, CustomRybSequence, BezierControlPoint
} from '../core/domain/types'

export const MM_PER_INCH = 25.4

export function toMM(dim: DimensionUnit): number {
  return dim.unit === 'mm' ? dim.value : dim.value * MM_PER_INCH
}

export function toPhysical(mmValue: number, unit: Unit): number {
  return unit === 'mm' ? mmValue : mmValue / MM_PER_INCH
}

export function createAxisDimension(physicalValue: number, unit: Unit): AxisDimension {
  return {
    physical: { value: physicalValue, unit },
    factor: 1
  }
}

export function updateAxisDimensionFromPhysical(dim: AxisDimension, newPhysical: DimensionUnit): AxisDimension {
  const newMM = toMM(newPhysical)
  const baseMM = dim.factor === 1 ? toMM({ value: 1, unit: newPhysical.unit }) : toMM(dim.physical) / dim.factor
  const newFactor = baseMM > 0 ? newMM / baseMM : 1
  return {
    physical: newPhysical,
    factor: Math.max(0.1, Math.min(10, newFactor))
  }
}

export function updateAxisDimensionFromFactor(dim: AxisDimension, newFactor: number): AxisDimension {
  const clampedFactor = Math.max(0.1, Math.min(10, newFactor))
  const newMM = (toMM(dim.physical) / dim.factor) * clampedFactor
  return {
    physical: { ...dim.physical, value: toPhysical(newMM, dim.physical.unit) },
    factor: clampedFactor
  }
}

export function generateWavePath(lengthMM: number, heightMM: number, waveHeight: number, waveFrequency: number, ribCount: number): { x: number, y: number }[] {
  const points: { x: number, y: number }[] = []

  for (let i = 0; i <= ribCount; i++) {
    const t = i / ribCount
    const xPos = t * lengthMM - lengthMM / 2
    const waveY = Math.sin(t * Math.PI * 2 * waveFrequency) * waveHeight * 25
    points.push({ x: xPos, y: waveY })
  }

  return points
}

export function interpolateTransform(transforms: RibSizeTransform[], position: number): { scaleX: number, scaleY: number, rotation: number } {
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

export function generateRibGeometry(
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
    const scaledPoints = freeformPoints.map(p => ({
      x: (p.x / 500 - 0.5) * widthMM,
      y: (0.5 - p.y / 300) * heightMM,
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

export function calculateRibBoundingBox(params: ShelfParams, freeformPoints?: FreeformRibPoint[]): { width: number, height: number, depth: number } {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  if (params.ribShape === 'freeform' && freeformPoints && freeformPoints.length > 2) {
    const minX = Math.min(...freeformPoints.map(p => p.x))
    const maxX = Math.max(...freeformPoints.map(p => p.x))
    const minY = Math.min(...freeformPoints.map(p => p.y))
    const maxY = Math.max(...freeformPoints.map(p => p.y))
    return {
      width: ((maxX - minX) / 500) * widthMM,
      height: ((maxY - minY) / 300) * heightMM,
      depth: depthMM
    }
  }

  return { width: widthMM, height: heightMM, depth: depthMM }
}

export function calculateShelfBoundingBox(params: ShelfParams): { width: number, height: number, depth: number, center: THREE.Vector3 } {
  const lengthMM = toMM(params.length)
  const waveHeightMM = toMM(params.height)
  const ribDepthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  const waveAmplitude = params.waveHeight * 25 // Match generateWavePath
  const totalHeight = waveHeightMM + waveAmplitude * 2

  return {
    width: lengthMM,
    height: totalHeight,
    depth: ribDepthMM,
    center: new THREE.Vector3(0, 0, 0)
  }
}

export function calculateSheetsNeeded(params: ShelfParams): { sheets: number, efficiency: number } {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const totalArea = widthMM * heightMM * params.ribCount
  const sheetArea = 48 * 96 * MM_PER_INCH * MM_PER_INCH

  const sheets = Math.max(1, Math.ceil(totalArea / sheetArea))
  const efficiency = Math.min(95, Math.round((totalArea / (sheets * sheetArea)) * 100))

  return { sheets, efficiency }
}


export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

export function createDefaultRyb(index: number): CustomRyb {
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

export function getCurvePoints(segment: CurveSegment, resolution: number = 20): BezierControlPoint[] {
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

export function getAllPointsFromRyb(ryb: CustomRyb): BezierControlPoint[] {
  const allPoints: BezierControlPoint[] = []
  ryb.segments.forEach(seg => {
    allPoints.push(...getCurvePoints(seg))
  })
  return allPoints
}

export function createRybFromWave(lengthMM: number, h: number, waveHeight: number, waveFrequency: number, ribCount: number): CustomRyb {
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
  // Bottom edge
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

export function getCustomRybHeightAtX(ryb: CustomRyb, x: number, lengthMM: number, defaultH: number): number {
  const pts = getAllPointsFromRyb(ryb)
  if (pts.length < 2) return defaultH
  
  const normalizedX = ((x + lengthMM / 2) / (lengthMM || 1)) * 500
  
  const atX = pts.filter(p => Math.abs(p.x - normalizedX) < 5)
  if (atX.length >= 2) {
    const minY = Math.min(...atX.map(p => p.y))
    const maxY = Math.max(...atX.map(p => p.y))
    return ((maxY - minY) / 300) * defaultH
  }

  const sorted = [...pts].sort((a, b) => a.x - b.x)
  const left = sorted.filter(p => p.x <= normalizedX).pop()
  const right = sorted.find(p => p.x >= normalizedX)
  
  if (left && right) {
    const t = (normalizedX - left.x) / (right.x - left.x || 1)
    const yVal = left.y + t * (right.y - left.y)
    return (yVal / 300) * defaultH
  }
  
  return defaultH
}

export function generateAllRibParams(params: ShelfParams, wavePath: { x: number, y: number }[], freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null) {
  const baseX = toMM(params.ribX.physical) * params.ribX.factor
  const baseY = toMM(params.ribY.physical) * params.ribY.factor

  const activeTransforms = params.sizeTransforms.length > 0
    ? params.sizeTransforms
    : [{ position: 0, scaleX: 1, scaleY: 1, rotation: 0 }, { position: 1, scaleX: 1, scaleY: 1, rotation: 0 }]

  const profiles: { width: number; height: number; shape: RibShape; freeformPts?: FreeformRibPoint[], rotateX: number, rotateY: number, rotateZ: number }[] = []

  const keyframePoints = customRybSequence?.rybs.map(ryb => getAllPointsFromRyb(ryb)) || []

  for (let i = 0; i < wavePath.length; i++) {
    const t = i / (wavePath.length - 1 || 1)
    const transform = interpolateTransform(activeTransforms, t)

    let scaledWidth = baseX * transform.scaleX
    let scaledHeight = baseY * transform.scaleY

    if (params.backplaneEnabled && params.backplaneBezier) {
      const lengthMM = toMM(params.length)
      const bpH = getCustomRybHeightAtX(params.backplaneBezier, wavePath[i].x, lengthMM, scaledHeight)
      scaledHeight = bpH + (params.backplaneOrganicOffset * 0.5)
    }

    let ribFreeformPoints = freeformPoints

    if (params.ribShape === 'freeform' && keyframePoints.length > 0) {
      const rybCount = keyframePoints.length
      
      if (rybCount === 1) {
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

export function generateAllRibs(params: ShelfParams, freeformPoints?: FreeformRibPoint[], customRybSequence?: CustomRybSequence | null): { positions: { x: number, y: number, z: number }[], rotations: [number, number, number][], profiles: any[] } {
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
