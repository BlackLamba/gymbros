'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateDisplayName } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field'

export function NameForm({ name }: { name: string }) {
  const [value, setValue] = useState(name)
  const [saved, setSaved] = useState(name)
  const [pending, startTransition] = useTransition()
  const trimmed = value.trim()
  const changed = trimmed !== saved && trimmed.length > 0

  const save = () => {
    if (!changed || pending) return
    startTransition(async () => {
      try {
        const result = await updateDisplayName(trimmed)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSaved(trimmed)
        setValue(trimmed)
        toast.success('Имя сохранено')
      } catch {
        toast.error('Нет связи с сервером. Попробуй ещё раз.')
      }
    })
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">Имя</span>
        <input
          className={inputClass}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="done"
          placeholder="Как тебя называть"
        />
      </label>
      {changed ? (
        <Button type="submit" className="h-13 shrink-0" disabled={pending}>
          Сохранить
        </Button>
      ) : null}
    </form>
  )
}
