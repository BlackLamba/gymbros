import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CalendarDays, Check, Pencil, Sparkles, TrendingUp, Trophy } from 'lucide-react'
import { getPreviousDuration, getProgressContext, getWorkout } from '@/lib/data'
import { dayKey, monthParam, zonedParts } from '@/lib/dates'
import {
  WORDS,
  capitalize,
  formatDate,
  formatDateShort,
  formatDuration,
  formatNumber,
  formatSet,
  formatSetCompact,
  formatTime,
  formatWeekday,
  plural,
} from '@/lib/format'
import { type Insight, analyzeWorkout, volumeOf } from '@/lib/progress/insights'
import { getTimeZone } from '@/lib/tz'
import { cn, isUuid } from '@/lib/utils'
import { DeleteWorkoutButton } from '@/components/delete-workout-button'
import { PageTitle } from '@/components/page-title'
import { StatTile } from '@/components/stat-tile'
import { buttonClass } from '@/components/ui/button'
import { Card, Eyebrow, Skeleton } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Тренировка' }

export default function WorkoutPage({ params, searchParams }: PageProps<'/workouts/[id]'>) {
  return (
    <Suspense fallback={<WorkoutSkeleton />}>
      <WorkoutDetails params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function WorkoutDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  if (!isUuid(id)) notFound()

  const [workout, tz] = await Promise.all([getWorkout(id), getTimeZone()])
  if (!workout) notFound()
  if (workout.status === 'active') redirect('/workout')

  // Сравниваем только с тем, что было сохранено ДО этой тренировки
  const exerciseIds = workout.exercises.map((e) => e.exerciseId).filter((v): v is string => v !== null)
  const [contexts, previousDuration] = await Promise.all([
    getProgressContext(exerciseIds, workout.startedAt),
    getPreviousDuration(workout.startedAt),
  ])
  const analysis = analyzeWorkout({
    exercises: workout.exercises,
    contexts,
    durationSeconds: workout.durationSeconds,
    previousDurationSeconds: previousDuration,
  })

  const justFinished = query.done === '1'
  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  const reps = workout.exercises.reduce((n, e) => n + e.sets.reduce((r, s) => r + s.reps, 0), 0)
  const volume = workout.exercises.reduce((n, e) => n + volumeOf(e.sets), 0)
  const started = zonedParts(workout.startedAt, tz)
  const dateLabel = formatDate(workout.startedAt, tz)
  const sameDay = workout.finishedAt ? dayKey(workout.finishedAt, tz) === dayKey(workout.startedAt, tz) : true

  return (
    <div className="flex flex-col gap-4">
      {justFinished ? (
        <div className="flex animate-rise items-center gap-3 rounded-3xl bg-accent p-4 text-accent-fg">
          <span className="flex size-10 shrink-0 animate-pop items-center justify-center rounded-full bg-accent-fg text-accent">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div>
            <p className="text-lg font-semibold leading-tight">Тренировка сохранена</p>
            <p className="text-sm font-medium opacity-75">Хорошая работа. Вот что получилось.</p>
          </div>
        </div>
      ) : null}

      <PageTitle
        back={justFinished ? { href: '/', label: 'На главную' } : { href: '/history', label: 'История' }}
        eyebrow={
          workout.splitName
            ? `${capitalize(formatWeekday(workout.startedAt, tz))} · ${workout.splitName}`
            : capitalize(formatWeekday(workout.startedAt, tz))
        }
        title={dateLabel}
      />

      <div className="-mt-3 flex flex-col gap-3">
        <Card className="flex items-end justify-between gap-3 p-4">
          <p className="tabular text-[34px] font-semibold leading-none tracking-tighter">
            {formatDuration(workout.durationSeconds)}
          </p>
          <p className="tabular text-right text-sm text-muted">
            {formatTime(workout.startedAt, tz)} —{' '}
            {workout.finishedAt
              ? `${sameDay ? '' : `${formatDateShort(workout.finishedAt, tz)}, `}${formatTime(workout.finishedAt, tz)}`
              : '…'}
          </p>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={plural(workout.exercises.length, WORDS.exercises)} value={String(workout.exercises.length)} />
          <StatTile label={plural(sets, WORDS.sets)} value={String(sets)} />
          <StatTile label={plural(reps, WORDS.reps)} value={formatNumber(reps)} />
          <StatTile label="объём, кг" value={volume > 0 ? formatNumber(volume) : '—'} />
        </div>
      </div>

      {analysis.insights.length > 0 ? (
        <section aria-label="Прогресс">
          <Eyebrow className="mb-2 mt-2">Прогресс</Eyebrow>
          <Card className="divide-y divide-border">
            {analysis.insights.map((insight, i) => (
              <InsightRow key={i} insight={insight} />
            ))}
          </Card>
        </section>
      ) : null}

      <section aria-label="Упражнения">
        <Eyebrow className="mb-2 mt-2">Упражнения</Eyebrow>
        {workout.exercises.length === 0 ? (
          <Card className="p-5 text-[15px] text-muted">В этой тренировке нет упражнений.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {workout.exercises.map((exercise, index) => {
              const info = analysis.exercises[index]
              const title = (
                <>
                  <span className="tabular mr-2 text-muted">{index + 1}</span>
                  {exercise.name}
                </>
              )
              return (
                <Card key={exercise.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-[17px] font-semibold leading-snug">
                      {exercise.exerciseId ? (
                        <Link href={`/exercises/${exercise.exerciseId}`} className="active:opacity-70">
                          {title}
                        </Link>
                      ) : (
                        title
                      )}
                    </h2>
                    {exercise.exerciseId ? (
                      <Link
                        href={`/exercises/${exercise.exerciseId}`}
                        aria-label={`Динамика: ${exercise.name}`}
                        className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-xl text-muted active:bg-surface-2"
                      >
                        <TrendingUp className="size-5" />
                      </Link>
                    ) : null}
                  </div>

                  {exercise.sets.length > 0 ? (
                    <ol className="mt-3 flex flex-col">
                      {exercise.sets.map((set, n) => {
                        const record = info?.recordSets.includes(n)
                        return (
                          <li
                            key={n}
                            className="tabular flex h-10 items-center gap-3 border-t border-border text-[15px] first:border-t-0"
                          >
                            <span className="w-5 text-center text-sm text-muted">{n + 1}</span>
                            <span className={cn('font-medium', record && 'text-accent-text')}>
                              {formatSet(set.weight, set.reps)}
                            </span>
                            {record ? (
                              <span className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-accent-text">
                                <Trophy className="size-3.5" />
                                рекорд
                              </span>
                            ) : null}
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Без подходов</p>
                  )}

                  {info?.state === 'compared' && info.previous ? (
                    <p className="tabular mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-muted">
                      В прошлый раз, {formatDateShort(info.previous.startedAt, tz)}:{' '}
                      {info.previous.sets.map((s) => formatSetCompact(s.weight, s.reps)).join(' · ')}
                    </p>
                  ) : info?.state === 'first' ? (
                    <p className="mt-3 border-t border-border pt-3 text-[13px] text-muted">
                      Первая запись — точка отсчёта для сравнения
                    </p>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <div className="mt-2 flex gap-3">
        <Link href={`/workouts/${workout.id}/edit`} className={buttonClass({ variant: 'secondary', className: 'flex-1' })}>
          <Pencil className="size-[18px]" />
          Изменить
        </Link>
        <DeleteWorkoutButton workoutId={workout.id} label={`за ${dateLabel}`} />
      </div>
      <Link
        href={`/calendar?m=${monthParam(started.year, started.month)}&d=${dayKey(workout.startedAt, tz)}`}
        className="mx-auto flex h-11 items-center gap-2 px-3 text-sm font-medium text-muted active:text-fg"
      >
        <CalendarDays className="size-4" />
        Показать в календаре
      </Link>
    </div>
  )
}

function InsightRow({ insight }: { insight: Insight }) {
  const Icon = insight.tone === 'record' ? Trophy : insight.tone === 'better' ? TrendingUp : Sparkles
  return (
    <div className="flex items-start gap-3 p-4">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          insight.tone === 'record' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg',
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{insight.label}</p>
        <p className="mt-0.5 text-[15px] leading-snug">{insight.text}</p>
      </div>
    </div>
  )
}

function WorkoutSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-20 w-2/3" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-44" />
      <Skeleton className="h-44" />
    </div>
  )
}
