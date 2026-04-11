import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { DeveloperConfig } from './DeveloperConfig'
import { AxisDimensionControl } from './ui/AxisDimensionControl'
import { UnitInput } from './ui/UnitInput'
import type { 
  ShelfParams, 
  FreeformRibPoint, 
  CustomRybSequence, 
  ViewMode, 
  RibShape,
  AxisDimension,
  DimensionUnit
} from '../core/domain/types'
import { 
  INITIAL_SITE_CONFIG, 
  RIB_SHAPES, 
  MATERIALS, 
  PRESETS 
} from '../constants'
import { toMM, createRybFromWave, calculateRibBoundingBox, calculateShelfBoundingBox } from '../utils/geometry'
import { CustomRybEditor } from './CustomRybEditor'
import { BackplaneEditor } from './BackplaneEditor'
import { Scene, ZoomToFit } from './Scene'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'

interface DesignerProps {
  activeSection: 'design' | 'admin'
  isAdmin: boolean
  params: ShelfParams
  handleParamChange: (key: keyof ShelfParams, value: any) => void
  stagedUploadMesh: THREE.Mesh | null
  isSlicing: boolean
  handleApplySlicing: (mesh: THREE.Mesh, callback: (seq: CustomRybSequence) => void) => void
  setCustomRybSequence: (seq: CustomRybSequence | null) => void
  uploadedMesh: THREE.Mesh | null
  handleGlobalUnitChange: (unit: 'mm' | 'in') => void
  globalUnit: 'mm' | 'in'
  customRybSequence: CustomRybSequence | null
  setSelectedRibIndex: (index: number | undefined) => void
  ribViewMode: ViewMode
  setRibViewMode: (mode: ViewMode) => void
  setExpandedRibEditor: (expanded: boolean) => void
  activeFreeformPoints: FreeformRibPoint[] | undefined
  siteConfig: typeof INITIAL_SITE_CONFIG
  handleRibXPhysicalChange: (val: DimensionUnit) => void
  handleRibXFactorChange: (val: number) => void
  handleRibYPhysicalChange: (val: DimensionUnit) => void
  handleRibYFactorChange: (val: number) => void
  handleRibZPhysicalChange: (val: DimensionUnit) => void
  handleRibZFactorChange: (val: number) => void
  setShowFreeformDrawer: (show: boolean) => void
  handleResetRyb: () => void
  handleResetAllRybs: () => void
  setSiteConfig: (config: typeof INITIAL_SITE_CONFIG) => void
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  shelfViewMode: ViewMode
  setShelfViewMode: (mode: ViewMode) => void
  selectedRibIndex: number | undefined
  uploadedMeshRotation: { x: number; y: number; z: number }
  uploadedMeshScale: number
  calculations: { sheets: number; efficiency: number }
  activePreset: string | null
  handlePresetClick: (id: string) => void
  setShowBackplaneEditor: (show: boolean) => void
  setExpandedShelfEditor: (expanded: boolean) => void
  uploadedMeshPath: string | null
  setShowUploadPreview: (show: boolean) => void
  keyframeToShelfIndex: (k: number) => number | undefined
  expandedRibEditor: boolean
  expandedShelfEditor: boolean
  showBackplaneEditor: boolean
  showFreeformDrawer: boolean
  setFreeformPoints: (pts: FreeformRibPoint[]) => void
}

