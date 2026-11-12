'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { TIME_ZONE_COOKIE } from '@/lib/dates'

/**
 * Сообщает серверу часовой пояс устройства (через cookie), чтобы даты,
 * календарь и «этот месяц» считались по местному времени пользователя.
 */
export function TimeZoneSync() {
  const router = useRouter()

  useEffect(() => {
    let tz: string
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return
    }
    if (!tz) return
    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1)
    if (current && decodeURIComponent(current) === tz) return
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }, [router])

  return null
}
