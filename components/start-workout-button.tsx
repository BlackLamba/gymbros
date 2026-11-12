'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { LoaderCircle, Play } from 'lucide-react'
import { startWorkout } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function StartWorkoutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition()

  const start = () => {
    if (pending) return
    startTransition(async () => {
      try {
        const result = await startWorkout()
        if (result && !result.ok) toast.error(result.error)
      } catch (error) {
        // redirect() внутри действия пробрасывается через исключение — его нужно отдать фреймворку
        if (isRedirect(error)) throw error
        toast.error('Нет связи с сервером. Проверь соединение и попробуй ещё раз.')
      }
    })
  }

  return (
    <Button size="lg" disabled={pending} onClick={start} className={cn('h-16 w-full text-lg', className)}>
      {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Play className="size-5 fill-current" />}
      Начать тренировку
    </Button>
  )
}

function isRedirect(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}
