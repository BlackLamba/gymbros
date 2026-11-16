import 'server-only'
import { requireSession } from '@/lib/auth'
import type {
  Exercise,
  ExerciseContext,
  ExerciseStatPoint,
  Split,
  WeightRecord,
  Workout,
  WorkoutSummary,
} from '@/lib/types'

/**
 * Слой чтения данных. Каждая функция начинается с проверки сессии,
 * а запросы выполняются от имени пользователя — RLS отдаёт только его строки.
 */

type SetRow = { set_number: number; weight: number | string; reps: number }
type WorkoutExerciseRow = {
  id: string
  exercise_id: string | null
  exercise_name_snapshot: string
  position: number
  workout_sets: SetRow[]
}
type WorkoutRow = {
  id: string
  status: 'active' | 'completed'
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  updated_at: string
  split_name: string | null
  workout_exercises: WorkoutExerciseRow[]
}

const WORKOUT_SELECT =
  'id, status, started_at, finished_at, duration_seconds, updated_at, split_name, workout_exercises(id, exercise_id, exercise_name_snapshot, position, workout_sets(set_number, weight, reps))'

const SUMMARY_SELECT =
  'id, started_at, finished_at, duration_seconds, split_name, workout_exercises(exercise_name_snapshot, position, workout_sets(id))'

function fail(scope: string, error: { message: string }): never {
  throw new Error(`Не удалось загрузить данные (${scope}): ${error.message}`)
}

function mapWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    updatedAt: row.updated_at,
    splitName: row.split_name ?? null,
    exercises: [...row.workout_exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        name: e.exercise_name_snapshot,
        sets: [...e.workout_sets]
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({ weight: Number(s.weight), reps: s.reps })),
      })),
  }
}

type SummaryRow = {
  id: string
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  split_name: string | null
  workout_exercises: { exercise_name_snapshot: string; position: number; workout_sets: { id: string }[] }[]
}

function mapSummary(row: SummaryRow): WorkoutSummary {
  const exercises = [...row.workout_exercises].sort((a, b) => a.position - b.position)
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    splitName: row.split_name ?? null,
    exerciseNames: exercises.map((e) => e.exercise_name_snapshot),
    setsCount: exercises.reduce((n, e) => n + e.workout_sets.length, 0),
  }
}

export async function getProfile() {
  const { supabase, userId, email } = await requireSession()
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) fail('профиль', error)
  return { displayName: (data?.display_name as string | undefined) ?? 'Gymbro', email }
}

export async function getExercises(): Promise<Exercise[]> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.from('exercises').select('id, name').order('name')
  if (error) fail('упражнения', error)
  return (data ?? []) as Exercise[]
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.from('exercises').select('id, name').eq('id', id).maybeSingle()
  if (error) fail('упражнение', error)
  return (data as Exercise | null) ?? null
}

export async function getActiveWorkout(): Promise<Workout | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .eq('status', 'active')
    .maybeSingle()
  if (error) fail('активная тренировка', error)
  return data ? mapWorkout(data as unknown as WorkoutRow) : null
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.from('workouts').select(WORKOUT_SELECT).eq('id', id).maybeSingle()
  if (error) fail('тренировка', error)
  return data ? mapWorkout(data as unknown as WorkoutRow) : null
}

export async function getLastCompletedWorkout(): Promise<Workout | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) fail('последняя тренировка', error)
  return data ? mapWorkout(data as unknown as WorkoutRow) : null
}

/** Завершённые тренировки, от новых к старым. */
export async function listWorkouts(limit: number): Promise<{ items: WorkoutSummary[]; hasMore: boolean }> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('workouts')
    .select(SUMMARY_SELECT)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .range(0, limit) // на одну больше, чтобы узнать, есть ли продолжение
  if (error) fail('история', error)
  const rows = (data ?? []) as unknown as SummaryRow[]
  return { items: rows.slice(0, limit).map(mapSummary), hasMore: rows.length > limit }
}

/** Завершённые тренировки, начатые в интервале [start, end). */
export async function getWorkoutsBetween(start: Date, end: Date): Promise<WorkoutSummary[]> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('workouts')
    .select(SUMMARY_SELECT)
    .eq('status', 'completed')
    .gte('started_at', start.toISOString())
    .lt('started_at', end.toISOString())
    .order('started_at', { ascending: true })
  if (error) fail('тренировки за период', error)
  return ((data ?? []) as unknown as SummaryRow[]).map(mapSummary)
}

/** Длительность предыдущей завершённой тренировки (для нейтрального сравнения). */
export async function getPreviousDuration(before: string): Promise<number | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('workouts')
    .select('duration_seconds')
    .eq('status', 'completed')
    .lt('started_at', before)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) fail('предыдущая тренировка', error)
  return (data?.duration_seconds as number | null | undefined) ?? null
}

