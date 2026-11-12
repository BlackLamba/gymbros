import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-border bg-surface', className)} {...props} />
}

/** Мелкая подпись-заголовок над блоком. */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-[11px] font-semibold uppercase tracking-[0.14em] text-muted', className)}
      {...props}
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-3xl bg-surface-2', className)} />
}
