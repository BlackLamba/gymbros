import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getWorkoutsBetween } from '@/lib/data'
import { addMonths, dayKey, monthParam, monthRange, parseMonthParam, zonedParts } from '@/lib/dates'
import { WORDS, countLabel, formatDuration, monthName } from '@/lib/format'
import { getTimeZone } from '@/lib/tz'
import type { WorkoutSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MonthCalendar } from '@/components/calendar/month-calendar'
import { Skeleton } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Календарь' }

export default function CalendarPage({ searchParams }: PageProps<'/calendar'>) {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  )
}

async function Calendar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [query, tz] = await Promise.all([searchParams, getTimeZone()])
  const now = new Date()
  const today = zonedParts(now, tz)
  const todayKey = dayKey(now, tz)

  const { year, month } = parseMonthParam(query.m) ?? { year: today.year, month: today.month }
  const isCurrentMonth = year === today.year && month === today.month
  const param = monthParam(year, month)

  const range = monthRange(year, month, tz)
  const workouts = await getWorkoutsBetween(range.start, range.end)

  const byDay: Record<string, WorkoutSummary[]> = {}
  for (const workout of workouts) (byDay[dayKey(workout.startedAt, tz)] ??= []).push(workout)

  const requestedDay = typeof query.d === 'string' && query.d.startsWith(`${param}-`) ? query.d : null
  const initialDay = requestedDay ?? (isCurrentMonth ? todayKey : null)

  const prev = addMonths(year, month, -1)
  const next = addMonths(year, month, 1)
  const totalSeconds = workouts.reduce((sum, w) => sum + (w.durationSeconds ?? 0), 0)
  const navButton =
    'flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-fg transition-colors active:bg-surface-2'

  return (
    <div>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            {monthName(month)} <span className="tabular text-muted">{year}</span>
          </h1>
          <p className="tabular mt-0.5 text-sm text-muted">
            {workouts.length > 0
              ? `${countLabel(workouts.length, WORDS.workouts)} · ${formatDuration(totalSeconds)}`
              : 'Без тренировок'}
          </p>
        </div>
        <nav aria-label="Месяцы" className="flex shrink-0 items-center gap-2">
          {!isCurrentMonth ? (
            <Link href="/calendar" className="flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-accent-text active:bg-surface-2">
              Сегодня
            </Link>
          ) : null}
          <Link href={`/calendar?m=${monthParam(prev.year, prev.month)}`} aria-label="Предыдущий месяц" className={navButton}>
            <ChevronLeft className="size-5" />
          </Link>
          <Link
            href={`/calendar?m=${monthParam(next.year, next.month)}`}
            aria-label="Следующий месяц"
            className={cn(navButton)}
          >
            <ChevronRight className="size-5" />
          </Link>
        </nav>
      </header>

      <MonthCalendar
        key={`${param}:${requestedDay ?? ''}`}
        year={year}
        month={month}
        todayKey={todayKey}
        initialDay={initialDay}
        byDay={byDay}
        tz={tz}
      />
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div aria-busy>
      <Skeleton className="mb-4 h-14 w-1/2" />
      <Skeleton className="h-[21rem]" />
      <Skeleton className="mt-5 h-20" />
    </div>
  )
}
