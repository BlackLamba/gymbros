import { cn } from '@/lib/utils'

/** Плитка «значение + подпись»: главные герои интерфейса — цифры. */
export function StatTile({
  label,
  value,
  accent = false,
  className,
}: {
  label: string
  value: string
  accent?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-border bg-surface px-3 py-3', className)}>
      <p className={cn('tabular truncate text-xl font-semibold tracking-tight', accent && 'text-accent-text')}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{label}</p>
    </div>
  )
}
