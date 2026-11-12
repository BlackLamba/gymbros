'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 1000)
  document.addEventListener('visibilitychange', onChange)
  window.addEventListener('focus', onChange)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onChange)
    window.removeEventListener('focus', onChange)
  }
}

const getSnapshot = () => Math.floor(Date.now() / 1000)
const getServerSnapshot = () => null

/**
 * Текущее время в секундах (null на сервере и до гидратации).
 * Таймер тренировки не «тикает» счётчиком, а каждый раз вычисляется как
 * «сейчас − время начала», поэтому блокировка экрана и сон вкладки ему не мешают.
 */
export function useNowSeconds(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

const noop = () => () => {}

/** true только в браузере после гидратации. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}
