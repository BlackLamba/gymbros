'use client'

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { useEffect } from 'react'

const THEME_COLORS = { light: '#f4f3ee', dark: '#121210' } as const

/** Цвет системной панели браузера должен следовать выбранной теме, а не только системной. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', THEME_COLORS[resolvedTheme])
    })
  }, [resolvedTheme])
  return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="gymbros-theme"
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
