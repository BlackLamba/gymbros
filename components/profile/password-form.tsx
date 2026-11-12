'use client'

import { useActionState, useState } from 'react'
import { KeyRound, LoaderCircle } from 'lucide-react'
import { type FormState, changePassword } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'

const initial: FormState = {}

export function PasswordForm() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <KeyRound className="size-[18px]" />
        Сменить пароль
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Смена пароля">
        {/* Форма живёт только пока шторка открыта: после закрытия пароли не остаются в полях */}
        <PasswordFields onDone={() => setOpen(false)} />
      </Sheet>
    </>
  )
}

function PasswordFields({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(changePassword, initial)

  if (state.success) {
    return (
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
        <p className="text-[15px] leading-relaxed">Пароль изменён. На этом устройстве ты остаёшься в аккаунте.</p>
        <Button className="mt-5 w-full" onClick={onDone}>
          Готово
        </Button>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-3 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2"
    >
      <Field label="Текущий пароль" name="current" type="password" autoComplete="current-password" required />
      <Field
        label="Новый пароль"
        name="next"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
      />
      <Field
        label="Новый пароль ещё раз"
        name="repeat"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
      />
      <p className="text-sm text-muted">Не короче 8 символов.</p>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.error}
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
        Сменить пароль
      </Button>
    </form>
  )
}
