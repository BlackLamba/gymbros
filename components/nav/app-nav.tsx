'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, History, House, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/wordmark'

const ITEMS = [
  { href: '/', label: 'Главная', icon: House, match: (p: string) => p === '/' },
  { href: '/calendar', label: 'Календарь', icon: CalendarDays, match: (p: string) => p.startsWith('/calendar') },
  {
    href: '/history',
    label: 'История',
    icon: History,
    match: (p: string) => p.startsWith('/history') || p.startsWith('/workouts'),
  },
  {
    href: '/profile',
    label: 'Профиль',
    icon: UserRound,
    match: (p: string) => p.startsWith('/profile') || p.startsWith('/exercises') || p.startsWith('/friend'),
  },
] as const

export function AppNav() {
  const pathname = usePathname()
  return <NavView pathname={pathname} />
}

/** Используется и как запасной вид, пока адрес ещё не известен. */
export function NavView({ pathname }: { pathname: string | null }) {
  return (
    <>
      {/* Телефон: нижняя навигация */}
      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg md:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-4 px-2 pb-[env(safe-area-inset-bottom)]">
          {ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = pathname !== null && match(pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    active ? 'text-fg' : 'text-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-0 h-0.5 w-8 rounded-full bg-accent-text transition-opacity',
                      active ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Планшет и десктоп: боковое меню */}
      <nav
        aria-label="Основная навигация"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg px-4 py-8 md:flex"
      >
        <Link href="/" className="px-3">
          <Wordmark />
        </Link>
        <ul className="mt-10 flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = pathname !== null && match(pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors',
                    active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">
          Track your grind.
          <br />
          See your progress.
        </p>
      </nav>
    </>
  )
}
