'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, Exercise } from '@/lib/types'
import { isUuid } from '@/lib/utils'
import {
  MAX_EXERCISES_IN_LIBRARY,
  MAX_SPLITS,
  displayNameSchema,
  exerciseNameSchema,
  splitInputSchema,
} from '@/lib/validation'

/**
 * Server Actions. Каждое действие само проверяет сессию и входные данные;
 * в базе их дополнительно страхуют RLS и ограничения.
 */

const SESSION_EXPIRED = 'Сессия истекла. Войди заново.'
const GENERIC_ERROR = 'Не получилось сохранить. Проверь соединение и попробуй ещё раз.'

type DbError = { message?: string; code?: string }

function exerciseError(error: DbError): string {
  if (error.message?.includes('exercise_limit_reached')) {
    return `В списке уже ${MAX_EXERCISES_IN_LIBRARY} упражнений — это максимум. Удали ненужное в профиле.`
  }
  if (error.code === '23505') return 'Такое упражнение уже есть в списке.'
  return GENERIC_ERROR
}

// ---------------------------------------------------------------------------
// Вход и выход
// ---------------------------------------------------------------------------

export type FormState = { error?: string; success?: string }

const credentialsSchema = z.object({
  email: z.email('Введите почту'),
  password: z.string().min(1, 'Введите пароль'),
})

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.status === 429) return { error: 'Слишком много попыток. Подожди минуту и попробуй снова.' }
    if (error.status === 400 || error.code === 'invalid_credentials') return { error: 'Неверная почта или пароль.' }
    return { error: 'Не удалось связаться с сервером. Попробуй ещё раз.' }
  }
  // Переход делает браузер полной загрузкой страницы: так в памяти вкладки
  // не остаётся ни формы с паролем, ни экранов предыдущего пользователя.
  return { success: 'signed_in' }
}

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Введите текущий пароль'),
    next: z.string().min(8, 'Новый пароль — не короче 8 символов').max(72, 'Пароль слишком длинный'),
    repeat: z.string(),
  })
  .refine((v) => v.next === v.repeat, { message: 'Пароли не совпадают' })
  .refine((v) => v.next !== v.current, { message: 'Новый пароль совпадает с текущим' })

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session || !session.email) return { error: SESSION_EXPIRED }

  const parsed = passwordSchema.safeParse({
    current: String(formData.get('current') ?? ''),
    next: String(formData.get('next') ?? ''),
    repeat: String(formData.get('repeat') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Подтверждаем текущий пароль, чтобы с чужого разблокированного телефона его нельзя было сменить
  const check = await session.supabase.auth.signInWithPassword({
    email: session.email,
    password: parsed.data.current,
  })
  if (check.error) return { error: 'Текущий пароль неверный.' }

  const { error } = await session.supabase.auth.updateUser({ password: parsed.data.next })
  if (error) {
    if (error.code === 'weak_password') return { error: 'Пароль слишком простой. Придумай посложнее.' }
    return { error: GENERIC_ERROR }
  }
  return { success: 'Пароль изменён.' }
}

// ---------------------------------------------------------------------------
// Профиль
// ---------------------------------------------------------------------------

export async function updateDisplayName(name: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }

  const parsed = displayNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data, error } = await session.supabase
    .from('profiles')
    .update({ display_name: parsed.data })
    .eq('user_id', session.userId)
    .select('id')
  if (error || !data?.length) return { ok: false, error: GENERIC_ERROR }

  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Тренировки
// ---------------------------------------------------------------------------

/** Создаёт активную тренировку (или находит уже идущую) и открывает её экран. */
export async function startWorkout(): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }

  const { error } = await session.supabase.rpc('start_workout')
  if (error) return { ok: false, error: 'Не получилось начать тренировку. Проверь соединение и попробуй ещё раз.' }

  redirect('/workout')
}

