import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/ui/card'

export function PageTitle({
  title,
  eyebrow,
  back,
  action,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  back?: { href: string; label: string }
  action?: ReactNode
}) {
  return (
    <header className="mb-5">
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex h-10 items-center gap-1.5 pr-3 text-sm font-medium text-muted transition-colors active:text-fg"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  )
}
