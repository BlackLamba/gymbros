import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-1 text-2xl font-semibold">Страница не найдена</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Возможно, тренировка была удалена или ссылка устарела.
      </p>
      <Link href="/" className={buttonClass({ className: 'mt-6' })}>
        На главную
      </Link>
    </main>
  )
}
