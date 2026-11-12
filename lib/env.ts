import 'server-only'

/**
 * Переменные окружения читаются только на сервере.
 * Браузер к Supabase напрямую не обращается, поэтому префикс NEXT_PUBLIC_ не нужен.
 */
export function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error(
      'Не заданы SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY. Скопируйте .env.example в .env.local и заполните значения.',
    )
  }
  return { url, key }
}