export async function deleteWorkout(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }
  if (!isUuid(id)) return { ok: false, error: 'Тренировка не найдена.' }

  const { data, error } = await session.supabase.from('workouts').delete().eq('id', id).select('id')
  if (error) return { ok: false, error: 'Не получилось удалить тренировку. Попробуй ещё раз.' }
  if (!data?.length) return { ok: false, error: 'Тренировка не найдена.' }

  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Личный список упражнений
// ---------------------------------------------------------------------------

const sameName = (a: string, b: string) => a.toLocaleLowerCase('ru') === b.toLocaleLowerCase('ru')

export async function createExercise(name: string): Promise<ActionResult<Exercise>> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }

  const parsed = exerciseNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const existing = await session.supabase.from('exercises').select('id, name')
  if (existing.error) return { ok: false, error: GENERIC_ERROR }
  if (existing.data.some((e) => sameName(e.name as string, parsed.data))) {
    return { ok: false, error: 'Такое упражнение уже есть в списке.' }
  }
  if (existing.data.length >= MAX_EXERCISES_IN_LIBRARY) {
    return { ok: false, error: exerciseError({ message: 'exercise_limit_reached' }) }
  }

  const { data, error } = await session.supabase
    .from('exercises')
    .insert({ name: parsed.data })
    .select('id, name')
    .single()
  if (error) return { ok: false, error: exerciseError(error) }

  refresh()
  return { ok: true, data: data as Exercise }
}

export async function renameExercise(id: string, name: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }
  if (!isUuid(id)) return { ok: false, error: 'Упражнение не найдено.' }

  const parsed = exerciseNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const existing = await session.supabase.from('exercises').select('id, name')
  if (existing.error) return { ok: false, error: GENERIC_ERROR }
  if (existing.data.some((e) => e.id !== id && sameName(e.name as string, parsed.data))) {
    return { ok: false, error: 'Упражнение с таким названием уже есть.' }
  }

  const { data, error } = await session.supabase
    .from('exercises')
    .update({ name: parsed.data })
    .eq('id', id)
    .select('id')
  if (error) return { ok: false, error: exerciseError(error) }
  if (!data?.length) return { ok: false, error: 'Упражнение не найдено.' }

  refresh()
  return { ok: true }
}

export async function deleteExercise(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }
  if (!isUuid(id)) return { ok: false, error: 'Упражнение не найдено.' }

  const { data, error } = await session.supabase.from('exercises').delete().eq('id', id).select('id')
  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!data?.length) return { ok: false, error: 'Упражнение не найдено.' }

  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Сплиты
// ---------------------------------------------------------------------------

function splitError(error: DbError): string {
  const message = error.message ?? ''
  if (message.includes('split_limit_reached')) return `Можно создать не больше ${MAX_SPLITS} сплитов. Удали ненужный.`
  if (message.includes('split_not_found')) return 'Сплит не найден — возможно, он был удалён.'
  if (message.includes('invalid_exercises')) return 'Какого-то упражнения уже нет в твоём списке. Обнови страницу и попробуй ещё раз.'
  if (error.code === '23505') return 'Сплит с таким названием уже есть.'
  return GENERIC_ERROR
}

/** Создаёт сплит (без id) или сохраняет изменения существующего. */
export async function saveSplit(input: {
  id?: string
  name: string
  exerciseIds: string[]
}): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }

  const parsed = splitInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { data, error } = await session.supabase.rpc('save_split', {
    p_split_id: parsed.data.id ?? null,
    p_name: parsed.data.name,
    p_exercise_ids: [...new Set(parsed.data.exerciseIds)],
  })
  if (error) return { ok: false, error: splitError(error) }

  refresh()
  return { ok: true, data: { id: data as string } }
}

export async function deleteSplit(id: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: SESSION_EXPIRED }
  if (!isUuid(id)) return { ok: false, error: 'Сплит не найден.' }

  const { data, error } = await session.supabase.from('splits').delete().eq('id', id).select('id')
  if (error) return { ok: false, error: GENERIC_ERROR }
  if (!data?.length) return { ok: false, error: 'Сплит не найден.' }

  refresh()
  return { ok: true }
}
