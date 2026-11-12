import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Проверенная сессия текущего запроса (или null).
 * getClaims() проверяет подпись токена, а не просто читает cookie.
 */
export const getSession = cache(async () => {
  // Сессия проверяется только во время настоящего запроса и никогда не попадает в заранее собранную оболочку страницы
  await connection()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  if (error || !sub) return null
  return {
    supabase,
    userId: sub,
    email: typeof data.claims.email === 'string' ? data.claims.email : null,
  }
})

/** Для страниц: гость отправляется на /login. */
export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
