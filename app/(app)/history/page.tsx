import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CalendarDays } from 'lucide-react'
import { listWorkouts } from '@/lib/data'
import { monthParam, zonedParts } from '@/lib/dates'
import { WORDS, countLabel, monthName } from '@/lib/format'
import { getTimeZone } from '@/lib/tz'
import type { WorkoutSummary } from '@/lib/types'
import { PageTitle } from '@/components/page-title'
import { StartWorkoutButton } from '@/components/start-workout-button'
import { buttonClass } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/card'
import { WorkoutListItem } from '@/components/workout-list-item'

export const metadata: Metadata = { title: 'История' }

const PAGE_SIZE = 30
const MAX_ITEMS = 600

export default function HistoryPage({ searchParams }: PageProps<'/history'>) {
  return (
    <>
      <PageTitle title="История" />
      <Suspense fallback={<HistorySkeleton />}>
        <History searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function History({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [query, tz] = await Promise.all([searchParams, getTimeZone()])
  const requested = Number(typeof query.n === 'string' ? query.n : NaN)
  const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, PAGE_SIZE), MAX_ITEMS) : PAGE_SIZE

  const { items, hasMore } = await listWorkouts(limit)

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border px-6 py-10 text-center">
        <p className="text-lg font-semibold">Здесь будет твоя история</p>
        <p className="mx-auto mt-2 max-w-72 text-[15px] leading-relaxed text-muted">
          Каждая сохранённая тренировка появится в этом списке и в календаре.
        </p>
        <StartWorkoutButton className="mt-6" />
      </div>
    )
  }

  // Группы по месяцам, внутри — от новых к старым
  const currentYear = zonedParts(new Date(), tz).year
  const groups: { key: string; title: string; items: WorkoutSummary[] }[] = []
  for (const workout of items) {
    const parts = zonedParts(workout.startedAt, tz)
    const key = monthParam(parts.year, parts.month)
    let group = groups.at(-1)
    if (!group || group.key !== key) {
      group = {
        key,
        title: parts.year === currentYear ? monthName(parts.month) : `${monthName(parts.month)} ${parts.year}`,
        items: [],
      }
      groups.push(group)
    }
    group.items.push(workout)
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, index) => (
        <section key={group.key} aria-label={group.title}>
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {group.title}
              {/* Последняя группа может быть показана не целиком — счётчик был бы неточным */}
              {!(hasMore && index === groups.length - 1) ? (
                <span className="tabular font-medium normal-case tracking-normal">
                  {' · '}
                  {countLabel(group.items.length, WORDS.workouts)}
                </span>
              ) : null}
            </h2>
            <Link
              href={`/calendar?m=${group.key}`}
              aria-label={`${group.title} в календаре`}
              className="-my-2 -mr-2 flex size-10 items-center justify-center rounded-xl text-muted active:bg-surface-2 active:text-fg"
            >
              <CalendarDays className="size-[18px]" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {group.items.map((workout) => (
              <WorkoutListItem key={workout.id} workout={workout} tz={tz} />
            ))}
          </div>
        </section>
      ))}

      {hasMore && limit < MAX_ITEMS ? (
        <Link
          href={`/history?n=${limit + PAGE_SIZE}`}
          scroll={false}
          replace
          className={buttonClass({ variant: 'secondary', className: 'w-full' })}
        >
          Показать ещё
        </Link>
      ) : null}
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
    </div>
  )
}
