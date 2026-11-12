'use client'

import { useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'

export function SignOutButton() {
  const form = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    // Обычная отправка формы: сервер завершает сессию и заново загружает страницу входа
    <form ref={form} method="post" action="/api/auth/signout">
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <LogOut className="size-[18px]" />
        Выйти
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Выйти из аккаунта?"
        description="Тренировки останутся на сервере. Чтобы вернуться, понадобятся почта и пароль."
        confirmLabel="Выйти"
        pending={pending}
        onConfirm={() => {
          setPending(true)
          form.current?.submit()
        }}
      />
    </form>
  )
}
