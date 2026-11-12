'use client'

import { useState } from 'react'
import { makeDayKey, monthGrid } from '@/lib/dates'
import { WORDS, capitalize, countLabel, formatDate, formatWeekday } from '@/lib/format'
import type { WorkoutSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { WorkoutListItem } from '@/components/workout-list-item'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Сетка месяца. Выбор дня — на клиенте, поэтому мгновенный. */
export function MonthCalendar({
  year,
  month,
  todayKey,
  initialDay,
  byDay,
  tz,
}: {
  year: number
  month: number
  todayKey: string
  initialDay: string | null
  byDay: Record<string, WorkoutSummary[]>
  tz: string
}) {
  const [selected, setSelected] = useState<string | null>(initialDay)
  const weeks = monthGrid(year, month)
  const workouts = selected ? (byDay[selected] ?? []) : []

  return (
    <>
      <div className="rounded-3xl border border-border bg-surface p-3">
        <div aria-hidden className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1.5">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {weeks.flat().map((day, i) => {
            if (day === null) return <span key={`empty-${i}`} />
            const key = makeDayKey(year, month, day)
            const count = byDay[key]?.length ?? 0
            const isToday = key === todayKey
            const isSelected = key === selected
            const noon = Date.UTC(year, month - 1, day, 12)
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${formatDate(noon, 'UTC')}${isToday ? ', сегодня' : ''}${count > 0 ? `, ${countLabel(count, WORDS.workouts)}` : ''}`}
                onClick={() => setSelected(key)}
                className="flex aspect-square min-h-11 items-center justify-center"
              >
                <span
                  className={cn(
                    'tabular relative flex size-10 items-center justify-center rounded-full text-[15px] font-medium transition-colors',
                    count > 0 ? 'bg-accent font-semibold text-accent-fg' : isToday ? 'text-fg' : 'text-muted',
                    isToday && count === 0 && 'ring-1 ring-inset ring-fg/50',
                    isSelected && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                  )}
                >
                  {day}
                  {count > 1 ? (
                    <span className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full bg-fg text-[11px] font-bold leading-none text-bg">
                      {count}
                    </span>
                  ) : null}
                  {isToday && count > 0 ? (
                    <span className="absolute -bottom-1.5 size-1 rounded-full bg-fg" />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section aria-live="polite" className="mt-5">
        {selected ? (
          <>
            <h2 className="mb-2 px-1 text-[15px] font-semibold">
              {selectedLabel(selected)}
              {selected === todayKey ? <span className="font-normal text-muted"> · сегодня</span> : null}
            </h2>
            {workouts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {workouts.map((workout) => (
                  <WorkoutListItem key={workout.id} workout={workout} tz={tz} />
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-dashed border-border px-5 py-6 text-center text-[15px] text-muted">
                {selected > todayKey ? 'Этот день ещё впереди' : 'В этот день тренировок не было'}
              </p>
            )}
          </>
        ) : (
          <p className="px-1 text-[15px] text-muted">Нажми на день, чтобы увидеть тренировки.</p>
        )}
      </section>
    </>
  )
}

function selectedLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const noon = Date.UTC(y, m - 1, d, 12)
  return `${capitalize(formatWeekday(noon, 'UTC'))}, ${formatDate(noon, 'UTC')}`
}
