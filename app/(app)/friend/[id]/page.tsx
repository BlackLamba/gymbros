import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getFriendName, getFriendWorkout } from '@/lib/data'
import { dayKey } from '@/lib/dates'
import {
  WORDS,
  capitalize,
  formatDate,
  formatDateShort,
  formatDuration,
  formatNumber,
  formatSet,
  formatTime,
  formatWeekday,
  plural,
} from '@/lib/format'
import { volumeOf } from '@/lib/progress/insights'
import { getTimeZone } from '@/lib/tz'
import { isUuid } from '@/lib/utils'
import { PageTitle } from '@/components/page-title'
import { StatTile } from '@/components/stat-tile'
import { Card, Eyebrow, Skeleton } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Тренировка друга' }

/** Тренировка второго пользователя: только просмотр, без правки, удаления и сравнений. */
export default function FriendWorkoutPage({ params }: PageProps<'/friend/[id]'>) {
  return (
    <Suspense fallback={<FriendWorkoutSkeleton />}>
      <FriendWorkout params={params} />
    </Suspense>
  )
}

async function FriendWorkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [workout, friendName, tz] = await Promise.all([getFriendWorkout(id), getFriendName(), getTimeZone()])
  if (!workout) notFound()

  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  const reps = workout.exercises.reduce((n, e) => n + e.sets.reduce((r, s) => r + s.reps, 0), 0)
  const volume = workout.exercises.reduce((n, e) => n + volumeOf(e.sets), 0)
  const sameDay = workout.finishedAt ? dayKey(workout.finishedAt, tz) === dayKey(workout.startedAt, tz) : true
  const weekday = capitalize(formatWeekday(workout.startedAt, tz))

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        back={{ href: '/friend', label: friendName ? `Тренировки: ${friendName}` : 'Тренировки друга' }}
        eyebrow={workout.splitName ? `${weekday} · ${workout.splitName}` : weekday}
        title={formatDate(workout.startedAt, tz)}
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

      <section aria-label="Упражнения">
        <Eyebrow className="mb-2 mt-2">Упражнения</Eyebrow>
        {workout.exercises.length === 0 ? (
          <Card className="p-5 text-[15px] text-muted">В этой тренировке нет упражнений.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {workout.exercises.map((exercise, index) => (
              <Card key={exercise.id} className="p-4">
                <h2 className="text-[17px] font-semibold leading-snug">
                  <span className="tabular mr-2 text-muted">{index + 1}</span>
                  {exercise.name}
                </h2>
                {exercise.sets.length > 0 ? (
                  <ol className="mt-3 flex flex-col">
                    {exercise.sets.map((set, n) => (
                      <li
                        key={n}
                        className="tabular flex h-10 items-center gap-3 border-t border-border text-[15px] first:border-t-0"
                      >
                        <span className="w-5 text-center text-sm text-muted">{n + 1}</span>
                        <span className="font-medium">{formatSet(set.weight, set.reps)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-muted">Без подходов</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FriendWorkoutSkeleton() {
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
