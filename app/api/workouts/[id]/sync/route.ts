import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isUuid } from '@/lib/utils'
import { syncRequestSchema } from '@/lib/validation'

/**
 * Синхронизация тренировки: принимает снимок целиком и атомарно заменяет им
 * содержимое в базе. Запрос идемпотентен — его безопасно повторять после обрыва сети.
 *
 * Используется и для автосохранения активной тренировки (в том числе запросом
 * с keepalive при закрытии вкладки), и для завершения, и для правки сохранённой.
 */
export async function POST(request: Request, context: RouteContext<'/api/workouts/[id]/sync'>) {
  // Запросы с чужих сайтов не принимаем (в дополнение к SameSite-cookie)
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: 'forbidden' }, 403)
    } catch {
      return json({ error: 'forbidden' }, 403)
    }
  }

  const { id } = await context.params
  if (!isUuid(id)) return json({ error: 'not_found' }, 404)

  const session = await getSession()
  if (!session) return json({ error: 'unauthorized' }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const parsed = syncRequestSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'invalid_payload' }, 400)
  const input = parsed.data

  const { data, error } = await session.supabase.rpc('save_workout', {
    p_workout_id: id,
    p_exercises: input.exercises,
    p_expect_status: input.expect,
    p_finish: input.finish ?? false,
    p_started_at: input.startedAt ?? null,
    p_finished_at: input.finishedAt ?? null,
  })

  if (error) {
    const message = error.message ?? ''
    if (message.includes('workout_not_found')) return json({ error: 'not_found' }, 404)
    if (message.includes('workout_status_conflict')) return json({ error: 'status_conflict' }, 409)
    if (message.includes('invalid_time_range')) return json({ error: 'invalid_time_range' }, 422)
    if (message.includes('not_authenticated')) return json({ error: 'unauthorized' }, 401)
    console.error('save_workout failed', error)
    return json({ error: 'server_error' }, 500)
  }

  return json({
    ok: true,
    status: data.status,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    updatedAt: data.updated_at,
  })
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}
