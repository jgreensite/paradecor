import React from 'react'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-charcoal text-cream py-8">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-charcoal text-cream flex items-center justify-center font-display text-lg">R</div>
          <span className="font-display text-xl">Rybform</span>
        </div>
        <p className="text-cream/50 text-sm">Parametric rib-based furniture</p>
      </div>
    </footer>
  )
}
