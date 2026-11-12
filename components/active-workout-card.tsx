import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { countLabel, WORDS } from '@/lib/format'
import { LiveTimer } from '@/components/workout/live-timer'

const STALE_AFTER_MS = 6 * 3600 * 1000

/** Карточка на главной: идёт тренировка — её можно продолжить в одно нажатие. */
export function ActiveWorkoutCard({
  startedAt,
  startedLabel,
  exercises,
  sets,
  now,
}: {
  startedAt: string
  startedLabel: string
  exercises: number
  sets: number
  now: number
}) {
  const stale = now - new Date(startedAt).getTime() > STALE_AFTER_MS
  return (
    <Link
      href="/workout"
      className="block rounded-3xl bg-accent p-5 text-accent-fg transition-transform duration-150 active:scale-[0.99]"
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
        <span className="size-2 animate-pulse-dot rounded-full bg-accent-fg" />
        Тренировка идёт
      </div>
      <LiveTimer startedAt={startedAt} className="mt-2 block text-[52px] font-semibold leading-none tracking-tighter" />
      <p className="tabular mt-2 text-sm font-medium opacity-75">
        {startedLabel}
        {exercises > 0 ? ` · ${countLabel(exercises, WORDS.exercises)} · ${countLabel(sets, WORDS.sets)}` : ''}
      </p>
      {stale ? (
        <p className="mt-2 text-sm font-medium leading-snug opacity-75">
          Похоже, её забыли завершить. Нажми «Завершить» — время окончания можно будет поправить.
        </p>
      ) : null}
      <div className="mt-5 flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent-fg text-base font-semibold text-accent">
        Продолжить тренировку
        <ArrowRight className="size-5" />
      </div>
    </Link>
  )
}
