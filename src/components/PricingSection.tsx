import React from 'react'
import type { ShelfParams } from '../core/domain/types'

interface PricingSectionProps {
  params: ShelfParams
  totalPrice: number
  isAdmin: boolean
  isRedirecting: boolean
  setShowExport: (show: boolean) => void
  handleStripeCheckout: () => void
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  params,
  totalPrice,
  isAdmin,
  isRedirecting,
  setShowExport,
  handleStripeCheckout,
}) => {
  return (
    <section className="bg-charcoal px-8 py-12 rounded-3xl mt-12 shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-tr from-charcoal via-charcoal to-oak/10 opacity-50" />
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="text-center md:text-left flex-1">
          <p className="text-oak font-display text-sm uppercase tracking-widest mb-4">Pricing Estimation (Local)</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-cream text-5xl font-display">${totalPrice}</span>
            <span className="text-cream/40 text-sm">USD</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-2 text-cream/60 text-sm">
            <span>{params.length.value}{params.length.unit} × {params.height.value}{params.height.unit}</span>
            <span className="w-1 h-1 rounded-full bg-cream/20" />
            <span>{params.ribCount} {params.ribShape} rybs</span>
          </div>
        </div>
        
        <div className="w-full md:w-auto min-w-[280px]">
          {isAdmin ? (
            <div className="space-y-3">
              <button 
                className="w-full py-4 bg-oak text-charcoal font-bold rounded-xl hover:bg-cream hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-oak/20" 
                onClick={() => setShowExport(true)}
              >
                Export Production Files (Admin)
              </button>
              <button 
                disabled={isRedirecting} 
                className="w-full py-3 bg-transparent border border-oak/30 text-oak font-bold rounded-xl hover:bg-oak/10 transition-all disabled:opacity-50"
                onClick={handleStripeCheckout}
              >
                {isRedirecting ? 'Redirecting to Checkout...' : 'Test Stripe Checkout'}
              </button>
            </div>
          ) : (
            <button 
              disabled={isRedirecting} 
              className="w-full py-4 bg-oak text-charcoal font-bold rounded-xl hover:bg-cream hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-oak/20"
              onClick={handleStripeCheckout}
            >
              {isRedirecting ? 'Redirecting to Checkout...' : 'Buy Now'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
