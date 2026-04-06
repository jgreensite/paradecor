import React, { useMemo, useRef, useEffect, Suspense } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { 
  OrbitControls, PerspectiveCamera, Environment, Float, 
  ContactShadows, Text, Center, Grid as ThreeGrid, GizmoHelper, GizmoViewport
} from '@react-three/drei'
import type { 
  ShelfParams, FreeformRibPoint, CustomRybSequence, ViewMode 
} from '../core/domain/types'
import { FINISHES, MATERIALS, INITIAL_SITE_CONFIG } from '../constants'
import { 
  toMM, calculateRibBoundingBox, calculateShelfBoundingBox, 
  generateRibGeometry, generateAllRibs, getAllPointsFromRyb
} from '../utils/geometry'

// --- Scene Components ---

export function ZoomToFit({ boundingBox, viewMode, target, siteConfig, isSingleRib = false, isPreview = false }: { 
  boundingBox: { width: number, height: number, depth: number, center?: THREE.Vector3 }, 
  viewMode: ViewMode, 
  target?: THREE.Vector3, 
  siteConfig: typeof INITIAL_SITE_CONFIG, 
  isSingleRib?: boolean, 
  isPreview?: boolean 
}) {
  const { camera, size: canvasSize } = useThree()

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
    
    if (camera.position.length() < 10 || Math.abs(camera.position.z - (center.z + distance)) > 5000) {
       camera.position.set(center.x + distance * 0.4, center.y + distance * 0.6, center.z + distance)
       camera.lookAt(center)
    }
  })

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

export function CameraSweep({ enabled = true, siteConfig }: { enabled?: boolean, siteConfig: typeof INITIAL_SITE_CONFIG }) {
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

export function SingleRibPreview({ params, freeformPoints, customRybSequence }: { 
  params: ShelfParams, 
  freeformPoints?: FreeformRibPoint[], 
  customRybSequence?: CustomRybSequence | null 
}) {
  const widthMM = toMM(params.ribX.physical) * params.ribX.factor
  const heightMM = toMM(params.ribY.physical) * params.ribY.factor
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

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
    const mat = MATERIALS.find(m => m.id === params.material) || (MATERIALS[0] as any)
    return new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, metalness: 0.05, side: THREE.DoubleSide })
  }, [params.material])

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(params.ribRotateX),
    THREE.MathUtils.degToRad(params.ribRotateY),
    THREE.MathUtils.degToRad(params.ribRotateZ)
  ]

  return <mesh geometry={geometry} material={material} rotation={rotation} castShadow receiveShadow />
}

export function Backplane3D({ wavePath, lengthMM, depthMM, materialThicknessMM, enabled, shape, organicOffset, slotLayouts }: { 
  wavePath: { x: number, y: number, z: number }[], 
  lengthMM: number, 
  depthMM: number, 
  materialThicknessMM: number, 
  enabled: boolean, 
  shape: 'rectangular' | 'organic', 
  organicOffset: number, 
  slotLayouts: { x: number, y: number, w: number, h: number, shiftX: number, rybH: number, rotateZ: number }[] 
}) {
  if (!enabled || wavePath.length < 2) return null

  const bpDepth = materialThicknessMM

  const getH = (x: number) => {
    try {
      if (!slotLayouts || slotLayouts.length === 0) return 300
      const sorted = [...slotLayouts].sort((a, b) => a.x - b.x)
      if (!sorted[0]) return 300
      
      if (x <= sorted[0].x) return sorted[0].rybH
      if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].rybH
      for (let i = 0; i < sorted.length - 1; i++) {
        if (x >= sorted[i].x && x <= sorted[i+1].x) {
          const t = (x - sorted[i].x) / (sorted[i+1].x - sorted[i].x || 1)
          return sorted[i].rybH + t * (sorted[i+1].rybH - sorted[i].rybH)
        }
      }
      return sorted[0].rybH
    } catch (e) {
      return 300
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

  const bpShape = useMemo(() => {
    try {
      if (shape !== 'organic') return null
      const s = new THREE.Shape()
      const pts: THREE.Vector2[] = []
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

export function ShelfMesh({ params, freeformPoints, customRybSequence, highlightIndex }: { 
  params: ShelfParams, 
  freeformPoints?: FreeformRibPoint[], 
  customRybSequence?: CustomRybSequence | null, 
  highlightIndex?: number 
}) {
  const selectedMaterial = MATERIALS.find(m => (m as any).id === params.material) || (MATERIALS[0] as any)
  const depthMM = toMM(params.ribZ.physical) * params.ribZ.factor

  const memoKey = useMemo(() =>
    `${params.length.value}-${params.length.unit}-${params.height.value}-${params.height.unit}-${params.ribDepth.value}-${params.ribCount}-${params.waveHeight}-${params.waveFrequency}-${params.ribShape}-${params.ribX.physical.value}-${params.ribX.factor}-${params.ribY.physical.value}-${params.ribY.factor}-${params.ribZ.physical.value}-${params.ribZ.factor}-${params.ribRotateX}-${params.ribRotateY}-${params.ribRotateZ}-${params.flatEdge}-${params.sizeTransforms.map(t => `${t.scaleX}-${t.scaleY}`).join(',')}-${params.backplaneBezier?.id || 'none'}`,
    [params.length.value, params.length.unit, params.height.value, params.height.unit, params.ribDepth.value, params.ribCount, params.waveHeight, params.waveFrequency, params.ribShape, params.ribX.physical.value, params.ribX.factor, params.ribY.physical.value, params.ribY.factor, params.ribZ.physical.value, params.ribZ.factor, params.ribRotateX, params.ribRotateY, params.ribRotateZ, params.flatEdge, params.sizeTransforms, params.backplaneBezier]
  )

  const { positions, rotations, profiles } = useMemo(() => 
    generateAllRibs(params, freeformPoints, customRybSequence), 
    [memoKey, freeformPoints, customRybSequence]
  )

  const geometryCacheRef = useRef<Map<string, THREE.BufferGeometry>>(new Map())

  useEffect(() => {
    return () => {
      geometryCacheRef.current.forEach(geo => geo.dispose())
      geometryCacheRef.current.clear()
    }
  }, [])

  const geometries = useMemo(() => {
    const newGeometries: THREE.BufferGeometry[] = []
    const currentCache = geometryCacheRef.current
    
    positions.forEach((_, i) => {
      const p = profiles[i]
      const cacheKey = `${p.shape}-${Math.round(p.width*10)/10}-${Math.round(p.height*10)/10}-${Math.round(depthMM*10)/10}-${params.flatEdge}-${p.freeformPts ? JSON.stringify(p.freeformPts) : 'no-ff'}`
      
      let geo = currentCache.get(cacheKey)
      if (!geo) {
        geo = generateRibGeometry(p.shape, p.width, p.height, depthMM, params.flatEdge, p.freeformPts)
        currentCache.set(cacheKey, geo)
      }
      newGeometries.push(geo)
    })
    
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

export function Scene({ 
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
