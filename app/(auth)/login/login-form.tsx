'use client'

import { useActionState, useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import { signIn, type FormState } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'

const initial: FormState = {}

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial)
  const signedIn = state.success !== undefined

  // Полная загрузка вместо клиентского перехода: форма с паролем не остаётся в памяти вкладки
  useEffect(() => {
    if (signedIn) window.location.replace('/')
  }, [signedIn])

  return (
    <form action={action} className="mt-10 flex flex-col gap-4">
      <Field
        label="Почта"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <Field label="Пароль" name="password" type="password" autoComplete="current-password" required />

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.error}
      </p>

      <Button type="submit" size="lg" disabled={pending || signedIn} className="w-full">
        {pending || signedIn ? <LoaderCircle className="size-5 animate-spin" /> : null}
        Войти
      </Button>
    </form>
  )
}
