import { useState } from 'react'
import { INITIAL_SITE_CONFIG } from '../constants'

interface DeveloperConfigProps {
  config: typeof INITIAL_SITE_CONFIG
  onChange: (c: typeof INITIAL_SITE_CONFIG) => void
}

export function DeveloperConfig({ config, onChange }: DeveloperConfigProps) {
  const [open, setOpen] = useState(false)

  if (!open) return (
    <div className="mt-8 border-t border-stone/10 pt-4">
      <button 
        onClick={() => setOpen(true)} 
        className="flex items-center gap-2 text-xs font-medium text-stone hover:text-charcoal transition-colors"
      >
        <span>⚙️</span> Developer Parameters
      </button>
    </div>
  )

  return (
    <div className="mt-8 border-t border-stone/10 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-display text-charcoal flex items-center gap-2">
          <span>⚙️</span> Developer Parameters
        </h4>
        <button 
          onClick={() => setOpen(false)} 
          className="text-xs text-stone hover:text-charcoal pl-2"
        >
          ✕
        </button>
      </div>
      <div className="space-y-3 p-3 bg-stone/5 rounded-lg border border-stone/10">
        {Object.entries(config).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-[10px] text-stone uppercase tracking-wider">{key}</label>
            <input 
              type="number" 
              step="any" 
              value={value} 
              onChange={e => {
                const num = parseFloat(e.target.value);
                if (!isNaN(num)) onChange({ ...config, [key]: num })
              }} 
              className="w-full px-2 py-1 text-xs bg-white border border-stone/20 rounded focus:border-charcoal outline-none" 
            />
          </div>
        ))}
      </div>
    </div>
  )
}
