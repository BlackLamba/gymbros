'use client'

import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useNowSeconds } from './use-now'

export function LiveTimer({ startedAt, className }: { startedAt: string; className?: string }) {
  const now = useNowSeconds()
  const elapsed = now === null ? null : now - Math.floor(new Date(startedAt).getTime() / 1000)
  return (
    <span role="timer" aria-label="Длительность тренировки" className={cn('font-mono tabular', className)}>
      {elapsed === null ? '––:––' : formatClock(elapsed)}
    </span>
  )
}
