'use client'

import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const overlayClass = 'fixed inset-0 z-40 bg-overlay data-[state=open]:animate-fade-in'

/** Подтверждение действия: диалог по центру, на телефоне прижат к низу — ближе к большому пальцу. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-50 mx-auto max-w-md rounded-3xl border border-border bg-surface p-5 shadow-2xl outline-none data-[state=open]:animate-rise sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="text-lg font-semibold leading-snug">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-muted">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <Button variant={danger ? 'danger' : 'primary'} className="w-full" disabled={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button variant="secondary" className="w-full" disabled={pending} onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Нижняя шторка. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-3xl border border-b-0 border-border bg-surface shadow-2xl outline-none data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
            className,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'text-sm text-muted' : 'sr-only'}>
                {description ?? title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Закрыть" className="-mr-2">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
