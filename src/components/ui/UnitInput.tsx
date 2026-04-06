import type { DimensionUnit, Unit } from '../../core/domain/types'
import { MM_PER_INCH } from '../../utils/geometry'

interface UnitInputProps {
  label: string
  value: DimensionUnit
  onChange: (dim: DimensionUnit) => void
  minMM?: number
  maxMM?: number
  step?: number
}

export function UnitInput({ 
  label, 
  value, 
  onChange, 
  minMM = 1, 
  maxMM = 10000, 
  step = 0.1 
}: UnitInputProps) {
  const currentMin = value.unit === 'mm' ? minMM : minMM / MM_PER_INCH
  const currentMax = value.unit === 'mm' ? maxMM : maxMM / MM_PER_INCH
  
  return (
    <div className="flex items-center gap-2">
      <input 
        type="number" 
        min={currentMin} 
        max={currentMax} 
        step={step} 
        value={Number(value.value.toFixed(2))} 
        onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} 
        className="w-20 px-2 py-1 text-sm bg-cream border border-stone/20 rounded-md focus:outline-none focus:border-oak" 
        aria-label={label}
      />
      <select 
        value={value.unit} 
        onChange={(e) => onChange({ ...value, unit: e.target.value as Unit })} 
        className="px-2 py-1 text-sm bg-cream border border-stone/20 rounded-md focus:outline-none focus:border-oak"
      >
        <option value="in">in</option>
        <option value="mm">mm</option>
      </select>
    </div>
  )
}
