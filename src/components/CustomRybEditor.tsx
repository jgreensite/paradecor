import React, { useState, useRef, useEffect } from 'react'
import type { 
  CustomRybSequence, 
  CustomRyb, 
  CurveSegment, 
  BezierControlPoint, 
  FreeformRibPoint 
} from '../core/domain/types'
import { 
  createDefaultRyb, 
  getAllPointsFromRyb 
} from '../utils/geometry'

interface CustomRybEditorProps {
  initialSequence?: CustomRybSequence | null
  onSave: (points: FreeformRibPoint[], sequence: CustomRybSequence) => void
  onClose: () => void
}

export function CustomRybEditor({ initialSequence, onSave, onClose }: CustomRybEditorProps) {
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

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      } else if ('changedTouches' in e && e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX
        clientY = e.changedTouches[0].clientY
      } else return null
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
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

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPointerPos(e)
    if (!pos) return
    const { x, y } = pos

    const ryb = sequence.rybs[sequence.selectedIndex]
    let closestDist = 30 
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

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPointerPos(e)
    if (!pos) return
    const { x, y } = pos

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
      const ryb = sequence.rybs[sequence.selectedIndex]
      let closestDist = 30 
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

  const handlePointerUp = () => {
    setDragging(false)
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

  const renameRyb = (index: number, name: string) => {
    const newRybs = [...sequence.rybs]
    newRybs[index] = { ...newRybs[index], name }
    setSequence(prev => ({ ...prev, rybs: newRybs }))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
  }, [sequence, selectedPoint, hoveredPoint, showOnionSkin, editorMode, dragging])

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

        <canvas
          ref={canvasRef}
          width={500}
          height={300}
          className="w-full border border-stone/20 rounded-lg bg-white"
          style={{ touchAction: 'none' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
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
