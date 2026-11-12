'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronRight, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { createExercise, deleteExercise, renameExercise } from '@/lib/actions'
import type { Exercise } from '@/lib/types'
import { MAX_EXERCISES_IN_LIBRARY } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog, Sheet } from '@/components/ui/dialog'
import { inputClass } from '@/components/ui/field'

type Editing = { mode: 'create' } | { mode: 'rename'; exercise: Exercise }

/** Личный список упражнений: добавить, переименовать, удалить. */
export function ExerciseManager({ exercises }: { exercises: Exercise[] }) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [removing, setRemoving] = useState<Exercise | null>(null)
  const [pending, setPending] = useState(false)
  const full = exercises.length >= MAX_EXERCISES_IN_LIBRARY

  const run = async (call: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) => {
    setPending(true)
    try {
      const result = await call()
      if (!result.ok) {
        toast.error(result.error)
        return false
      }
      toast.success(success)
      return true
    } catch {
      toast.error('Нет связи с сервером. Попробуй ещё раз.')
      return false
    } finally {
      setPending(false)
    }
  }

  const submit = async (name: string) => {
    if (!editing) return
    const ok =
      editing.mode === 'create'
        ? await run(() => createExercise(name), 'Упражнение добавлено')
        : await run(() => renameExercise(editing.exercise.id, name), 'Название изменено')
    if (ok) setEditing(null)
  }

  const remove = async () => {
    if (!removing) return
    const ok = await run(() => deleteExercise(removing.id), 'Упражнение удалено')
    if (ok) setRemoving(null)
  }

  const iconButton =
    'flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors active:bg-surface-2 active:text-fg'

  return (
    <>
      {exercises.length > 0 ? (
        <Card className="divide-y divide-border">
          {exercises.map((exercise) => (
            <div key={exercise.id} className="flex items-center pr-1">
              <Link
                href={`/exercises/${exercise.id}`}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 pl-4 pr-2 active:opacity-70"
              >
                <span className="min-w-0 flex-1 break-words text-[15px] font-medium leading-snug">{exercise.name}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </Link>
              <button
                type="button"
                className={iconButton}
                aria-label={`Переименовать «${exercise.name}»`}
                onClick={() => setEditing({ mode: 'rename', exercise })}
              >
                <Pencil className="size-[18px]" />
              </button>
              <button
                type="button"
                className={iconButton}
                aria-label={`Удалить «${exercise.name}»`}
                onClick={() => setRemoving(exercise)}
              >
                <Trash2 className="size-[18px]" />
              </button>
            </div>
          ))}
        </Card>
      ) : (
        <p className="rounded-3xl border border-dashed border-border px-5 py-6 text-center text-[15px] leading-relaxed text-muted">
          Список пуст. Добавь упражнения здесь или прямо во время тренировки.
        </p>
      )}

      <Button
        variant="secondary"
        className="mt-3 w-full"
        disabled={full}
        onClick={() => setEditing({ mode: 'create' })}
      >
        <Plus className="size-[18px]" />
        {full ? `В списке уже ${MAX_EXERCISES_IN_LIBRARY} упражнений` : 'Добавить упражнение'}
      </Button>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.mode === 'rename' ? 'Переименовать упражнение' : 'Новое упражнение'}
        description={
          editing?.mode === 'rename' ? 'В уже сохранённых тренировках останется прежнее название.' : undefined
        }
      >
        {editing ? (
          <NameFields
            key={editing.mode === 'rename' ? editing.exercise.id : 'create'}
            initial={editing.mode === 'rename' ? editing.exercise.name : ''}
            submitLabel={editing.mode === 'rename' ? 'Сохранить' : 'Добавить'}
            pending={pending}
            onSubmit={submit}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Удалить «${removing.name}»?` : 'Удалить упражнение?'}
        description="Упражнение исчезнет из списка. Сохранённые тренировки не изменятся, но сравнение с прошлыми результатами для него прекратится."
        confirmLabel="Удалить"
        danger
        pending={pending}
        onConfirm={remove}
      />
    </>
  )
}

function NameFields({
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  initial: string
  submitLabel: string
  pending: boolean
  onSubmit: (name: string) => void
}) {
  const [value, setValue] = useState(initial)
  const trimmed = value.trim()
  return (
    <form
      className="flex flex-col gap-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (trimmed && !pending) onSubmit(trimmed)
      }}
    >
      <label>
        <span className="sr-only">Название упражнения</span>
        <input
          autoFocus
          className={inputClass}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={60}
          placeholder="Например, жим лёжа"
          autoCapitalize="sentences"
          autoComplete="off"
          enterKeyHint="done"
        />
      </label>
      <Button type="submit" className="w-full" disabled={pending || !trimmed || trimmed === initial}>
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
