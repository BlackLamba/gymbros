'use client'

import { useTheme } from 'next-themes'
import { Segmented } from '@/components/ui/segmented'
import { useIsClient } from '@/components/workout/use-now'

const OPTIONS = [
  { value: 'system', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
] as const

type ThemeChoice = (typeof OPTIONS)[number]['value']

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  // Выбранная тема хранится на устройстве, поэтому до гидратации она неизвестна
  const isClient = useIsClient()
  return (
    <Segmented
      label="Тема оформления"
      options={[...OPTIONS]}
      value={isClient ? (theme as ThemeChoice | undefined) : undefined}
      onChange={setTheme}
    />
  )
}
