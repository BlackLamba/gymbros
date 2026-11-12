import { Suspense } from 'react'
import { AppNav, NavView } from '@/components/nav/app-nav'
import { TimeZoneSync } from '@/components/time-zone-sync'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:pl-60">
      <Suspense fallback={<NavView pathname={null} />}>
        <AppNav />
      </Suspense>
      <main className="mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] md:pb-16 md:pt-12">
        {children}
      </main>
      <TimeZoneSync />
    </div>
  )
}
