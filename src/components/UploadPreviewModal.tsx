import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface UploadPreviewModalProps {
  showUploadPreview: boolean
  setShowUploadPreview: (show: boolean) => void
  stagedUploadMesh: THREE.Mesh | null
  previewTransform: {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: number
  }
  setPreviewTransform: React.Dispatch<React.SetStateAction<{
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: number
  }>>
  handleApplySlicing: (mesh: THREE.Mesh, setCustomRybSequence: any) => void
  setCustomRybSequence: any
  setUploadedMesh: (mesh: THREE.Mesh | null) => void
  setUploadedMeshRotation: (rot: { x: number; y: number; z: number }) => void
  setUploadedMeshScale: (scale: number) => void
}

export const UploadPreviewModal: React.FC<UploadPreviewModalProps> = ({
  showUploadPreview,
  setShowUploadPreview,
  stagedUploadMesh,
  previewTransform,
  setPreviewTransform,
  handleApplySlicing,
  setCustomRybSequence,
  setUploadedMesh,
  setUploadedMeshRotation,
  setUploadedMeshScale,
}) => {
  if (!showUploadPreview || !stagedUploadMesh) return null

  const handleConfirmSlicing = () => {
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3(previewTransform.position.x, previewTransform.position.y, previewTransform.position.z)
    const rot = new THREE.Euler(
      THREE.MathUtils.degToRad(previewTransform.rotation.x),
      THREE.MathUtils.degToRad(previewTransform.rotation.y),
      THREE.MathUtils.degToRad(previewTransform.rotation.z)
    )
    const scl = new THREE.Vector3(previewTransform.scale, previewTransform.scale, previewTransform.scale)

    matrix.compose(pos, new THREE.Quaternion().setFromEuler(rot), scl)

    const finalMesh = stagedUploadMesh.clone()
    finalMesh.geometry = stagedUploadMesh.geometry.clone()
    finalMesh.geometry.applyMatrix4(matrix)

    setUploadedMeshScale(1.0)
    setUploadedMeshRotation({ x: 0, y: 0, z: 0 })
    setUploadedMesh(finalMesh)
    setShowUploadPreview(false)

    setTimeout(() => handleApplySlicing(finalMesh, setCustomRybSequence), 50)
  }

  return (
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-cream rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-white flex-shrink-0">
          <h2 className="text-xl font-display text-charcoal flex items-center gap-2">
            <span className="text-primary">⬡</span> 3D Upload Visualizer
          </h2>
          <button 
            onClick={() => setShowUploadPreview(false)}
            className="text-stone-400 hover:text-charcoal transition-colors p-2"
          >✕</button>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white">
          <div className="flex-1 relative bg-stone-100 min-h-[50vh]">
            <Canvas shadows camera={{ position: [500, 500, 500], fov: 45, near: 0.1, far: 20000 }}>
              <ambientLight intensity={1.2} />
              <directionalLight position={[2000, 3000, 2000]} intensity={1.0} />
              <gridHelper args={[1000, 20]} />
              <axesHelper args={[250]} />
              <OrbitControls makeDefault />
              <primitive 
                object={stagedUploadMesh} 
                position={[previewTransform.position.x, previewTransform.position.y, previewTransform.position.z]}
                rotation={[
                  THREE.MathUtils.degToRad(previewTransform.rotation.x),
                  THREE.MathUtils.degToRad(previewTransform.rotation.y),
                  THREE.MathUtils.degToRad(previewTransform.rotation.z)
                ]}
                scale={[previewTransform.scale, previewTransform.scale, previewTransform.scale]}
              />
            </Canvas>
          </div>
          
          <div className="w-full md:w-80 bg-stone-50 border-l border-stone-200 p-6 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal mb-4 flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-stone-200 flex items-center justify-center">⚙</span> Transformation
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-stone-600 font-medium">Scale Multiplier</label>
                    <span className="text-xs font-mono bg-white px-1 rounded border border-stone-200">{previewTransform.scale.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="10" 
                    step="0.1" 
                    value={previewTransform.scale}
                    onChange={(e) => setPreviewTransform(prev => ({...prev, scale: parseFloat(e.target.value)}))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                
                {(['rotation', 'position'] as const).map((group) => (
                  <div key={group} className="pt-2 border-t border-stone-200">
                    <label className="text-xs text-stone-600 font-medium capitalize mb-2 block">{group}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <div key={axis} className="flex flex-col">
                          <span className="text-[10px] text-stone-400 capitalize mb-1">{axis}</span>
                          <input 
                            type="number" 
                            value={previewTransform[group][axis]}
                            onChange={(e) => setPreviewTransform(prev => ({
                              ...prev, 
                              [group]: { ...prev[group], [axis]: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-full bg-white border border-stone-200 rounded text-xs p-1 font-mono text-center"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-auto pt-4 flex gap-2">
              <button 
                onClick={() => setShowUploadPreview(false)}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmSlicing}
                className="flex-1 py-2 rounded-lg bg-primary text-cream text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Confirm & Slice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
