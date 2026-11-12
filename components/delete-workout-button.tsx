'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteWorkout } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'

export function DeleteWorkoutButton({ workoutId, label }: { workoutId: string; label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const remove = async () => {
    setPending(true)
    let result: Awaited<ReturnType<typeof deleteWorkout>>
    try {
      result = await deleteWorkout(workoutId)
    } catch {
      result = { ok: false, error: 'Нет связи с сервером. Попробуй ещё раз.' }
    }
    if (!result.ok) {
      setPending(false)
      toast.error(result.error)
      return
    }
    toast.success('Тренировка удалена')
    router.replace('/history')
  }

  return (
    <>
      <Button variant="secondary" className="flex-1 text-danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-[18px]" />
        Удалить
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Удалить тренировку?"
        description={`Тренировка ${label} и все её подходы будут удалены. Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        danger
        pending={pending}
        onConfirm={remove}
      />
    </>
  )
}
