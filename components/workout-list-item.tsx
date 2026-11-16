import Link from 'next/link'
import { WORDS, countLabel, formatDuration, formatTime, formatWeekdayShort } from '@/lib/format'
import { zonedParts } from '@/lib/dates'
import type { WorkoutSummary } from '@/lib/types'

/** Строка тренировки в истории и календаре. */
export function WorkoutListItem({
  workout,
  tz,
  href = `/workouts/${workout.id}`,
}: {
  workout: WorkoutSummary
  tz: string
  /** По умолчанию — своя тренировка; для тренировки друга передаётся другой адрес */
  href?: string
}) {
  const day = zonedParts(workout.startedAt, tz).day
  const names = workout.exerciseNames
  const shown = names.slice(0, 3).join(', ')
  const rest = names.length - 3

  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-3xl border border-border bg-surface p-4 transition-colors active:bg-surface-2"
    >
      <div className="flex w-11 shrink-0 flex-col items-center">
        <span className="tabular text-2xl font-semibold leading-none tracking-tight">{day}</span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {formatWeekdayShort(workout.startedAt, tz)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {workout.splitName ? (
          <p className="truncate font-semibold">{workout.splitName}</p>
        ) : (
          <p className="truncate font-medium">
            {names.length > 0 ? shown : 'Без упражнений'}
            {rest > 0 ? <span className="text-muted"> +{rest}</span> : null}
          </p>
        )}
        <p className="tabular mt-0.5 text-sm leading-snug text-muted">
          {formatTime(workout.startedAt, tz)} · {formatDuration(workout.durationSeconds)} ·{' '}
          {countLabel(workout.setsCount, WORDS.sets)}
        </p>
      </div>
    </Link>
  )
}
