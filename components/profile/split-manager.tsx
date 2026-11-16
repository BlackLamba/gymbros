'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ChevronDown, LoaderCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { createExercise, deleteSplit, saveSplit } from '@/lib/actions'
import { WORDS, countLabel } from '@/lib/format'
import type { Exercise, Split } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MAX_EXERCISES_IN_LIBRARY, MAX_SPLITS, MAX_SPLIT_NAME } from '@/lib/validation'
import { move } from '@/lib/workout-editor'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog, Sheet } from '@/components/ui/dialog'
import { inputClass } from '@/components/ui/field'

const normalize = (s: string) => s.trim().toLocaleLowerCase('ru')
const NETWORK_ERROR = 'Нет связи с сервером. Попробуй ещё раз.'

type Editing = { mode: 'create' } | { mode: 'edit'; split: Split }

/**
 * Сплиты: именованные списки упражнений, которые можно целиком загрузить в тренировку.
 * В профиле каждый сплит занимает одну строку и раскрывается по нажатию;
 * создание и правка — в нижней шторке.
 */
export function SplitManager({ splits, exercises }: { splits: Split[]; exercises: Exercise[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [removing, setRemoving] = useState<Split | null>(null)
  const [pending, setPending] = useState(false)
  const full = splits.length >= MAX_SPLITS

  const remove = async () => {
    if (!removing) return
    setPending(true)
    try {
      const result = await deleteSplit(removing.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Сплит удалён')
      setRemoving(null)
    } catch {
      toast.error(NETWORK_ERROR)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {splits.length > 0 ? (
        <Card className="divide-y divide-border overflow-hidden">
          {splits.map((split) => {
            const open = openId === split.id
            const panelId = `split-${split.id}`
            return (
              <div key={split.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : split.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[17px] font-semibold leading-snug">{split.name}</span>
                    <span className="tabular mt-0.5 block text-sm text-muted">
                      {split.exercises.length > 0 ? countLabel(split.exercises.length, WORDS.exercises) : 'пока без упражнений'}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn('size-5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
                  />
                </button>

                {open ? (
                  <div id={panelId} className="animate-rise px-4 pb-4">
                    {split.exercises.length > 0 ? (
                      <ol className="flex flex-col gap-1.5 border-t border-border pt-3">
                        {split.exercises.map((exercise, index) => (
                          <li key={exercise.id} className="flex gap-3 text-[15px] leading-snug">
                            <span className="tabular w-5 shrink-0 text-right text-muted">{index + 1}</span>
                            <span className="min-w-0 break-words">{exercise.name}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="border-t border-border pt-3 text-[15px] leading-relaxed text-muted">
                        В этом сплите не осталось упражнений. Добавь их через «Изменить».
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-11 flex-1"
                        onClick={() => setEditing({ mode: 'edit', split })}
                      >
                        <Pencil className="size-4" />
                        Изменить
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-11 w-12 px-0 text-danger"
                        aria-label={`Удалить сплит «${split.name}»`}
                        onClick={() => setRemoving(split)}
                      >
                        <Trash2 className="size-[18px]" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </Card>
      ) : (
        <p className="rounded-3xl border border-dashed border-border px-5 py-6 text-center text-[15px] leading-relaxed text-muted">
          Сплит — готовый список упражнений, например «Фулбади 1» или «Ноги». В начале тренировки его можно загрузить
          одним нажатием.
        </p>
      )}

      <Button variant="secondary" className="mt-3 w-full" disabled={full} onClick={() => setEditing({ mode: 'create' })}>
        <Plus className="size-[18px]" />
        {full ? `Создано уже ${MAX_SPLITS} сплитов` : 'Новый сплит'}
      </Button>

      {editing ? (
        <SplitEditor
          key={editing.mode === 'edit' ? editing.split.id : 'create'}
          split={editing.mode === 'edit' ? editing.split : null}
          library={exercises}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null)
            setOpenId(id)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Удалить сплит «${removing.name}»?` : 'Удалить сплит?'}
        description="Сплит исчезнет из списка. Упражнения и сохранённые тренировки не изменятся."
        confirmLabel="Удалить"
        danger
        pending={pending}
        onConfirm={remove}
      />
    </>
  )
}

function SplitEditor({
  split,
  library,
  onClose,
  onSaved,
}: {
  split: Split | null
  library: Exercise[]
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [name, setName] = useState(split?.name ?? '')
  const [items, setItems] = useState<Exercise[]>(split?.exercises ?? [])
  // Упражнения, созданные прямо в этой шторке: список из профиля обновится чуть позже
  const [created, setCreated] = useState<Exercise[]>([])
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const all = useMemo(() => {
    const known = new Set(library.map((e) => e.id))
    return [...library, ...created.filter((e) => !known.has(e.id))].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [library, created])

  const inSplit = new Set(items.map((e) => e.id))
  const q = normalize(query)
  const available = all.filter((e) => !inSplit.has(e.id) && (!q || normalize(e.name).includes(q)))
  const exact = all.some((e) => normalize(e.name) === q)
  const canCreate = q.length > 0 && !exact
  const libraryFull = all.length >= MAX_EXERCISES_IN_LIBRARY
  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && items.length > 0 && dirty && !pending

  const change = (next: Exercise[]) => {
    setItems(next)
    setDirty(true)
  }

  const add = (exercise: Exercise) => {
    if (inSplit.has(exercise.id)) return
    change([...items, exercise])
    setQuery('')
  }

  const createAndAdd = async () => {
    if (creating || !canCreate || libraryFull) return
    setCreating(true)
    try {
      const result = await createExercise(query.trim())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCreated((list) => [...list, result.data])
      setItems((list) => [...list, result.data])
      setDirty(true)
      setQuery('')
    } catch {
      toast.error(NETWORK_ERROR)
    } finally {
      setCreating(false)
    }
  }

  const save = async () => {
    if (!canSave) return
    setPending(true)
    try {
      const result = await saveSplit({ id: split?.id, name: trimmed, exerciseIds: items.map((e) => e.id) })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(split ? 'Сплит сохранён' : 'Сплит создан')
      onSaved(result.data.id)
    } catch {
      toast.error(NETWORK_ERROR)
    } finally {
      setPending(false)
    }
  }

  const iconButton =
    'flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors active:bg-surface-2 active:text-fg disabled:opacity-30'

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (open) return
          if (dirty) setConfirmClose(true)
          else onClose()
        }}
        title={split ? 'Сплит' : 'Новый сплит'}
        description={split ? 'В сохранённых тренировках останется прежнее название.' : 'Название и упражнения по порядку'}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">
          <label className="block">
            <span className="text-sm font-medium text-muted">Название</span>
            <input
              className={cn(inputClass, 'mt-1.5')}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setDirty(true)
              }}
              maxLength={MAX_SPLIT_NAME}
              placeholder="Например, Фулбади 1"
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="done"
            />
          </label>

          <p className="mb-1 mt-5 flex items-baseline justify-between gap-3 text-sm font-medium text-muted">
            <span>В сплите</span>
            <span className="tabular">{items.length > 0 ? countLabel(items.length, WORDS.exercises) : null}</span>
          </p>
          {items.length > 0 ? (
            <ol aria-label="Упражнения в сплите" className="divide-y divide-border rounded-2xl border border-border">
              {items.map((exercise, index) => (
                <li key={exercise.id} className="flex min-h-12 items-center gap-1 py-1 pl-3 pr-1">
                  <span className="tabular w-5 shrink-0 text-right text-sm text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 break-words px-2 text-[15px] font-medium leading-snug">
                    {exercise.name}
                  </span>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={index === 0}
                    aria-label={`Поднять выше: ${exercise.name}`}
                    onClick={() => change(move(items, index, index - 1))}
                  >
                    <ArrowUp className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    disabled={index === items.length - 1}
                    aria-label={`Опустить ниже: ${exercise.name}`}
                    onClick={() => change(move(items, index, index + 1))}
                  >
                    <ArrowDown className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Убрать из сплита: ${exercise.name}`}
                    onClick={() => change(items.filter((e) => e.id !== exercise.id))}
                  >
                    <X className="size-[18px]" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-border px-4 py-4 text-center text-[15px] leading-relaxed text-muted">
              Выбери упражнения ниже — они встанут в сплит в том порядке, в котором ты их добавишь.
            </p>
          )}

          <p className="mb-1.5 mt-5 text-sm font-medium text-muted">Добавить упражнение</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (available.length === 1 && !canCreate) add(available[0])
              else void createAndAdd()
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

          <ul aria-label="Мои упражнения" className="mt-1.5">
            {canCreate ? (
              <li>
                <button
                  type="button"
                  disabled={creating || libraryFull}
                  onClick={createAndAdd}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left transition-colors active:bg-surface-2 disabled:opacity-60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
                    {creating ? <LoaderCircle className="size-[18px] animate-spin" /> : <Plus className="size-[18px]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">Добавить «{query.trim()}»</span>
                    <span className="block text-sm text-muted">
                      {libraryFull
                        ? `В списке уже ${MAX_EXERCISES_IN_LIBRARY} упражнений — это максимум`
                        : 'Новое упражнение в мой список и в сплит'}
                    </span>
                  </span>
                </button>
              </li>
            ) : null}
            {available.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => add(exercise)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left transition-colors active:bg-surface-2"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg">
                    <Plus className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[15px] font-medium leading-snug">{exercise.name}</span>
                </button>
              </li>
            ))}
            {available.length === 0 && !canCreate ? (
              <li className="px-1 py-3 text-[15px] leading-relaxed text-muted">
                {all.length === 0
                  ? 'Твой список упражнений пуст. Введи название выше — упражнение сохранится и попадёт в сплит.'
                  : q
                    ? 'Это упражнение уже в сплите'
                    : 'Все твои упражнения уже в сплите. Новое можно добавить, введя название выше.'}
              </li>
            ) : null}
          </ul>
        </div>

        <div className="shrink-0 border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <Button className="w-full" disabled={!canSave} onClick={save}>
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
            {split ? 'Сохранить' : 'Создать сплит'}
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Закрыть без сохранения?"
        description="Изменения в сплите не будут сохранены."
        confirmLabel="Закрыть"
        cancelLabel="Остаться"
        danger
        onConfirm={() => {
          setConfirmClose(false)
          onClose()
        }}
      />
    </>
  )
}
