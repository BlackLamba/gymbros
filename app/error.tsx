'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Не получилось загрузить страницу. Проверь соединение и попробуй ещё раз — твои записи в безопасности.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={reset}>Повторить</Button>
        {/* Полная перезагрузка: обычная ссылка надёжнее клиентского перехода после ошибки */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-muted">
          На главную
        </a>
      </div>
    </main>
  )
}
