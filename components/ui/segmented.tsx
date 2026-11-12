'use client'

import { cn } from '@/lib/utils'

/** Переключатель из нескольких равноправных вариантов. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-10 min-w-0 flex-1 truncate rounded-xl px-2 text-sm font-semibold transition-colors',
              selected ? 'bg-surface text-fg shadow-sm' : 'text-muted active:text-fg',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
