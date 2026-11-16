'use client'

import { useMemo, useState } from 'react'
import { Check, ListChecks, LoaderCircle, Plus, Search } from 'lucide-react'
import { formatDateShort, formatSet } from '@/lib/format'
import type { Exercise, ExerciseContext, Split } from '@/lib/types'
import { MAX_EXERCISES_IN_LIBRARY } from '@/lib/validation'
import { Sheet } from '@/components/ui/dialog'

const normalize = (s: string) => s.trim().toLocaleLowerCase('ru')

export function ExercisePicker({
  open,
  onOpenChange,
  library,
  contexts,
  usedIds,
  tz,
  splits = [],
  onPickSplit,
  onPick,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  library: Exercise[]
  contexts: Record<string, ExerciseContext>
  usedIds: Set<string>
  tz: string
  /** Сплиты, которые можно добавить в тренировку целиком */
  splits?: Split[]
  onPickSplit?: (split: Split) => void
  onPick: (exercise: Exercise) => void
  /** Создаёт упражнение в личном списке; возвращает false, если не получилось */
  onCreate: (name: string) => Promise<boolean>
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery('')
    onOpenChange(next)
  }

  // Недавно выполнявшиеся — выше; остальные по алфавиту
  const sorted = useMemo(() => {
    return [...library].sort((a, b) => {
      const la = contexts[a.id]?.last.startedAt ?? ''
      const lb = contexts[b.id]?.last.startedAt ?? ''
      if (la !== lb) return la > lb ? -1 : 1
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [library, contexts])

  const q = normalize(query)
  const filtered = q ? sorted.filter((e) => normalize(e.name).includes(q)) : sorted
  const exact = library.some((e) => normalize(e.name) === q)
  const canCreate = q.length > 0 && !exact
  const full = library.length >= MAX_EXERCISES_IN_LIBRARY

  const create = async () => {
    if (creating || !canCreate || full) return
    setCreating(true)
    const ok = await onCreate(query.trim())
    setCreating(false)
    if (ok) setQuery('')
  }

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Упражнение"
      description={`В твоём списке ${library.length} из ${MAX_EXERCISES_IN_LIBRARY}`}
    >
      <form
        className="shrink-0 px-5 pb-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (filtered.length === 1 && !canCreate) onPick(filtered[0])
          else void create()
        }}
      >
        <label className="flex h-12 items-center gap-2.5 rounded-2xl bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-accent-text">
          <Search className="size-[18px] shrink-0 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 60))}
            placeholder="Найти или добавить новое"
            aria-label="Найти или добавить упражнение"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted/70"
          />
        </label>
      </form>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {!q && splits.length > 0 && onPickSplit ? (
          <li className="px-2 pb-2">
            <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Сплит целиком</p>
            <div className="flex flex-wrap gap-2">
              {splits.map((split) => (
                <button
                  key={split.id}
                  type="button"
                  onClick={() => onPickSplit(split)}
                  className="flex h-11 max-w-full items-center gap-2 rounded-xl bg-surface-2 px-3.5 text-[15px] font-semibold transition-colors active:bg-border"
                >
                  <ListChecks className="size-4 shrink-0 text-accent-text" />
                  <span className="truncate">{split.name}</span>
                </button>
              ))}
            </div>
          </li>
        ) : null}

        {canCreate ? (
          <li>
            <button
              type="button"
              disabled={creating || full}
              onClick={create}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors active:bg-surface-2 disabled:opacity-60"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
                {creating ? <LoaderCircle className="size-5 animate-spin" /> : <Plus className="size-5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">Добавить «{query.trim()}»</span>
                <span className="block text-sm text-muted">
                  {full ? `В списке уже ${MAX_EXERCISES_IN_LIBRARY} упражнений — это максимум` : 'Новое упражнение в мой список'}
                </span>
              </span>
            </button>
          </li>
        ) : null}

        {filtered.map((exercise) => {
          const last = contexts[exercise.id]?.last
          const top = last?.sets.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best), last.sets[0])
          const used = usedIds.has(exercise.id)
          return (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onPick(exercise)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{exercise.name}</span>
                  <span className="tabular block truncate text-sm text-muted">
                    {last && top ? `${formatDateShort(last.startedAt, tz)} · ${formatSet(top.weight, top.reps)}` : 'ещё не выполнялось'}
                  </span>
                </span>
                {used ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-text">
                    <Check className="size-4" /> в тренировке
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}

        {library.length === 0 && !canCreate ? (
          <li className="px-3 py-8 text-center text-[15px] leading-relaxed text-muted">
            Список пока пуст. Введи название упражнения — оно сохранится, и в следующий раз его можно будет выбрать одним
            нажатием.
          </li>
        ) : null}
        {library.length > 0 && filtered.length === 0 && !canCreate ? (
          <li className="px-3 py-8 text-center text-[15px] text-muted">Ничего не найдено</li>
        ) : null}
      </ul>
    </Sheet>
  )
}
