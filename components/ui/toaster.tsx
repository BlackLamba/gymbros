'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      position="top-center"
      offset={{ top: 'calc(env(safe-area-inset-top) + var(--toast-top, 12px))' }}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + var(--toast-top, 12px))', left: 12, right: 12 }}
      toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
        },
      }}
    />
  )
}
