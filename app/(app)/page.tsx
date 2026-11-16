import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChevronRight, Trophy } from 'lucide-react'
import {
  getActiveWorkout,
  getLastCompletedWorkout,
  getProfile,
  getRecentRecords,
  getWorkoutsBetween,
} from '@/lib/data'
import { dayKey, monthRange, zonedParts } from '@/lib/dates'
import {
  WORDS,
  capitalize,
  countLabel,
  formatDate,
  formatDateShort,
  formatDuration,
  formatRelativeDay,
  formatTime,
  formatWeekday,
  formatWeight,
  monthName,
  plural,
} from '@/lib/format'
import { getTimeZone } from '@/lib/tz'
import { ActiveWorkoutCard } from '@/components/active-workout-card'
import { StartWorkoutButton } from '@/components/start-workout-button'
import { Card, Eyebrow, Skeleton } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Главная' }

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  )
}

function greeting(hour: number) {
  if (hour < 5) return 'Доброй ночи'
  if (hour < 12) return 'Доброе утро'
  if (hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

async function Dashboard() {
  const [profile, tz] = await Promise.all([getProfile(), getTimeZone()])
  const now = new Date()
  const today = zonedParts(now, tz)
  const month = monthRange(today.year, today.month, tz)

  const [active, monthWorkouts, last, records] = await Promise.all([
    getActiveWorkout(),
    getWorkoutsBetween(month.start, month.end),
    getLastCompletedWorkout(),
    getRecentRecords(3),
  ])

  const monthSeconds = monthWorkouts.reduce((sum, w) => sum + (w.durationSeconds ?? 0), 0)
  const todayKey = dayKey(now, tz)

  return (
    <div className="flex flex-col gap-4">
      <header className="animate-rise">
        <Eyebrow>
          {formatWeekday(now, tz)}, {formatDate(now, tz)}
        </Eyebrow>
        <h1 className="mt-1 text-[32px] font-semibold leading-[1.1] tracking-tight">
          {greeting(today.hour)},
          <br />
          {profile.displayName}
        </h1>
      </header>

      {active ? (
        <ActiveWorkoutCard
          startedAt={active.startedAt}
          startedLabel={`начало в ${formatTime(active.startedAt, tz)}`}
          exercises={active.exercises.length}
          sets={active.exercises.reduce((n, e) => n + e.sets.length, 0)}
          now={now.getTime()}
        />
      ) : (
        <StartWorkoutButton />
      )}

      <section aria-label="Этот месяц">
        <Eyebrow className="mb-2 mt-2">{monthName(today.month)} · этот месяц</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="tabular text-[40px] font-semibold leading-none tracking-tighter">{monthWorkouts.length}</p>
            <p className="mt-2 text-sm text-muted">{plural(monthWorkouts.length, WORDS.workouts)}</p>
          </Card>
          <Card className="p-4">
            <p className="tabular text-[40px] font-semibold leading-none tracking-tighter">
              <Hours seconds={monthSeconds} />
            </p>
            <p className="mt-2 text-sm text-muted">в зале</p>
          </Card>
        </div>
      </section>

      <section aria-label="Последняя тренировка">
        <Eyebrow className="mb-2 mt-2">Последняя тренировка</Eyebrow>
        {last ? (
          <Link
            href={`/workouts/${last.id}`}
            className="block rounded-3xl border border-border bg-surface p-4 transition-colors active:bg-surface-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold">
                {capitalize(formatRelativeDay(dayKey(last.startedAt, tz), todayKey, formatDate(last.startedAt, tz, now)))}
              </p>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </div>
            <p className="tabular mt-0.5 text-sm text-muted">
              {formatDateShort(last.startedAt, tz)}, {formatTime(last.startedAt, tz)} · {formatDuration(last.durationSeconds)}
            </p>
            {last.splitName ? <p className="mt-3 break-words text-[15px] font-semibold">{last.splitName}</p> : null}
            {last.exercises.length > 0 ? (
              <p className={`${last.splitName ? 'mt-1 text-muted' : 'mt-3'} line-clamp-2 text-[15px] leading-relaxed`}>
                {last.exercises.map((e) => e.name).join(' · ')}
              </p>
            ) : null}
            <p className="tabular mt-3 text-sm text-muted">
              {countLabel(last.exercises.length, WORDS.exercises)} ·{' '}
              {countLabel(last.exercises.reduce((n, e) => n + e.sets.length, 0), WORDS.sets)}
            </p>
          </Link>
        ) : (
          <Card className="p-5 text-[15px] leading-relaxed text-muted">
            Пока нет ни одной тренировки. Начни первую — и здесь появится её краткий итог.
          </Card>
        )}
      </section>

      <section aria-label="Прогресс">
        <Eyebrow className="mb-2 mt-2">Прогресс</Eyebrow>
        {records.length > 0 ? (
          <Card className="divide-y divide-border">
            {records.map((record) => (
              <Link
                key={`${record.workoutId}-${record.exerciseId}`}
                href={`/exercises/${record.exerciseId}`}
                className="flex items-center gap-3 p-4 transition-colors first:rounded-t-3xl last:rounded-b-3xl active:bg-surface-2"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
                  <Trophy className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{record.exerciseName}</span>
                  <span className="tabular block text-sm text-muted">
                    рекорд веса · {formatDateShort(record.startedAt, tz)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-lg font-semibold leading-tight">{formatWeight(record.weight)} кг</span>
                  <span className="tabular block text-sm font-medium text-accent-text">
                    +{formatWeight(record.weight - record.previous)} кг
                  </span>
                </span>
              </Link>
            ))}
          </Card>
        ) : (
          <Card className="flex items-start gap-3 p-5">
            <Trophy className="mt-0.5 size-5 shrink-0 text-muted" />
            <p className="text-[15px] leading-relaxed text-muted">
              Здесь появятся личные рекорды — как только ты возьмёшь вес больше, чем раньше.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}

/** «9 ч 40» крупно: часы и минуты без лишних слов. */
function Hours({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const unit = 'ml-1 mr-1.5 text-lg font-medium tracking-normal text-muted'
  if (h === 0) {
    return (
      <>
        {m}
        <span className={unit}>мин</span>
      </>
    )
  }
  return (
    <>
      {h}
      <span className={unit}>ч</span>
      {m > 0 ? (
        <>
          {m}
          <span className={unit}>мин</span>
        </>
      ) : null}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-24 w-3/4" />
      <Skeleton className="h-16" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-36" />
      <Skeleton className="mt-6 h-24" />
    </div>
  )
}
