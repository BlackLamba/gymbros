import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getFriendName, listFriendWorkouts } from '@/lib/data'
import { monthParam, zonedParts } from '@/lib/dates'
import { WORDS, countLabel, monthName } from '@/lib/format'
import { getTimeZone } from '@/lib/tz'
import type { WorkoutSummary } from '@/lib/types'
import { PageTitle } from '@/components/page-title'
import { buttonClass } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/card'
import { WorkoutListItem } from '@/components/workout-list-item'

export const metadata: Metadata = { title: 'Тренировки друга' }

const PAGE_SIZE = 30
const MAX_ITEMS = 600

/** Сохранённые тренировки второго пользователя — только просмотр. */
export default function FriendPage({ searchParams }: PageProps<'/friend'>) {
  return (
    <Suspense fallback={<FriendSkeleton />}>
      <FriendWorkouts searchParams={searchParams} />
    </Suspense>
  )
}

async function FriendWorkouts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [query, tz, friendName] = await Promise.all([searchParams, getTimeZone(), getFriendName()])
  const back = { href: '/profile', label: 'Профиль' }

  if (!friendName) {
    return (
      <>
        <PageTitle back={back} title="Тренировки друга" />
        <p className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-[15px] leading-relaxed text-muted">
          Второй аккаунт ещё не создан. Когда он появится, здесь будут его тренировки.
        </p>
      </>
    )
  }

  const requested = Number(typeof query.n === 'string' ? query.n : NaN)
  const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, PAGE_SIZE), MAX_ITEMS) : PAGE_SIZE
  const { items, hasMore } = await listFriendWorkouts(limit)

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
    <>
      <PageTitle back={back} eyebrow="Только просмотр" title={`Тренировки: ${friendName}`} />

      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border px-6 py-10 text-center text-[15px] leading-relaxed text-muted">
          Здесь появятся сохранённые тренировки, как только {friendName} запишет первую.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group, index) => (
            <section key={group.key} aria-label={group.title}>
              <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {group.title}
                {/* Последняя группа может быть показана не целиком — счётчик был бы неточным */}
                {!(hasMore && index === groups.length - 1) ? (
                  <span className="tabular font-medium normal-case tracking-normal">
                    {' · '}
                    {countLabel(group.items.length, WORDS.workouts)}
                  </span>
                ) : null}
              </h2>
              <div className="flex flex-col gap-2">
                {group.items.map((workout) => (
                  <WorkoutListItem key={workout.id} workout={workout} tz={tz} href={`/friend/${workout.id}`} />
                ))}
              </div>
            </section>
          ))}

          {hasMore && limit < MAX_ITEMS ? (
            <Link
              href={`/friend?n=${limit + PAGE_SIZE}`}
              scroll={false}
              replace
              className={buttonClass({ variant: 'secondary', className: 'w-full' })}
            >
              Показать ещё
            </Link>
          ) : null}
        </div>
      )}
    </>
  )
}

function FriendSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      <Skeleton className="mb-4 h-20 w-2/3" />
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
    </div>
  )
}
