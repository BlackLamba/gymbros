'use client'

import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { toLocalInputValue } from '@/lib/dates'
import { WORDS, capitalize, formatDate, formatDuration, formatSet, formatTime, formatWeekday, plural } from '@/lib/format'
import { type EditorExercise, toSetValue, totalsOf } from '@/lib/workout-editor'
import { Button } from '@/components/ui/button'
import { Card, Eyebrow } from '@/components/ui/card'
import { inputClass } from '@/components/ui/field'
import { StatTile } from '@/components/stat-tile'

const LONG_WORKOUT_SECONDS = 4 * 3600

/** Экран итогов перед сохранением. До подтверждения тренировка остаётся активной. */
export function FinishSummary({
  exercises,
  startedAt,
  finishAt,
  tz,
  pending,
  onFinishAtChange,
  onBack,
  onConfirm,
}: {
  exercises: EditorExercise[]
  startedAt: string
  finishAt: number
  tz: string
  pending: boolean
  onFinishAtChange: (value: number) => void
  onBack: () => void
  onConfirm: () => void
}) {
  const totals = totalsOf(exercises)
  const startMs = new Date(startedAt).getTime()
  const duration = Math.max(0, Math.round((finishAt - startMs) / 1000))
  const filled = exercises
    .map((e) => ({ id: e.id, name: e.name, sets: e.sets.map(toSetValue).filter((s) => s !== null) }))
    .filter((e) => e.sets.length > 0)

  return (
    <div className="animate-fade-in px-4 pb-[calc(env(safe-area-inset-bottom)+10.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <Eyebrow>Итоги тренировки</Eyebrow>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
        {capitalize(formatWeekday(startedAt, tz))}, {formatDate(startedAt, tz)}
      </h1>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="Длительность" value={formatDuration(duration)} accent className="col-span-2 sm:col-span-1" />
        <StatTile label="Начало" value={formatTime(startedAt, tz)} />
        <StatTile label="Окончание" value={formatTime(finishAt, tz)} />
        <StatTile label={capitalize(plural(totals.exercises, WORDS.exercises))} value={String(totals.exercises)} />
        <StatTile label={capitalize(plural(totals.sets, WORDS.sets))} value={String(totals.sets)} />
        <StatTile
          label={capitalize(plural(totals.reps, WORDS.reps))}
          value={String(totals.reps)}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-muted">Время окончания</span>
        <input
          type="datetime-local"
          className={`${inputClass} mt-1.5`}
          value={toLocalInputValue(finishAt)}
          min={toLocalInputValue(startMs)}
          onChange={(e) => {
            const value = new Date(e.target.value).getTime()
            if (Number.isNaN(value)) return
            onFinishAtChange(Math.min(Date.now(), Math.max(startMs, value)))
          }}
        />
        {duration > LONG_WORKOUT_SECONDS ? (
          <span className="mt-1.5 block text-sm leading-relaxed text-muted">
            Тренировка идёт больше четырёх часов. Если забыл завершить её вовремя — поправь время окончания.
          </span>
        ) : null}
      </label>

      {totals.incompleteSets > 0 ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-surface-2 p-4 text-[15px] leading-relaxed">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent-text" />
          <p>
            {totals.incompleteSets} {plural(totals.incompleteSets, ['подход', 'подхода', 'подходов'])} без повторений не{' '}
            {totals.incompleteSets === 1 ? 'попадёт' : 'попадут'} в запись. Вернись к тренировке, чтобы дозаполнить.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        {filled.map((exercise, i) => (
          <Card key={exercise.id} className="p-4">
            <p className="font-semibold">
              <span className="tabular mr-2 text-muted">{i + 1}</span>
              {exercise.name}
            </p>
            <ol className="mt-2 flex flex-col gap-1">
              {exercise.sets.map((set, n) => (
                <li key={n} className="tabular flex gap-3 text-[15px]">
                  <span className="w-4 text-right text-muted">{n + 1}</span>
                  <span>{formatSet(set.weight, set.reps)}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          <Button size="lg" className="w-full" disabled={pending} onClick={onConfirm}>
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
            Сохранить тренировку
          </Button>
          <Button variant="ghost" className="w-full" disabled={pending} onClick={onBack}>
            Вернуться к тренировке
          </Button>
        </div>
      </div>
    </div>
  )
}
