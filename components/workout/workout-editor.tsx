'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CloudOff,
  ListChecks,
  LoaderCircle,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { createExercise, deleteWorkout } from '@/lib/actions'
import { toLocalInputValue } from '@/lib/dates'
import { WORDS, countLabel, formatDate, formatDateShort, formatSetCompact, formatTime } from '@/lib/format'
import type { Exercise, ExerciseContext, Split, WorkoutExercise } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MAX_EXERCISES_IN_WORKOUT, MAX_SETS_PER_EXERCISE } from '@/lib/validation'
import {
  type EditorExercise,
  type EditorSet,
  addSplitExercises,
  fromWorkout,
  move,
  newId,
  nextSetDefaults,
  toPayload,
  totalsOf,
  weightToInput,
} from '@/lib/workout-editor'
import { type SyncStatus, WorkoutSync } from '@/lib/workout-sync'
import { Button, buttonClass } from '@/components/ui/button'
import { Card, Skeleton } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { inputClass } from '@/components/ui/field'
import { ExercisePicker } from './exercise-picker'
import { FinishSummary } from './finish-summary'
import { LiveTimer } from './live-timer'
import { SetRow } from './set-row'
import { useIsClient } from './use-now'

type Props = {
  mode: 'active' | 'edit'
  workout: { id: string; startedAt: string; finishedAt: string | null; updatedAt: string; splitName?: string | null }
  initialExercises: WorkoutExercise[]
  library: Exercise[]
  /** Сплиты пользователя — их можно загрузить в активную тренировку целиком */
  splits?: Split[]
  /** История по упражнениям: подсказка «в прошлый раз» и значения для нового подхода */
  contexts: Record<string, ExerciseContext>
  tz: string
}

/**
 * Редактор тренировки: один компонент для активной тренировки и для правки сохранённой.
 * Рендерится только в браузере — ему нужен черновик из localStorage.
 */
export function WorkoutEditor(props: Props) {
  const isClient = useIsClient()
  if (!isClient) return <EditorSkeleton />
  return <Editor {...props} />
}

export function EditorSkeleton() {
  return (
    <div className="px-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <Skeleton className="mx-auto h-16 w-44" />
      <Skeleton className="mt-6 h-56" />
      <Skeleton className="mt-3 h-40" />
    </div>
  )
}

const noSubscribe = () => () => {}
const savedStatus = (): SyncStatus => 'saved'

const NO_SPLITS: Split[] = []