type ContextRow = {
  exercise_id: string
  workouts_count: number
  max_weight: number
  max_volume: number
  reps_by_weight: { weight: number; max_reps: number }[]
  last: { workout_id: string; started_at: string; sets: { weight: number; reps: number }[] }
}

/**
 * История по упражнениям до момента `before` (по умолчанию — вся).
 * Учитываются только завершённые тренировки.
 */
export async function getProgressContext(
  exerciseIds: string[],
  before?: string,
): Promise<Record<string, ExerciseContext>> {
  const ids = [...new Set(exerciseIds)]
  if (ids.length === 0) return {}
  const { supabase } = await requireSession()
  const { data, error } = await supabase.rpc('progress_context', {
    p_exercise_ids: ids,
    ...(before ? { p_before: before } : {}),
  })
  if (error) fail('прогресс', error)
  const out: Record<string, ExerciseContext> = {}
  for (const row of (data ?? []) as ContextRow[]) {
    out[row.exercise_id] = {
      exerciseId: row.exercise_id,
      workoutsCount: Number(row.workouts_count),
      maxWeight: Number(row.max_weight),
      maxVolume: Number(row.max_volume),
      repsByWeight: row.reps_by_weight.map((r) => ({ weight: Number(r.weight), maxReps: Number(r.max_reps) })),
      last: {
        workoutId: row.last.workout_id,
        startedAt: row.last.started_at,
        sets: row.last.sets.map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) })),
      },
    }
  }
  return out
}

export async function getRecentRecords(limit: number): Promise<WeightRecord[]> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('weight_records')
    .select('exercise_id, exercise_name, workout_id, started_at, top_weight, prev_best')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) fail('рекорды', error)
  return (data ?? []).map((r) => ({
    exerciseId: r.exercise_id as string,
    exerciseName: r.exercise_name as string,
    workoutId: r.workout_id as string,
    startedAt: r.started_at as string,
    weight: Number(r.top_weight),
    previous: Number(r.prev_best),
  }))
}

/** Точки для графика динамики: последние `limit` тренировок с упражнением, по возрастанию даты. */
export async function getExerciseStats(exerciseId: string, limit = 60): Promise<ExerciseStatPoint[]> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('workout_exercise_stats')
    .select('workout_id, started_at, sets_count, total_reps, volume, top_weight')
    .eq('exercise_id', exerciseId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) fail('динамика', error)
  return (data ?? [])
    .map((r) => ({
      workoutId: r.workout_id as string,
      startedAt: r.started_at as string,
      setsCount: Number(r.sets_count),
      totalReps: Number(r.total_reps),
      volume: Number(r.volume),
      topWeight: Number(r.top_weight),
    }))
    .reverse()
}

// ---------------------------------------------------------------------------
// Сплиты
// ---------------------------------------------------------------------------

type SplitRow = {
  id: string
  name: string
  split_exercises: { position: number; exercises: { id: string; name: string } | null }[]
}

/** Сплиты пользователя в порядке создания; упражнения — в порядке, заданном в сплите. */
export async function getSplits(): Promise<Split[]> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase
    .from('splits')
    .select('id, name, split_exercises(position, exercises(id, name))')
    .order('created_at', { ascending: true })
  if (error) fail('сплиты', error)
  return ((data ?? []) as unknown as SplitRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    exercises: [...row.split_exercises]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.exercises)
      .filter((e): e is Exercise => e !== null),
  }))
}

// ---------------------------------------------------------------------------
// Тренировки друга — только чтение.
// Обычные запросы отдают лишь свои строки (RLS); чужие сохранённые тренировки
// приходят только через отдельные функции базы friend_*.
// ---------------------------------------------------------------------------

/** Имя второго пользователя или null, если второго аккаунта ещё нет. */
export async function getFriendName(): Promise<string | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.rpc('friend_display_name')
  if (error) fail('имя друга', error)
  return typeof data === 'string' && data ? data : null
}

type FriendSummaryRow = {
  id: string
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  split_name: string | null
  exercise_names: string[]
  sets_count: number
}

export async function listFriendWorkouts(limit: number): Promise<{ items: WorkoutSummary[]; hasMore: boolean }> {
  const { supabase } = await requireSession()
  // на одну больше, чтобы узнать, есть ли продолжение
  const { data, error } = await supabase.rpc('friend_workouts', { p_limit: limit + 1 })
  if (error) fail('тренировки друга', error)
  const rows = (Array.isArray(data) ? data : []) as FriendSummaryRow[]
  return {
    items: rows.slice(0, limit).map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationSeconds: row.duration_seconds,
      splitName: row.split_name ?? null,
      exerciseNames: row.exercise_names ?? [],
      setsCount: Number(row.sets_count),
    })),
    hasMore: rows.length > limit,
  }
}

export async function getFriendWorkout(id: string): Promise<Workout | null> {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.rpc('friend_workout', { p_workout_id: id })
  if (error) fail('тренировка друга', error)
  return data ? mapWorkout(data as WorkoutRow) : null
}
