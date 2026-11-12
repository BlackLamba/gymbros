import 'server-only'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE, isValidTimeZone } from '@/lib/dates'

/** Часовой пояс устройства: записывается в cookie компонентом <TimeZoneSync />. */
export async function getTimeZone(): Promise<string> {
  // Пояс нужен вместе с текущим временем, а оно известно только во время настоящего запроса
  await connection()
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value
  const decoded = value ? decodeURIComponent(value) : undefined
  return isValidTimeZone(decoded) ? decoded : DEFAULT_TIME_ZONE
}
