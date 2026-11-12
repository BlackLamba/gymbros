import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronRight } from 'lucide-react'
import { getExercise, getExerciseStats, getProgressContext } from '@/lib/data'
import { WORDS, countLabel, formatDate, formatNumber, formatWeight, plural } from '@/lib/format'
import { recordsFromContext } from '@/lib/progress/insights'
import { getTimeZone } from '@/lib/tz'
import { isUuid } from '@/lib/utils'
import { PageTitle } from '@/components/page-title'
import { ExerciseChart } from '@/components/progress/exercise-chart'
import { StatTile } from '@/components/stat-tile'
import { Card, Eyebrow, Skeleton } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Упражнение' }

const HISTORY_ROWS = 12
const REPS_ROWS = 8

export default function ExercisePage({ params }: PageProps<'/exercises/[id]'>) {
  return (
    <Suspense fallback={<ExerciseSkeleton />}>
      <ExerciseProgress params={params} />
    </Suspense>
  )
}

async function ExerciseProgress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [exercise, tz] = await Promise.all([getExercise(id), getTimeZone()])
  if (!exercise) notFound()

  // Только сохранённые (завершённые) тренировки
  const [points, contexts] = await Promise.all([getExerciseStats(id, 500), getProgressContext([id])])
  const context = contexts[id]
  const records = recordsFromContext(context)

  const header = <PageTitle back={{ href: '/profile', label: 'Мои упражнения' }} eyebrow="Упражнение" title={exercise.name} />

  if (!records || !context || points.length === 0) {
    return (
      <>
        {header}
        <p className="rounded-3xl border border-dashed border-border px-5 py-8 text-center text-[15px] leading-relaxed text-muted">
          Пока нет сохранённых тренировок с этим упражнением. После первой здесь появятся рекорды и динамика.
        </p>
      </>
    )
  }

  const totalSets = points.reduce((n, p) => n + p.setsCount, 0)
  const totalReps = points.reduce((n, p) => n + p.totalReps, 0)
  const totalVolume = points.reduce((n, p) => n + p.volume, 0)
  const repsByWeight = [...context.repsByWeight].sort((a, b) => b.weight - a.weight)
  const recent = [...points].reverse().slice(0, HISTORY_ROWS)

  return (
    <div className="flex flex-col gap-4">
      {header}

      <section aria-label="Рекорды" className="-mt-1">
        <Eyebrow className="mb-2">Личные рекорды</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          {records.weighted ? (
            <>
              <Card className="p-4">
                <p className="tabular text-[34px] font-semibold leading-none tracking-tighter">
                  {formatWeight(records.maxWeight)}
                  <span className="ml-1 text-lg font-medium tracking-normal text-muted">кг</span>
                </p>
                <p className="mt-2 text-sm leading-snug text-muted">
                  максимальный вес
                  {records.repsAtMaxWeight ? ` · на ${countLabel(records.repsAtMaxWeight, WORDS.reps)}` : ''}
                </p>
              </Card>
              <Card className="p-4">
                <p className="tabular text-[34px] font-semibold leading-none tracking-tighter">
                  {formatNumber(records.maxVolume)}
                  <span className="ml-1 text-lg font-medium tracking-normal text-muted">кг</span>
                </p>
                <p className="mt-2 text-sm leading-snug text-muted">лучший объём за тренировку</p>
              </Card>
            </>
          ) : (
            <Card className="col-span-2 p-4">
              <p className="tabular text-[34px] font-semibold leading-none tracking-tighter">{records.bestReps}</p>
              <p className="mt-2 text-sm leading-snug text-muted">
                {plural(records.bestReps, WORDS.reps)} — лучший подход
              </p>
            </Card>
          )}
        </div>
      </section>

      <section aria-label="Всего">
        <Eyebrow className="mb-2 mt-2">За всё время</Eyebrow>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={plural(points.length, WORDS.workouts)} value={formatNumber(points.length)} />
          <StatTile label={plural(totalSets, WORDS.sets)} value={formatNumber(totalSets)} />
          <StatTile label={plural(totalReps, WORDS.reps)} value={formatNumber(totalReps)} />
          <StatTile label="объём, кг" value={totalVolume > 0 ? formatNumber(totalVolume) : '—'} />
        </div>
      </section>

      <section aria-label="Динамика">
        <Eyebrow className="mb-2 mt-2">Динамика</Eyebrow>
        <ExerciseChart points={points} weighted={records.weighted} tz={tz} />
      </section>

      {records.weighted && repsByWeight.length > 0 ? (
        <section aria-label="Максимум повторений на весе">
          <Eyebrow className="mb-2 mt-2">Максимум повторений на весе</Eyebrow>
          <Card className="divide-y divide-border px-4">
            {repsByWeight.slice(0, REPS_ROWS).map((row) => (
              <div key={row.weight} className="tabular flex h-12 items-center justify-between text-[15px]">
                <span className="font-medium">{row.weight > 0 ? `${formatWeight(row.weight)} кг` : 'Без веса'}</span>
                <span className="text-muted">
                  <span className="font-semibold text-fg">{row.maxReps}</span> {plural(row.maxReps, WORDS.reps)}
                </span>
              </div>
            ))}
          </Card>
          {repsByWeight.length > REPS_ROWS ? (
            <p className="mt-2 px-1 text-xs text-muted">Показаны {REPS_ROWS} самых тяжёлых весов.</p>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Тренировки">
        <Eyebrow className="mb-2 mt-2">Последние тренировки</Eyebrow>
        <Card className="divide-y divide-border">
          {recent.map((point) => (
            <Link
              key={point.workoutId}
              href={`/workouts/${point.workoutId}`}
              className="flex items-center gap-3 p-4 transition-colors first:rounded-t-3xl last:rounded-b-3xl active:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{formatDate(point.startedAt, tz)}</span>
                <span className="tabular block text-sm leading-snug text-muted">
                  {countLabel(point.setsCount, WORDS.sets)} · {point.totalReps} повт.
                </span>
              </span>
              {point.topWeight > 0 ? (
                <span className="tabular shrink-0 text-[15px] font-semibold">до {formatWeight(point.topWeight)} кг</span>
              ) : null}
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Link>
          ))}
        </Card>
      </section>
    </div>
  )
}

function ExerciseSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-24 w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-64" />
    </div>
  )
}
