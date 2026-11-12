'use client'

import { memo } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import {
  type EditorSet,
  sanitizeRepsInput,
  sanitizeWeightInput,
  stepReps,
  stepWeight,
} from '@/lib/workout-editor'
import { cn } from '@/lib/utils'

type Patch = Partial<Pick<EditorSet, 'weight' | 'reps'>>

function Stepper({
  value,
  placeholder,
  label,
  inputMode,
  invalid,
  onInput,
  onStep,
}: {
  value: string
  placeholder: string
  label: string
  inputMode: 'decimal' | 'numeric'
  invalid?: boolean
  onInput: (raw: string) => void
  onStep: (direction: 1 | -1) => void
}) {
  const stepButton =
    'flex h-12 w-8 shrink-0 items-center justify-center text-muted transition-colors active:bg-border active:text-fg min-[360px]:w-9'
  return (
    <div
      className={cn(
        'flex h-12 min-w-0 items-stretch overflow-hidden rounded-xl bg-surface-2 ring-1 ring-inset transition-shadow focus-within:ring-2 focus-within:ring-accent-text',
        invalid ? 'ring-danger/60' : 'ring-transparent',
      )}
    >
      <button type="button" tabIndex={-1} aria-label={`${label}: меньше`} className={stepButton} onClick={() => onStep(-1)}>
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode={inputMode}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="tabular w-full min-w-0 bg-transparent text-center text-base font-semibold text-fg outline-none min-[360px]:text-[17px] placeholder:font-normal placeholder:text-muted/60"
      />
      <button type="button" tabIndex={-1} aria-label={`${label}: больше`} className={stepButton} onClick={() => onStep(1)}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export const SetRow = memo(function SetRow({
  index,
  set,
  hintWeight,
  hintReps,
  onChange,
  onRemove,
}: {
  index: number
  set: EditorSet
  /** Значения этого же подхода в прошлый раз — показываются как подсказка в пустых полях */
  hintWeight?: string
  hintReps?: string
  onChange: (setId: string, patch: Patch) => void
  onRemove: (setId: string) => void
}) {
  return (
    <li className="grid animate-rise grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-1.5">
      <span className="tabular text-center text-sm font-medium text-muted">{index + 1}</span>
      <Stepper
        label={`Подход ${index + 1}, вес в килограммах`}
        inputMode="decimal"
        value={set.weight}
        placeholder={hintWeight || '0'}
        onInput={(raw) => onChange(set.id, { weight: sanitizeWeightInput(raw) })}
        onStep={(d) => onChange(set.id, { weight: stepWeight(set.weight, d) })}
      />
      <Stepper
        label={`Подход ${index + 1}, повторения`}
        inputMode="numeric"
        value={set.reps}
        placeholder={hintReps || '0'}
        onInput={(raw) => onChange(set.id, { reps: sanitizeRepsInput(raw) })}
        onStep={(d) => onChange(set.id, { reps: stepReps(set.reps, d) })}
      />
      <button
        type="button"
        aria-label={`Удалить подход ${index + 1}`}
        onClick={() => onRemove(set.id)}
        className="flex h-12 w-8 items-center justify-center rounded-xl text-muted transition-colors active:bg-surface-2 active:text-danger"
      >
        <X className="size-[18px]" />
      </button>
    </li>
  )
})