function Editor({ mode, workout, initialExercises, library: initialLibrary, splits = NO_SPLITS, contexts, tz }: Props) {
  const router = useRouter()
  const isActive = mode === 'active'

  const [sync] = useState(() =>
    isActive
      ? new WorkoutSync(workout.id, workout.updatedAt, fromWorkout(initialExercises), workout.splitName ?? null)
      : null,
  )
  const status = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getStatus ?? savedStatus, savedStatus)

  const [exercises, setExercises] = useState<EditorExercise[]>(
    () => sync?.initialExercises ?? fromWorkout(initialExercises),
  )
  const [library, setLibrary] = useState(initialLibrary)
  const [splitName, setSplitName] = useState<string | null>(() => sync?.initialSplitName ?? workout.splitName ?? null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishAt, setFinishAt] = useState<number | null>(() => sync?.initialFinishAt ?? null)
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'cancel' | 'empty' | 'leave' | null>(null)
  const [startInput, setStartInput] = useState(() => toLocalInputValue(workout.startedAt))
  const [endInput, setEndInput] = useState(() => toLocalInputValue(workout.finishedAt ?? workout.startedAt))

  // Актуальное состояние для обработчиков: они стабильны и не зависят от рендера
  const latest = useRef(exercises)
  const latestSplit = useRef(splitName)

  const apply = useCallback(
    (update: (current: EditorExercise[]) => EditorExercise[], nextSplit?: string) => {
      const next = update(latest.current)
      if (next === latest.current) return
      latest.current = next
      setExercises(next)
      if (sync) {
        // Название сплита живёт вместе с упражнениями: убрали все — тренировка снова «без сплита»
        const split = next.length === 0 ? null : (nextSplit ?? latestSplit.current)
        if (split !== latestSplit.current) {
          latestSplit.current = split
          setSplitName(split)
        }
        sync.change(next, split)
      } else {
        setDirty(true)
      }
    },
    [sync],
  )

  useEffect(() => sync?.attach(), [sync])

  // Пока открыт экран с закреплённой шапкой, уведомления появляются под ней и не закрывают таймер
  const headerVisible = !(isActive && finishAt !== null)
  useEffect(() => {
    if (!headerVisible) return
    const root = document.documentElement
    root.style.setProperty('--toast-top', '84px')
    return () => {
      root.style.removeProperty('--toast-top')
    }
  }, [headerVisible])

  // Тренировку завершили или удалили с другого устройства
  useEffect(() => {
    if (status !== 'gone') return
    toast.info('Эта тренировка уже завершена или удалена')
    router.replace('/')
  }, [status, router])

  // Правка сохранённой тренировки: предупреждаем о несохранённых изменениях при закрытии вкладки
  useEffect(() => {
    if (isActive || !dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isActive, dirty])

  // --- упражнения -----------------------------------------------------------

  const addExercise = useCallback(
    (exercise: Exercise) => {
      if (latest.current.length >= MAX_EXERCISES_IN_WORKOUT) {
        toast.error(`В одной тренировке не больше ${MAX_EXERCISES_IN_WORKOUT} упражнений`)
        return
      }
      const created: EditorExercise = { id: newId(), exerciseId: exercise.id, name: exercise.name, sets: [] }
      // Первый подход создаём сразу: чаще всего останется только поправить числа
      created.sets = [{ id: newId(), ...nextSetDefaults(created, contexts[exercise.id]) }]
      apply((current) => [...current, created])
      setPickerOpen(false)
      window.setTimeout(() => {
        document.getElementById(`exercise-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 320)
    },
    [apply, contexts],
  )

  /** Загружает сплит: его упражнения появляются в тренировке сразу, без подходов. */
  const loadSplit = useCallback(
    (split: Split) => {
      const wasEmpty = latest.current.length === 0
      const result = addSplitExercises(latest.current, split.exercises, MAX_EXERCISES_IN_WORKOUT)
      setPickerOpen(false)
      if (result.added === 0) {
        toast.info(
          split.exercises.length === 0
            ? `В сплите «${split.name}» пока нет упражнений`
            : result.skipped > 0
              ? `В одной тренировке не больше ${MAX_EXERCISES_IN_WORKOUT} упражнений`
              : `Все упражнения из «${split.name}» уже в тренировке`,
        )
        return
      }
      // Название тренировке даёт первый загруженный сплит
      apply(() => result.exercises, wasEmpty || !latestSplit.current ? split.name : undefined)
      if (!wasEmpty) {
        const firstId = result.exercises[result.exercises.length - result.added].id
        window.setTimeout(() => {
          document.getElementById(`exercise-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 320)
      }
    },
    [apply],
  )

  const createAndAdd = useCallback(
    async (name: string) => {
      let result: Awaited<ReturnType<typeof createExercise>>
      try {
        result = await createExercise(name)
      } catch {
        toast.error('Нет связи с сервером. Новое упражнение можно добавить, когда появится сеть.')
        return false
      }
      if (!result.ok) {
        toast.error(result.error)
        return false
      }
      setLibrary((list) => [...list, result.data])
      addExercise(result.data)
      return true
    },
    [addExercise],
  )

  const moveExercise = useCallback(
    (exerciseId: string, direction: 1 | -1) => {
      apply((current) => {
        const index = current.findIndex((e) => e.id === exerciseId)
        return index === -1 ? current : move(current, index, index + direction)
      })
    },
    [apply],
  )

  const removeExercise = useCallback(
    (exerciseId: string) => {
      apply((current) => current.filter((e) => e.id !== exerciseId))
    },
    [apply],
  )

  const requestRemoveExercise = useCallback(
    (exerciseId: string) => {
      const exercise = latest.current.find((e) => e.id === exerciseId)
      if (!exercise) return
      // Пустое упражнение удаляем сразу, с подходами — после подтверждения
      if (exercise.sets.some((s) => s.weight !== '' || s.reps !== '')) setRemoveTarget(exerciseId)
      else removeExercise(exerciseId)
    },
    [removeExercise],
  )

  // --- подходы --------------------------------------------------------------

  const addSet = useCallback(
    (exerciseId: string) => {
      apply((current) =>
        current.map((e) => {
          if (e.id !== exerciseId) return e
          if (e.sets.length >= MAX_SETS_PER_EXERCISE) {
            toast.error(`Не больше ${MAX_SETS_PER_EXERCISE} подходов в одном упражнении`)
            return e
          }
          const defaults = nextSetDefaults(e, e.exerciseId ? contexts[e.exerciseId] : undefined)
          return { ...e, sets: [...e.sets, { id: newId(), ...defaults }] }
        }),
      )
    },
    [apply, contexts],
  )

  const changeSet = useCallback(
    (exerciseId: string, setId: string, patch: Partial<Pick<EditorSet, 'weight' | 'reps'>>) => {
      apply((current) =>
        current.map((e) =>
          e.id === exerciseId ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : e,
        ),
      )
    },
    [apply],
  )

  const removeSet = useCallback(
    (exerciseId: string, setId: string) => {
      const exercise = latest.current.find((e) => e.id === exerciseId)
      const index = exercise?.sets.findIndex((s) => s.id === setId) ?? -1
      if (!exercise || index === -1) return
      const removed = exercise.sets[index]
      apply((current) =>
        current.map((e) => (e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e)),
      )
      if (removed.weight === '' && removed.reps === '') return
      toast('Подход удалён', {
        duration: 5000,
        action: {
          label: 'Вернуть',
          onClick: () =>
            apply((current) =>
              current.map((e) => {
                if (e.id !== exerciseId || e.sets.some((s) => s.id === removed.id)) return e
                const sets = [...e.sets]
                sets.splice(Math.min(index, sets.length), 0, removed)
                return { ...e, sets }
              }),
            ),
        },
      })
    },
    [apply],
  )

  // --- завершение активной тренировки --------------------------------------------

  const requestFinish = () => {
    if (totalsOf(exercises).sets === 0) {
      setDialog('empty')
      return
    }
    const at = Date.now()
    setFinishAt(at)
    sync?.setFinishAt(at)
    window.scrollTo({ top: 0 })
  }

  const backToWorkout = () => {
    setFinishAt(null)
    sync?.setFinishAt(null)
  }

  const changeFinishAt = (value: number) => {
    setFinishAt(value)
    sync?.setFinishAt(value)
  }

  const confirmFinish = async () => {
    if (!sync || finishAt === null || pending) return
    setPending(true)
    const result = await sync.finish(finishAt)
    if (result === 'ok') {
      router.replace(`/workouts/${workout.id}?done=1`)
      return
    }
    setPending(false)
    if (result === 'gone') {
      toast.info('Эта тренировка уже удалена')
      router.replace('/')
    } else if (result === 'auth') {
      toast.error('Сессия истекла. Войди заново — записи сохранены на телефоне.')
    } else if (result === 'offline') {
      toast.error('Нет сети. Тренировка сохранена на телефоне — нажми «Сохранить» ещё раз, когда появится связь.')
    } else {
      toast.error('Не получилось сохранить. Данные на телефоне в порядке — попробуй ещё раз.')
    }
  }

  const cancelWorkout = async () => {
    setPending(true)
    let result: Awaited<ReturnType<typeof deleteWorkout>>
    try {
      result = await deleteWorkout(workout.id)
    } catch {
      result = { ok: false, error: 'Нет связи с сервером. Попробуй ещё раз.' }
    }
    if (!result.ok) {
      setPending(false)
      toast.error(result.error)
      return
    }
    sync?.discard()
    toast('Тренировка отменена')
    router.replace('/')
  }

  // --- сохранение правок завершённой тренировки ----------------------------------

  const saveEdit = async () => {
    if (pending) return
    const start = new Date(startInput)
    const end = new Date(endInput)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error('Укажи время начала и окончания')
      return
    }
    if (end < start) {
      toast.error('Окончание не может быть раньше начала')
      return
    }
    if (end.getTime() > Date.now() + 60_000) {
      toast.error('Окончание не может быть в будущем')
      return
    }

    setPending(true)
    try {
      const response = await fetch(`/api/workouts/${workout.id}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          exercises: toPayload(exercises),
          expect: 'completed',
          startedAt: start.toISOString(),
          finishedAt: end.toISOString(),
        }),
      })
      if (response.ok) {
        setDirty(false)
        toast.success('Изменения сохранены')
        router.replace(`/workouts/${workout.id}`)
        return
      }
      if (response.status === 401) toast.error('Сессия истекла. Войди заново и повтори.')
      else if (response.status === 404) toast.error('Тренировка не найдена — возможно, она была удалена.')
      else if (response.status === 422) toast.error('Проверь время начала и окончания.')
      else toast.error('Не получилось сохранить. Попробуй ещё раз.')
    } catch {
      toast.error('Нет сети. Изменения не сохранены — попробуй ещё раз, когда появится связь.')
    }
    setPending(false)
  }

  // --- отображение -----------------------------------------------------------------

  const usedIds = useMemo(
    () => new Set(exercises.map((e) => e.exerciseId).filter((id): id is string => id !== null)),
    [exercises],
  )
  const totals = totalsOf(exercises)
  const detailsHref = `/workouts/${workout.id}`

  if (isActive && finishAt !== null) {
    return (
      <FinishSummary
        exercises={exercises}
        splitName={splitName}
        startedAt={workout.startedAt}
        finishAt={finishAt}
        tz={tz}
        pending={pending}
        onFinishAtChange={changeFinishAt}
        onBack={backToWorkout}
        onConfirm={confirmFinish}
      />
    )
  }

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="grid h-[4.5rem] grid-cols-[1fr_auto_1fr] items-center px-2">
          <div>
            {isActive ? (
              <Link
                href="/"
                aria-label="На главную — тренировка продолжится"
                className={buttonClass({ variant: 'ghost', size: 'icon' })}
              >
                <ArrowLeft className="size-5" />
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Назад"
                onClick={() => (dirty ? setDialog('leave') : router.replace(detailsHref))}
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
          </div>
          <div className="text-center">
            {isActive ? (
              <>
                <LiveTimer startedAt={workout.startedAt} className="block text-[32px] font-semibold leading-none tracking-tight" />
                <p className="tabular mx-auto mt-1 max-w-[11rem] truncate text-xs text-muted">
                  {splitName ? (
                    <>
                      <span className="font-semibold text-fg">{splitName}</span> · с {formatTime(workout.startedAt, tz)}
                    </>
                  ) : (
                    <>начало в {formatTime(workout.startedAt, tz)}</>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Редактирование</p>
                <p className="mt-0.5 text-xs text-muted">{formatDate(workout.startedAt, tz)}</p>
              </>
            )}
          </div>
          <div className="flex justify-end pr-2">{isActive ? <SyncBadge status={status} /> : null}</div>
        </div>
        {isActive && (status === 'offline' || status === 'error' || status === 'auth') ? (
          <div className="flex items-start gap-2.5 border-t border-border px-4 py-2.5 text-sm leading-snug text-muted">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-text" />
            {status === 'auth' ? (
              <p>
                Сессия истекла. Записи сохранены на телефоне —{' '}
                <a href="/login" className="font-semibold text-fg underline underline-offset-2">
                  войди заново
                </a>
                , и они отправятся.
              </p>
            ) : (
              <p>Нет связи с сервером. Всё сохранено на телефоне и отправится, когда связь вернётся.</p>
            )}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 px-2 pt-3 min-[360px]:px-3">
        {!isActive ? (
          <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-muted">Начало</span>
              <input
                type="datetime-local"
                className={cn(inputClass, 'mt-1.5')}
                value={startInput}
                onChange={(e) => {
                  setStartInput(e.target.value)
                  setDirty(true)
                }}
              />
            </label>
            <label className="block min-w-0">
              <span className="text-sm font-medium text-muted">Окончание</span>
              <input
                type="datetime-local"
                className={cn(inputClass, 'mt-1.5')}
                value={endInput}
                min={startInput}
                onChange={(e) => {
                  setEndInput(e.target.value)
                  setDirty(true)
                }}
              />
            </label>
          </Card>
        ) : null}

        {isActive && exercises.length === 0 && splits.length > 0 ? (
          <section aria-label="Сплиты" className="mt-2">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Загрузить сплит</p>
            <div className="flex flex-col gap-2">
              {splits.map((split) => (
                <button
                  key={split.id}
                  type="button"
                  onClick={() => loadSplit(split)}
                  className="flex min-h-16 w-full items-center gap-3.5 rounded-3xl border border-border bg-surface px-4 py-3 text-left transition-colors active:bg-surface-2"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg">
                    <ListChecks className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[17px] font-semibold leading-snug">{split.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {split.exercises.length > 0
                        ? `${countLabel(split.exercises.length, WORDS.exercises)} · ${split.exercises.map((e) => e.name).join(', ')}`
                        : 'пока без упражнений'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mb-1 mt-5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Или собрать с нуля
            </p>
          </section>
        ) : null}

        {exercises.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-12 text-center transition-colors active:bg-surface"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg">
              <Plus className="size-7" />
            </span>
            <span className="text-lg font-semibold">Добавь первое упражнение</span>
            <span className="max-w-64 text-[15px] leading-relaxed text-muted">
              Всё, что ты вводишь, сохраняется само — даже если пропадёт сеть.
            </span>
          </button>
        ) : null}

        {exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            count={exercises.length}
            context={exercise.exerciseId ? contexts[exercise.exerciseId] : undefined}
            tz={tz}
            onMove={moveExercise}
            onRemove={requestRemoveExercise}
            onAddSet={addSet}
            onChangeSet={changeSet}
            onRemoveSet={removeSet}
          />
        ))}

        {!isActive && totals.incompleteSets > 0 ? (
          <p className="px-2 text-sm leading-relaxed text-muted">
            Подходы без повторений не сохранятся: заполни их или удали.
          </p>
        ) : null}

        {isActive ? (
          <button
            type="button"
            onClick={() => setDialog('cancel')}
            className="mx-auto mt-3 h-11 px-4 text-sm font-medium text-muted underline-offset-4 active:text-danger active:underline"
          >
            Отменить тренировку
          </button>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg">
        <div className="mx-auto flex w-full max-w-xl gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          <Button variant="secondary" size="lg" className="min-w-0 flex-[1.3] px-2" onClick={() => setPickerOpen(true)}>
            <Plus className="size-5 shrink-0" />
            <span className="truncate">Упражнение</span>
          </Button>
          {isActive ? (
            <Button size="lg" className="min-w-0 flex-1 px-3" onClick={requestFinish}>
              <span className="truncate">Завершить</span>
            </Button>
          ) : (
            <Button size="lg" className="min-w-0 flex-1 px-3" disabled={pending} onClick={saveEdit}>
              {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
              <span className="truncate">Сохранить</span>
            </Button>
          )}
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        library={library}
        contexts={contexts}
        usedIds={usedIds}
        tz={tz}
        splits={isActive ? splits : NO_SPLITS}
        onPickSplit={loadSplit}
        onPick={addExercise}
        onCreate={createAndAdd}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Удалить упражнение?"
        description="Все его подходы в этой тренировке будут удалены."
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          if (removeTarget) removeExercise(removeTarget)
          setRemoveTarget(null)
        }}
      />

      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Отменить тренировку?"
        description="Тренировка и все записанные в ней подходы будут удалены. Это действие нельзя отменить."
        confirmLabel="Удалить тренировку"
        cancelLabel="Продолжить тренировку"
        danger
        pending={pending}
        onConfirm={cancelWorkout}
      />

      <ConfirmDialog
        open={dialog === 'empty'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="В тренировке пока нет подходов"
        description="Сохранять нечего. Можно продолжить тренировку или удалить её."
        confirmLabel="Удалить тренировку"
        cancelLabel="Продолжить тренировку"
        danger
        pending={pending}
        onConfirm={cancelWorkout}
      />

      <ConfirmDialog
        open={dialog === 'leave'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Выйти без сохранения?"
        description="Изменения в этой тренировке не будут сохранены."
        confirmLabel="Выйти"
        cancelLabel="Остаться"
        danger
        onConfirm={() => {
          setDirty(false)
          router.replace(detailsHref)
        }}
      />
    </div>
  )
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const view =
    status === 'saving'
      ? { icon: <LoaderCircle className="size-3.5 animate-spin" />, text: 'Сохраняю' }
      : status === 'saved' || status === 'gone'
        ? { icon: <Check className="size-3.5 text-accent-text" />, text: 'Сохранено' }
        : { icon: <CloudOff className="size-3.5" />, text: 'На телефоне' }
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs font-medium text-muted">
      {view.icon}
      {view.text}
    </span>
  )
}

const ExerciseCard = memo(function ExerciseCard({
  exercise,
  index,
  count,
  context,
  tz,
  onMove,
  onRemove,
  onAddSet,
  onChangeSet,
  onRemoveSet,
}: {
  exercise: EditorExercise
  index: number
  count: number
  context: ExerciseContext | undefined
  tz: string
  onMove: (exerciseId: string, direction: 1 | -1) => void
  onRemove: (exerciseId: string) => void
  onAddSet: (exerciseId: string) => void
  onChangeSet: (exerciseId: string, setId: string, patch: Partial<Pick<EditorSet, 'weight' | 'reps'>>) => void
  onRemoveSet: (exerciseId: string, setId: string) => void
}) {
  const { id } = exercise
  const changeSet = useCallback(
    (setId: string, patch: Partial<Pick<EditorSet, 'weight' | 'reps'>>) => onChangeSet(id, setId, patch),
    [id, onChangeSet],
  )
  const removeSet = useCallback((setId: string) => onRemoveSet(id, setId), [id, onRemoveSet])

  const iconButton =
    'flex size-10 items-center justify-center rounded-xl text-muted transition-colors active:bg-surface-2 active:text-fg disabled:opacity-30'

  return (
    <Card id={`exercise-${id}`} className="animate-rise scroll-mt-28 p-2.5 min-[360px]:p-3">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 px-1 pt-1.5">
          <h2 className="text-[17px] font-semibold leading-snug">
            <span className="tabular mr-2 text-muted">{index + 1}</span>
            {exercise.name}
          </h2>
        </div>
        <div className="flex shrink-0">
          <button type="button" className={iconButton} disabled={index === 0} aria-label="Поднять выше" onClick={() => onMove(id, -1)}>
            <ChevronUp className="size-5" />
          </button>
          <button type="button" className={iconButton} disabled={index === count - 1} aria-label="Опустить ниже" onClick={() => onMove(id, 1)}>
            <ChevronDown className="size-5" />
          </button>
          <button type="button" className={iconButton} aria-label={`Удалить упражнение «${exercise.name}»`} onClick={() => onRemove(id)}>
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      </div>

      {context ? (
        <p className="tabular px-1 pt-0.5 text-[13px] leading-snug text-muted">
          В прошлый раз, {formatDateShort(context.last.startedAt, tz)}:{' '}
          <span className="text-fg/80">
            {context.last.sets.map((s) => formatSetCompact(s.weight, s.reps)).join(' · ')}
          </span>
        </p>
      ) : exercise.exerciseId ? (
        <p className="px-1 pt-0.5 text-[13px] text-muted">Первая запись — точка отсчёта</p>
      ) : null}

      {exercise.sets.length > 0 ? (
        <>
          <div
            aria-hidden
            className="mt-3 grid grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
          >
            <span>№</span>
            <span>Вес, кг</span>
            <span>Повторы</span>
            <span />
          </div>
          <ol className="mt-1.5 flex flex-col gap-1.5">
            {exercise.sets.map((set, n) => {
              const last = context?.last.sets[n]
              return (
                <SetRow
                  key={set.id}
                  index={n}
                  set={set}
                  hintWeight={last && last.weight > 0 ? weightToInput(last.weight) : undefined}
                  hintReps={last ? String(last.reps) : undefined}
                  onChange={changeSet}
                  onRemove={removeSet}
                />
              )
            })}
          </ol>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => onAddSet(id)}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[15px] font-semibold text-fg transition-colors active:bg-surface-2"
      >
        <Plus className="size-[18px]" />
        Подход
      </button>
    </Card>
  )
})
