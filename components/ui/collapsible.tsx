'use client'

import { type ReactNode, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Раскрывающийся блок: в свёрнутом виде занимает одну строку. */
export function Collapsible({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-16 w-full items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3 text-left transition-colors active:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-snug">{title}</span>
          {meta ? <span className="tabular mt-0.5 block text-sm text-muted">{meta}</span> : null}
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={id} className="mt-2 animate-rise">
          {children}
        </div>
      ) : null}
    </div>
  )
}
