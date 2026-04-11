import React from 'react'

interface ExportModalProps {
  isExporting: boolean
  onExport: (format: 'svg' | 'dxf') => void
  onClose: () => void
}

export function ExportModal({ isExporting, onExport, onClose }: ExportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50">
      <div className="bg-cream rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="font-display text-2xl text-charcoal mb-6">Export Files</h2>
        <div className="space-y-4">
          <button 
            onClick={() => onExport('svg')} 
            disabled={isExporting} 
            className="w-full p-4 bg-charcoal text-cream rounded-xl hover:bg-stone flex items-center justify-between disabled:opacity-50 transition-all"
          >
            <div className="text-left">
              <p className="font-medium text-cream">SVG Cut Files</p>
              <p className="text-xs text-cream/60">Ribs laid flat with numbers</p>
            </div>
            <span className="text-oak text-xl">↓</span>
          </button>
          <button 
            onClick={() => onExport('dxf')} 
            disabled={isExporting} 
            className="w-full p-4 bg-charcoal text-cream rounded-xl hover:bg-stone flex items-center justify-between disabled:opacity-50 transition-all"
          >
            <div className="text-left">
              <p className="font-medium text-cream">DXF Cut Files</p>
              <p className="text-xs text-cream/60">CAD-ready format</p>
            </div>
            <span className="text-oak text-xl">↓</span>
          </button>
        </div>
        <button 
          onClick={onClose} 
          className="w-full mt-6 py-3 text-stone hover:text-charcoal font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
