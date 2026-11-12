import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-13 w-full rounded-2xl border border-border bg-surface px-4 text-base text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-accent-text'

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <input id={id} className={cn(inputClass, className)} {...props} />
    </div>
  )
}
