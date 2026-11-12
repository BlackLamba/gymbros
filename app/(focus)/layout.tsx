import { TimeZoneSync } from '@/components/time-zone-sync'

/** Полноэкранные режимы без навигации: активная тренировка и правка сохранённой. */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl">
      {children}
      <TimeZoneSync />
    </div>
  )
}
