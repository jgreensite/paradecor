import { useState, useMemo, useCallback } from 'react'
import type { ShelfParams, CustomRybSequence, CustomRyb, BezierControlPoint } from '../core/domain/types'

function getAllPointsFromRyb(ryb: CustomRyb): BezierControlPoint[] {
  const pts: BezierControlPoint[] = []
  if (!ryb.segments || ryb.segments.length === 0) return pts

  for (const segment of ryb.segments) {
    if (segment.type === 'line' || !segment.control1 || !segment.control2) {
      pts.push(segment.end)
    } else {
      // 10 samples per bezier segment
      const samples = 10
      for (let i = 1; i <= samples; i++) {
        const t = i / samples
        const t1 = 1 - t
        const x = t1 * t1 * t1 * segment.start.x + 3 * t1 * t1 * t * segment.control1.x + 3 * t1 * t * t * segment.control2.x + t * t * t * segment.end.x
        const y = t1 * t1 * t1 * segment.start.y + 3 * t1 * t1 * t * segment.control1.y + 3 * t1 * t * t * segment.control2.y + t * t * t * segment.end.y
        pts.push({ x, y })
      }
    }
  }
  return pts
}

/**
 * useCustomRybSequence — RYB-114 (EPIC-16)
 * 
 * Encapsulates all state and logic for custom ryb sequences and freeform point editing.
 * Provides stable handlers for resetting and syncing sequences.
 */
export function useCustomRybSequence(handleParamChange: (key: keyof ShelfParams, value: any) => void) {
  const [freeformPoints, setFreeformPoints] = useState<{ x: number, y: number }[]>([])
  const [customRybSequence, setCustomRybSequence] = useState<CustomRybSequence | null>(null)
  const [showFreeformDrawer, setShowFreeformDrawer] = useState(false)

  /**
   * activeFreeformPoints
   * 
   * Returns the points for the currently selected ryb in a sequence,
   * or the global freeformPoints if no sequence is active.
   */
  const activeFreeformPoints = useMemo(() => {
    if (customRybSequence && customRybSequence.rybs[customRybSequence.selectedIndex]) {
      return getAllPointsFromRyb(customRybSequence.rybs[customRybSequence.selectedIndex])
    }
    return freeformPoints
  }, [customRybSequence, freeformPoints])

  const handleResetRyb = useCallback(() => {
    setFreeformPoints([])
    setCustomRybSequence(null)
  }, [])

  const handleResetAllRybs = useCallback(() => {
    setFreeformPoints([])
    setCustomRybSequence(null)
    handleParamChange('ribShape', 'square')
  }, [handleParamChange])

  return {
    freeformPoints,
    setFreeformPoints,
    customRybSequence,
    setCustomRybSequence,
    showFreeformDrawer,
    setShowFreeformDrawer,
    activeFreeformPoints,
    handleResetRyb,
    handleResetAllRybs
  }
}
