import type { Metadata } from 'next'
import { Wordmark } from '@/components/wordmark'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Вход' }

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="animate-rise">
        <Wordmark className="text-4xl" />
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Track your grind.
          <br />
          See your progress.
        </p>
      </div>
      <LoginForm />
      <p className="mt-8 text-center text-xs text-muted">Закрытое приложение. Регистрации нет.</p>
    </main>
  )
}
