import type { AxisDimension, DimensionUnit } from '../../core/domain/types'
import { UnitInput } from './UnitInput'

interface AxisDimensionControlProps {
  label: string
  axisDim: AxisDimension
  onPhysicalChange: (dim: DimensionUnit) => void
  onFactorChange: (factor: number) => void
  maxMM?: number
}

export function AxisDimensionControl({ 
  label, 
  axisDim, 
  onPhysicalChange, 
  onFactorChange, 
  maxMM = 600 
}: AxisDimensionControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-charcoal">{label} (Physical)</label>
      <UnitInput 
        label={label} 
        value={axisDim.physical} 
        onChange={onPhysicalChange} 
        minMM={1} 
        maxMM={maxMM} 
        step={axisDim.physical.unit === 'mm' ? 1 : 0.125} 
      />
      <label className="text-xs font-medium text-charcoal">{label} Factor</label>
      <input 
        type="range" 
        min={0.1} 
        max={3} 
        step={0.1} 
        value={axisDim.factor} 
        onChange={(e) => onFactorChange(Number(e.target.value))} 
        className="w-full accent-charcoal" 
      />
      <span className="text-xs text-warm-gray">{axisDim.factor.toFixed(2)}x</span>
    </div>
  )
}
