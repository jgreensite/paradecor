import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useDependencies } from './context/DependencyContext'
import * as THREE from 'three'
// @ts-ignore
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
// @ts-ignore
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { ExportService } from './core/services/ExportService'
import { createSlotWithDogbone, createBackplaneOutline, generateCncLayout } from './core/domain/geometry'
import type {
  Unit, ViewMode, RibShape,
  DimensionUnit, AxisDimension, RibSizeTransform,
  ShelfParams, FreeformRibPoint,
  CurveType, BezierControlPoint, CurveSegment,
  CustomRyb, CustomRybSequence
} from './core/domain/types'
import { useDesignerState } from './hooks/useDesignerState'
import { useUploadMesh } from './hooks/useUploadMesh'
import { useCustomRybSequence } from './hooks/useCustomRybSequence'

import { MATERIALS, FINISHES, RIB_SHAPES, PRESETS, INITIAL_SITE_CONFIG } from './constants'
import { toMM, toPhysical, createAxisDimension, updateAxisDimensionFromPhysical, updateAxisDimensionFromFactor, generateAllRibParams, generateAllRibs, generateWavePath, interpolateTransform, calculateRibBoundingBox, calculateShelfBoundingBox, calculateSheetsNeeded, MM_PER_INCH, createRybFromWave, getCustomRybHeightAtX } from './utils/geometry'
import { Float, OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { Scene, ShelfMesh, SingleRibPreview, ZoomToFit, CameraSweep } from './components/Scene'
import { Navigation } from './components/Navigation'
import { Hero } from './components/Hero'
import { PricingSection } from './components/PricingSection'
import { Footer } from './components/Footer'
import { SuccessModal } from './components/SuccessModal'
import { UploadPreviewModal } from './components/UploadPreviewModal'
import { ExportModal } from './components/ExportModal'
import { CustomRybEditor } from './components/CustomRybEditor'
import { BackplaneEditor } from './components/BackplaneEditor'
import { DeveloperConfig } from './components/DeveloperConfig'
import { Designer } from './components/Designer'
import { AxisDimensionControl } from './components/ui/AxisDimensionControl'
import { UnitInput } from './components/ui/UnitInput'

// Types are imported from src/core/domain/types.ts — do not re-declare here.
// Remaining logic is managed by the App component


// FreeformDrawer removed — replaced by CustomRybEditor above



function App() {
  const { auth, payment } = useDependencies()
  const { user } = auth.useAuthUser()
  const { SignInButton, UserButton } = auth
  const isAdmin = user?.roles?.includes('admin') ?? false
  const [siteConfig, setSiteConfig] = useState(INITIAL_SITE_CONFIG)

  // ── Designer state (RYB-112) — params, unit, calculations, and all handlers ──
  const {
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
  } = useDesignerState()

  const [activeSection, setActiveSection] = useState('design')
  const [ribViewMode, setRibViewMode] = useState<ViewMode>('3d')
  const [shelfViewMode, setShelfViewMode] = useState<ViewMode>('3d')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [showExport, setShowExport] = useState(false)
  const [showBackplaneEditor, setShowBackplaneEditor] = useState(false)
  
  const {
    showUploadPreview, setShowUploadPreview,
    stagedUploadMesh, setStagedUploadMesh,
    previewTransform, setPreviewTransform,
    uploadedMesh, setUploadedMesh,
    uploadedMeshRotation, setUploadedMeshRotation,
    uploadedMeshScale, setUploadedMeshScale,
    isSlicing, setIsSlicing, handleFileUpload, handleApplySlicing
  } = useUploadMesh(params, handleParamChange)

  const {
    freeformPoints, setFreeformPoints,
    customRybSequence, setCustomRybSequence,
    showFreeformDrawer, setShowFreeformDrawer,
    activeFreeformPoints, handleResetRyb, handleResetAllRybs
  } = useCustomRybSequence(handleParamChange)

  const [isExporting, setIsExporting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)
  
  const [isRedirecting, setIsRedirecting] = useState(false)
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



  // --- STRIPE SUCCESS DETECTION (EPIC-13) ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session_id')
    
    if (sessionId) {
      setShowSuccessModal(true)
      // Attempt to get the email from the URL if we passed it back, 
      // or just show a generic success message.
      // Cleaning the URL so the modal doesn't re-appear on refresh
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // calculations is now provided by useDesignerState (RYB-112)
  const selectedMaterial = useMemo(() => MATERIALS.find(m => m.id === params.material) || MATERIALS[0], [params.material])
  const selectedFinish = useMemo(() => FINISHES.find(f => f.id === params.finish) || FINISHES[0], [params.finish])
  const basePrice = useMemo(() => selectedMaterial.price * calculations.sheets, [selectedMaterial.price, calculations.sheets])
  const finishPrice = useMemo(() => selectedFinish.price * params.ribCount, [selectedFinish.price, params.ribCount])
  const totalPrice = useMemo(() => basePrice + finishPrice + 35, [basePrice, finishPrice])

  // handleParamChange, axis callbacks, handlePresetClick: all from useDesignerState (RYB-112)

  const userEmail = user?.email || null

  const handleStripeCheckout = async () => {
    setIsRedirecting(true)
    try {
      const { url, error } = await payment.createCheckoutSession({
        price: totalPrice,
        params,
        userEmail: user?.email || null,
        userId: user?.id || null // Critical for guest vs auth distinction in backend
      })
      
      if (url) {
        window.location.href = url
      } else {
        console.error('No Checkout URL returned:', error)
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
        const svg = ExportService.generateSVG(fullModel)
        ExportService.downloadFile(svg, 'image/svg+xml', `rybform-cutfile-${params.ribCount}rybs.svg`)
      } else {
        const dxf = ExportService.generateDXF(fullModel)
        ExportService.downloadFile(dxf, 'application/dxf', `rybform-cutfile-${params.ribCount}rybs.dxf`)
      }
    } finally {
      setIsExporting(false)
      setShowExport(false)
    }
  }


  return (
    <div className="min-h-screen grain">
      {/* Navigation */}
      <Navigation 
        activeSection={activeSection as 'design' | 'admin'} 
        setActiveSection={setActiveSection} 
        isAdmin={isAdmin} 
        user={user} 
        setShowExport={setShowExport}
        SignInButton={SignInButton}
        UserButton={UserButton}
      />

      <main className="pt-20">
        {/* Hero */}
        <Hero 
          params={params} 
          activeFreeformPoints={activeFreeformPoints} 
          customRybSequence={customRybSequence} 
          siteConfig={siteConfig}
        />

        <Designer 
          activeSection={activeSection as 'design' | 'admin'}
          isAdmin={isAdmin}
          params={params}
          handleParamChange={handleParamChange}
          stagedUploadMesh={stagedUploadMesh}
          isSlicing={isSlicing}
          handleApplySlicing={handleApplySlicing}
          setCustomRybSequence={setCustomRybSequence}
          uploadedMesh={uploadedMesh}
          handleGlobalUnitChange={handleGlobalUnitChange}
          globalUnit={globalUnit}
          customRybSequence={customRybSequence}
          setSelectedRibIndex={setSelectedRibIndex}
          ribViewMode={ribViewMode}
          setRibViewMode={setRibViewMode}
          expandedRibEditor={expandedRibEditor}
          setExpandedRibEditor={setExpandedRibEditor}
          expandedShelfEditor={expandedShelfEditor}
          setExpandedShelfEditor={setExpandedShelfEditor}
          showBackplaneEditor={showBackplaneEditor}
          setShowBackplaneEditor={setShowBackplaneEditor}
          showFreeformDrawer={showFreeformDrawer}
          setShowFreeformDrawer={setShowFreeformDrawer}
          activeFreeformPoints={activeFreeformPoints}
          setFreeformPoints={setFreeformPoints}
          siteConfig={siteConfig}
          handleRibXPhysicalChange={handleRibXPhysicalChange}
          handleRibXFactorChange={handleRibXFactorChange}
          handleRibYPhysicalChange={handleRibYPhysicalChange}
          handleRibYFactorChange={handleRibYFactorChange}
          handleRibZPhysicalChange={handleRibZPhysicalChange}
          handleRibZFactorChange={handleRibZFactorChange}
          handleResetRyb={handleResetRyb}
          handleResetAllRybs={handleResetAllRybs}
          setSiteConfig={setSiteConfig}
          theme={theme}
          setTheme={setTheme}
          shelfViewMode={shelfViewMode}
          setShelfViewMode={setShelfViewMode}
          selectedRibIndex={selectedRibIndex}
          uploadedMeshRotation={uploadedMeshRotation}
          uploadedMeshScale={uploadedMeshScale}
          calculations={calculations}
          activePreset={activePreset}
          handlePresetClick={handlePresetClick}
          uploadedMeshPath={null}
          setShowUploadPreview={setShowUploadPreview}
          keyframeToShelfIndex={keyframeToShelfIndex as any}
        />

        {/* Total Price Summary Section */}
        <PricingSection 
          params={params} 
          totalPrice={totalPrice} 
          isAdmin={isAdmin} 
          isRedirecting={isRedirecting} 
          handleStripeCheckout={handleStripeCheckout} 
          setShowExport={setShowExport}
        />
      </main>

      {/* Export Modal */}
      {showExport && <ExportModal onExport={handleExport} onClose={() => setShowExport(false)} isExporting={isExporting} />}



      {/* Footer */}
      <Footer />

      {showUploadPreview && stagedUploadMesh && (
        <UploadPreviewModal
          showUploadPreview={showUploadPreview}
          stagedUploadMesh={stagedUploadMesh}
          previewTransform={previewTransform}
          setPreviewTransform={setPreviewTransform}
          setShowUploadPreview={setShowUploadPreview}
          handleApplySlicing={handleApplySlicing}
          setUploadedMesh={setUploadedMesh}
          setUploadedMeshRotation={setUploadedMeshRotation}
          setUploadedMeshScale={setUploadedMeshScale}
          setCustomRybSequence={setCustomRybSequence}
        />
      )}

      {/* Success Modal (EPIC-13) */}
      {showSuccessModal && (
        <SuccessModal 
          showSuccessModal={showSuccessModal} 
          setShowSuccessModal={setShowSuccessModal} 
          user={user} 
        />
      )}
    </div>
  )
}

export default App
