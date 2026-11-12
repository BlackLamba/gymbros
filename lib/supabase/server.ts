import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from '@/lib/env'
import { authCookieOptions } from '@/lib/supabase/cookie-options'

/**
 * Клиент Supabase для Server Components, Server Actions и Route Handlers.
 * Создаётся на каждый запрос и работает от имени вошедшего пользователя (RLS действует).
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseEnv()

  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Вызов из Server Component: куки там записать нельзя.
          // Это нормально — сессию обновляет proxy.ts.
        }
      },
    },
  })
}