export const Designer: React.FC<DesignerProps> = ({
  activeSection,
  isAdmin,
  params,
  handleParamChange,
  stagedUploadMesh,
  isSlicing,
  handleApplySlicing,
  setCustomRybSequence,
  uploadedMesh,
  handleGlobalUnitChange,
  globalUnit,
  customRybSequence,
  setSelectedRibIndex,
  ribViewMode,
  setRibViewMode,
  setExpandedRibEditor,
  activeFreeformPoints,
  siteConfig,
  handleRibXPhysicalChange,
  handleRibXFactorChange,
  handleRibYPhysicalChange,
  handleRibYFactorChange,
  handleRibZPhysicalChange,
  handleRibZFactorChange,
  setShowFreeformDrawer,
  handleResetRyb,
  handleResetAllRybs,
  setSiteConfig,
  theme,
  setTheme,
  shelfViewMode,
  setShelfViewMode,
  selectedRibIndex,
  uploadedMeshRotation,
  uploadedMeshScale,
  calculations,
  activePreset,
  handlePresetClick,
  setShowBackplaneEditor,
  setExpandedShelfEditor,
  uploadedMeshPath,
  setShowUploadPreview,
  keyframeToShelfIndex,
  expandedRibEditor,
  expandedShelfEditor,
  showBackplaneEditor,
  showFreeformDrawer,
  setFreeformPoints,
}) => {
  if (activeSection !== 'design') return null

  return (
    <section id="designer" className="py-16 bg-ivory">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Left Sidebar */}
          <aside className="space-y-6">
            {/* Upload Visualizer Sidebar Controls */}
            <div className="bg-cream rounded-xl p-5 border border-stone/10 shadow-sm">
              <h3 className="text-xs font-bold text-stone/60 uppercase tracking-[0.1em] mb-3">3D Slicing Engine</h3>
              <div className="space-y-4">
                <div className="p-4 bg-stone/5 border border-dashed border-stone/20 rounded-lg text-center">
                  {uploadedMesh ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-charcoal font-medium text-xs mb-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        Mesh: {uploadedMeshPath?.split('/').pop() || 'Custom Model'}
                      </div>
                      <button 
                        onClick={() => setShowUploadPreview(true)}
                        className="w-full px-4 py-2 bg-white border border-stone-200 text-charcoal rounded-lg text-xs font-bold hover:bg-stone-50 transition-all"
                      >
                        Adjust Model
                      </button>
                    </div>
                  ) : (
                    <div className="text-stone/40 text-xs py-4">No mesh uploaded</div>
                  )}
                </div>

                {uploadedMesh && (
                  <div className="space-y-3 pt-2 border-t border-stone/10">
                    <button 
                      disabled={isSlicing}
                      onClick={() => handleApplySlicing(uploadedMesh!, setCustomRybSequence)} 
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
              {/* Left Column - Shelf Controls */}
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
                      <button key={shape.id} onClick={() => { handleParamChange('ribShape', shape.id as RibShape); if (shape.id === 'freeform') setShowFreeformDrawer(true) }} className={`p-3 text-center text-sm rounded-lg transition-all ${params.ribShape === shape.id ? 'bg-charcoal text-cream' : 'bg-cream text-charcoal hover:bg-stone/10'}`}>
                        <span className="block text-lg mb-1">{shape.icon}</span>
                        {shape.name}
                      </button>
                    ))}
                  </div>
                  {(activeFreeformPoints && activeFreeformPoints.length > 0 || customRybSequence) && (
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

              {/* Center Column - Main Preview */}
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

              {/* Right Column - Secondary Controls */}
              <div className="lg:col-span-3 space-y-4">
                <div className="card">
                  <h3 className="font-display text-base text-charcoal mb-4">Wave Path</h3>

                  {/* Presets */}
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
                          <select value={params.backplaneShape} onChange={(e) => handleParamChange('backplaneShape', e.target.value as 'organic' | 'rectangular')} className="w-full px-2 py-1.5 text-sm rounded bg-cream border border-stone/20">
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
                          <div className="pt-4 border-t border-stone/10 mt-2 space-y-2">
                            <button onClick={() => {
                              const lengthMM = toMM(params.length)
                              const h = (params.ribY.physical.value * params.ribY.factor) + (params.backplaneOrganicOffset * 2)
                              const syncRyb = createRybFromWave(lengthMM, h, params.waveHeight, params.waveFrequency, params.ribCount)
                              handleParamChange('backplaneBezier', syncRyb)
                              setShowBackplaneEditor(true)
                            }} className="w-full px-3 py-1.5 text-xs bg-oak text-cream hover:bg-oak-dark rounded-md transition-all font-medium shadow-sm">Sync & Edit Backplane</button>
                            <button onClick={() => setShowBackplaneEditor(true)} className="w-full px-3 py-1.5 text-xs bg-oak/10 text-oak hover:bg-oak/20 rounded-md transition-all font-medium">Open Editor</button>
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

      {/* Expanded Rib Editor Modal */}
      {expandedRibEditor && (
        <div className="fixed inset-0 z-[100] bg-charcoal flex flex-col pt-16">
          <div className="absolute top-4 right-6 flex items-center gap-4 z-[110]">
            <div className="flex bg-white/10 p-1 rounded-lg backdrop-blur-md">
              {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRibViewMode(mode)}
                  className={`px-4 py-1.5 text-xs rounded-md transition-all ${ribViewMode === mode ? 'bg-cream text-charcoal shadow-lg' : 'text-cream/60 hover:text-cream'}`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setExpandedRibEditor(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-cream flex items-center justify-center transition-all backdrop-blur-md"
            >✕</button>
          </div>
          <div className="flex-1 relative">
            <Canvas camera={{ position: [300, 200, 400], fov: 40, near: 1, far: 20000 }}>
              <Scene 
                params={params} 
                viewMode={ribViewMode} 
                freeformPoints={activeFreeformPoints} 
                customRybSequence={customRybSequence} 
                isSingleRib={true} 
                canvasId="expanded-rib-canvas" 
                siteConfig={siteConfig} 
                enableOrbit={true} 
                showGizmo={true} 
              />
              <ZoomToFit 
                boundingBox={calculateRibBoundingBox(params, activeFreeformPoints)} 
                viewMode={ribViewMode} 
                siteConfig={siteConfig} 
                isSingleRib={true} 
              />
            </Canvas>
            
            {/* Overlay controls for expanded view */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-cream/90 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl w-full max-w-4xl">
              <div className="grid grid-cols-3 gap-8">
                <AxisDimensionControl label="Width (X)" axisDim={params.ribX} onPhysicalChange={handleRibXPhysicalChange} onFactorChange={handleRibXFactorChange} maxMM={1200} />
                <AxisDimensionControl label="Height (Y)" axisDim={params.ribY} onPhysicalChange={handleRibYPhysicalChange} onFactorChange={handleRibYFactorChange} maxMM={1200} />
                <AxisDimensionControl label="Depth (Z)" axisDim={params.ribZ} onPhysicalChange={handleRibZPhysicalChange} onFactorChange={handleRibZFactorChange} maxMM={100} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Shelf Editor Modal */}
      {expandedShelfEditor && (
        <div className="fixed inset-0 z-[100] bg-charcoal flex flex-col pt-16">
          <div className="absolute top-4 right-6 flex items-center gap-4 z-[110]">
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-cream flex items-center justify-center transition-all backdrop-blur-md">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="flex bg-white/10 p-1 rounded-lg backdrop-blur-md">
              {(['3d', 'top', 'front', 'side'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setShelfViewMode(mode)}
                  className={`px-4 py-1.5 text-xs rounded-md transition-all ${shelfViewMode === mode ? 'bg-cream text-charcoal shadow-lg' : 'text-cream/60 hover:text-cream'}`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setExpandedShelfEditor(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-cream flex items-center justify-center transition-all backdrop-blur-md"
            >✕</button>
          </div>
          <div className="flex-1 relative">
            <Canvas shadows camera={{ position: [3000, 2000, 3000], fov: 45, near: 0.1, far: 50000 }}>
              <Scene 
                params={params} 
                viewMode={shelfViewMode} 
                freeformPoints={activeFreeformPoints} 
                customRybSequence={customRybSequence} 
                canvasId="expanded-shelf-canvas" 
                siteConfig={siteConfig} 
                enableOrbit={true} 
                showGizmo={true} 
                highlightIndex={selectedRibIndex}
                theme={theme}
                uploadedMesh={uploadedMesh}
                uploadedMeshRotation={uploadedMeshRotation}
                uploadedMeshScale={uploadedMeshScale}
              />
              <ZoomToFit 
                boundingBox={calculateShelfBoundingBox(params)} 
                viewMode={shelfViewMode} 
                siteConfig={siteConfig} 
              />
              
              <GizmoHelper alignment="bottom-right" margin={[100, 100]}>
                <GizmoViewport axisColors={['#ff3653', '#0adb46', '#2c8fff']} labelColor="white" />
              </GizmoHelper>
            </Canvas>

            {/* Selection Info */}
            {selectedRibIndex !== undefined && (
              <div className="absolute top-20 left-10 p-4 bg-white/10 backdrop-blur-md rounded-xl text-cream border border-white/10">
                <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Active Selection</p>
                <p className="font-display text-xl">Ryb #{selectedRibIndex + 1}</p>
                <div className="mt-2 text-xs flex gap-4">
                  <span>Pos: {((selectedRibIndex! / Math.max(1, (params.ribCount - 1))) * toMM(params.length)).toFixed(1)}mm</span>
                  <span>Height: {toMM(params.ribY.physical).toFixed(1)}mm</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Freeform/Custom Ryb Editor */}
      {showFreeformDrawer && (
        <CustomRybEditor 
          onSave={(points, sequence) => { 
            setFreeformPoints(points); 
            setCustomRybSequence(sequence); 
            setShowFreeformDrawer(false) 
          }} 
          onClose={() => setShowFreeformDrawer(false)} 
        />
      )}

      {/* Backplane Editor */}
      {showBackplaneEditor && (
        <BackplaneEditor
          onSave={(selectedRyb) => {
            handleParamChange('backplaneBezier', selectedRyb)
            setShowBackplaneEditor(false)
          }}
          onClose={() => setShowBackplaneEditor(false)}
          initialRyb={params.backplaneBezier}
        />
      )}
    </section>
  )
}
