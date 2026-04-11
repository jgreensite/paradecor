import { useState, useCallback } from 'react'
import { useToast } from '../components/ui/Toast'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { 
  ShelfParams, 
  RibSizeTransform, 
  CustomRyb, 
  CustomRybSequence, 
  CurveSegment
} from '../core/domain/types'

/**
 * useUploadMesh — RYB-113 (EPIC-16)
 * 
 * Encapsulates all logic for uploading 3D files (STL/OBJ), 
 * previewing them, and slicing them into the parametric ryb system.
 */
export function useUploadMesh(params: ShelfParams, handleParamChange: (key: keyof ShelfParams, value: any) => void) {
  const [showUploadPreview, setShowUploadPreview] = useState(false)
  const [stagedUploadMesh, setStagedUploadMesh] = useState<THREE.Mesh | null>(null)
  const [previewTransform, setPreviewTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 90, z: 0 },
    scale: 1.0
  })

  const [uploadedMesh, setUploadedMesh] = useState<THREE.Mesh | null>(null)
  const [uploadedMeshRotation, setUploadedMeshRotation] = useState({ x: 0, y: 0, z: 0 })
  const [uploadedMeshScale, setUploadedMeshScale] = useState(1.0)
  const [isSlicing, setIsSlicing] = useState(false)
  const { showToast } = useToast()

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear input so same file can be re-selected
    e.target.value = ''

    const reader = new FileReader()
    const fileName = file.name.toLowerCase()

    reader.onload = (event) => {
      const contents = event.target?.result
      if (!contents) return

      let geometry: THREE.BufferGeometry | null = null

      try {
        if (fileName.endsWith('.stl')) {
          const loader = new STLLoader()
          geometry = loader.parse(contents as ArrayBuffer)
        } else if (fileName.endsWith('.obj')) {
          const loader = new OBJLoader()
          const object = loader.parse(new TextDecoder().decode(contents as ArrayBuffer))
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              geometry = child.geometry
            }
          })
        }

        if (geometry) {
          geometry.computeBoundingBox()
          geometry.center()
          
          // Compute auto-scale for preview (target size ~120-150 units)
          geometry.computeBoundingSphere()
          const radius = geometry.boundingSphere?.radius || 100
          const scaleTarget = 120 / (radius || 1)

          const material = new THREE.MeshPhongMaterial({ 
              color: 0x808080, 
              specular: 0x111111, 
              shininess: 200,
              transparent: true,
              opacity: 0.8
          })
          const mesh = new THREE.Mesh(geometry, material)
          
          setStagedUploadMesh(mesh)
          setPreviewTransform({
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 90, z: 0 },
              scale: parseFloat(scaleTarget.toFixed(3))
          })
          setShowUploadPreview(true)
        }
      } catch (err) {
        console.error("Upload error:", err)
        showToast('Failed to load 3D mesh. Please ensure it is a valid STL or OBJ file.', 'error')
      }
    }

    if (fileName.endsWith('.stl') || fileName.endsWith('.obj')) {
      reader.readAsArrayBuffer(file)
    }
  }, [])

  const complexSliceMeshToRybs = useCallback((mesh: THREE.Mesh): { sequence: CustomRybSequence, bounds: THREE.Vector3 } => {
    const ribCount = params.ribCount
    const rybs: CustomRyb[] = []
    
    mesh.geometry.computeBoundingBox()
    const bbox = mesh.geometry.boundingBox!
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const center = new THREE.Vector3()
    bbox.getCenter(center)
    
    const raycaster = new THREE.Raycaster()
    
    // Z is mapped to canvas width (500). Y is mapped to canvas height (300).
    const scale = Math.min(500 / (size.z || 1), 300 / (size.y || 1))
    const offsetX = 250 
    const offsetY = 150 
    
    for (let i = 0; i < ribCount; i++) {
        const t = i / (ribCount - 1 || 1)
        const x = center.x - size.x/2 + t * size.x
        
        const segments: CurveSegment[] = []
        const resolution = 64 
        const topPts: {x: number, y: number}[] = []
        const bottomPts: {x: number, y: number}[] = []
        
        for (let j = 0; j <= resolution; j++) {
            const tz = j / resolution
            const z = center.z - size.z/2 + tz * size.z
            
            raycaster.set(new THREE.Vector3(x, center.y + size.y * 2, z), new THREE.Vector3(0, -1, 0))
            const intersectsTop = raycaster.intersectObject(mesh)
            
            raycaster.set(new THREE.Vector3(x, center.y - size.y * 2, z), new THREE.Vector3(0, 1, 0))
            const intersectsBottom = raycaster.intersectObject(mesh)
            
            if (intersectsTop.length > 0 && intersectsBottom.length > 0) {
                const localZ = intersectsTop[0].point.z - center.z
                const localTopY = intersectsTop[0].point.y - center.y
                const localBottomY = intersectsBottom[0].point.y - center.y
                
                const canvasX = offsetX + localZ * scale
                const canvasTopY = offsetY - localTopY * scale
                const canvasBottomY = offsetY - localBottomY * scale
                
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
            segments.push({type:'line', start:{x:250,y:150}, end:{x:251,y:150}})
            segments.push({type:'line', start:{x:251,y:150}, end:{x:251,y:151}})
            segments.push({type:'line', start:{x:251,y:151}, end:{x:250,y:151}})
            segments.push({type:'line', start:{x:250,y:151}, end:{x:250,y:150}})
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
      sequence: {
        rybs,
        spacingType: 'even',
        interpolation: 'linear',
        selectedIndex: 0
      },
      bounds: size
    }
  }, [params.ribCount])

  const handleApplySlicing = useCallback((mesh: THREE.Mesh, setCustomRybSequence: (seq: CustomRybSequence) => void) => {
    setIsSlicing(true)
    
    setTimeout(() => {
      try {
        // Apply rotation and scale to a temp geometry for slicing
        const geom = mesh.geometry.clone()
        geom.scale(uploadedMeshScale, uploadedMeshScale, uploadedMeshScale)
        
        const euler = new THREE.Euler(
          THREE.MathUtils.degToRad(uploadedMeshRotation.x),
          THREE.MathUtils.degToRad(uploadedMeshRotation.y),
          THREE.MathUtils.degToRad(uploadedMeshRotation.z)
        )
        const matrix = new THREE.Matrix4().makeRotationFromEuler(euler)
        geom.applyMatrix4(matrix)
        
        const tempMesh = new THREE.Mesh(geom, mesh.material as THREE.Material)
        tempMesh.updateMatrixWorld(true)

        const result = complexSliceMeshToRybs(tempMesh)

        // Update physical parameters
        handleParamChange('length', { value: Math.round(result.bounds.x), unit: 'mm' })
        handleParamChange('height', { value: Math.round(result.bounds.y), unit: 'mm' })
        handleParamChange('ribX', { ...params.ribX, physical: { value: Math.round(result.bounds.z), unit: 'mm' } })
        handleParamChange('ribY', { ...params.ribY, physical: { value: Math.round(result.bounds.y), unit: 'mm' } })
        
        // Reset decorators
        handleParamChange('waveHeight', 0)
        handleParamChange('backplaneEnabled', false)
        handleParamChange('sizeTransforms', [])
        
        setCustomRybSequence(result.sequence)
        handleParamChange('ribShape', 'freeform')
        
        showToast(`Successfully converted 3D mesh into ${result.sequence.rybs.length} ribs.`, 'success')
      } catch (err) {
        console.error('Slicing error:', err)
        showToast('Error slicing mesh. Please try a simpler model.', 'error')
      } finally {
        setIsSlicing(false)
      }
    }, 100)
  }, [complexSliceMeshToRybs, handleParamChange, params.ribX, params.ribY, uploadedMeshRotation, uploadedMeshScale])

  const resetUpload = useCallback(() => {
    setStagedUploadMesh(null)
    setUploadedMesh(null)
    setShowUploadPreview(false)
  }, [])

  return {
    showUploadPreview,
    setShowUploadPreview,
    stagedUploadMesh,
    setStagedUploadMesh,
    previewTransform,
    setPreviewTransform,
    uploadedMesh,
    setUploadedMesh,
    uploadedMeshRotation,
    setUploadedMeshRotation,
    uploadedMeshScale,
    setUploadedMeshScale,
    isSlicing,
    setIsSlicing,
    handleFileUpload,
    handleApplySlicing,
    resetUpload
  }
}
