import React from 'react'
import { CustomRybEditor } from './CustomRybEditor'
import type { CustomRyb } from '../core/domain/types'

interface BackplaneEditorProps {
  onSave: (selectedRyb: CustomRyb) => void
  onClose: () => void
  initialRyb?: CustomRyb | null
}

export function BackplaneEditor({ onSave, onClose, initialRyb }: BackplaneEditorProps) {
  return (
    <CustomRybEditor 
      onSave={(_, sequence) => { 
        // For the backplane, we only care about the first ryb in the sequence for now
        // Or we treat the entire sequence as a series of keyframes?
        // User requested "draw beziers" so we'll use the selected ryb's shape.
        const selectedRyb = sequence.rybs[sequence.selectedIndex || 0]
        onSave(selectedRyb)
      }} 
      onClose={onClose} 
      initialSequence={initialRyb ? { rybs: [initialRyb], selectedIndex: 0, spacingType: 'even', interpolation: 'linear' } : undefined}
    />
  )
}
