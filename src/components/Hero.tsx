import React from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './Scene'
import type { ShelfParams, FreeformRibPoint, CustomRybSequence } from '../core/domain/types'
import { INITIAL_SITE_CONFIG } from '../constants'

interface HeroProps {
  params: ShelfParams
  activeFreeformPoints: FreeformRibPoint[] | undefined
  customRybSequence: CustomRybSequence | null
  siteConfig: typeof INITIAL_SITE_CONFIG
  cyclingFadeIn: boolean
}

export const Hero: React.FC<Omit<HeroProps, 'cyclingFadeIn'>> = ({
  params,
  activeFreeformPoints,
  customRybSequence,
  siteConfig,
}) => {
  const [cyclingRybIndex, setCyclingRybIndex] = React.useState(0)
  const [cyclingFadeIn, setCyclingFadeIn] = React.useState(true)

  React.useEffect(() => {
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

  return (
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
            <Scene 
              params={params} 
              viewMode={'3d'} 
              freeformPoints={activeFreeformPoints} 
              customRybSequence={customRybSequence} 
              canvasId="hero-canvas" 
              autoSweep 
              enableOrbit={true} 
              siteConfig={siteConfig} 
              showGizmo={false} 
            />
          </Canvas>
          {/* Cycling Single Ryb Preview Overlay */}
          <div className="absolute top-4 right-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="w-36 h-36 bg-cream/90 backdrop-blur-md rounded-xl overflow-hidden border-2 border-charcoal/10 shadow-2xl">
              <Canvas 
                shadows 
                camera={{ position: [20, 15, 25], fov: 35, near: 0.1, far: 5000 }} 
                style={{ 
                  opacity: cyclingFadeIn ? 1 : 0, 
                  transition: `opacity ${siteConfig.previewFadeDurationMs}ms ease-in-out` 
                }} 
                className="w-full h-full"
              >
                <Scene 
                  params={params} 
                  viewMode={'3d'} 
                  freeformPoints={activeFreeformPoints} 
                  customRybSequence={customRybSequence} 
                  isSingleRib={true} 
                  canvasId="mini-single-canvas" 
                  autoSweep 
                  enableOrbit={false} 
                  siteConfig={siteConfig} 
                  showGizmo={false} 
                  isPreview={true} 
                />
              </Canvas>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
