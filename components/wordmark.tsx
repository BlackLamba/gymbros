import { cn } from '@/lib/utils'

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-xl font-bold uppercase tracking-tight', className)}>
      Gymbro<span className="text-accent-text">’</span>s
    </span>
  )
}
