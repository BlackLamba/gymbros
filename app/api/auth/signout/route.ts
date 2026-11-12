import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Выход из аккаунта. Обычная отправка формы с полной загрузкой страницы входа:
 * так в памяти вкладки не остаётся экранов и данных вышедшего пользователя.
 */
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && host) {
    let sameSite = false
    try {
      sameSite = new URL(origin).host === host
    } catch {}
    if (!sameSite) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  // scope: 'local' — выходим только на этом устройстве; cookie удаляются даже без связи с Supabase
  await supabase.auth.signOut({ scope: 'local' })

  // Относительный адрес: браузер остаётся на том же домене, с которого пришёл
  return new Response(null, { status: 303, headers: { location: '/login', 'cache-control': 'no-store' } })
}
