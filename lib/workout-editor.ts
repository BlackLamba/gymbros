import type { Exercise, ExerciseContext, SetValue, WorkoutExercise, WorkoutPayloadExercise } from '@/lib/types'
import { MAX_REPS, MAX_WEIGHT } from '@/lib/validation'

/**
 * Состояние редактора тренировки. Значения полей хранятся строками — ровно так,
 * как их набрал пользователь; в числа они превращаются только при отправке.
 */

export type EditorSet = { id: string; weight: string; reps: string }

export type EditorExercise = {
  id: string
  exerciseId: string | null
  name: string
  sets: EditorSet[]
}

export const WEIGHT_STEP = 2.5

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 72.5 → «72,5» (в русской раскладке десятичный разделитель — запятая). */
export function weightToInput(weight: number): string {
  return String(Math.round(weight * 100) / 100).replace('.', ',')
}

/** Оставляет в поле веса только цифры и один разделитель, не больше двух знаков после него. */
export function sanitizeWeightInput(raw: string): string {
  let out = ''
  let separator = false
  let decimals = 0
  let integers = 0
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (separator) {
        if (decimals < 2) {
          out += ch
          decimals++
        }
      } else if (integers < 3) {
        out += ch
        integers++
      }
    } else if ((ch === ',' || ch === '.') && !separator) {
      separator = true
      out += out === '' ? '0,' : ','
    }
  }
  return out
}

export function sanitizeRepsInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 3)
}

/** Пустое поле веса означает «без отягощения» (0 кг). null — значение некорректно. */
export function parseWeight(input: string): number | null {
  const text = input.trim().replace(',', '.')
  if (text === '') return 0
  if (!/^\d{1,3}(\.\d{0,2})?$/.test(text)) return null
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > MAX_WEIGHT) return null
  return Math.round(value * 100) / 100
}

export function parseReps(input: string): number | null {
  const text = input.trim()
  if (!/^\d{1,3}$/.test(text)) return null
  const value = Number(text)
  if (value < 1 || value > MAX_REPS) return null
  return value
}

/** Подход заполнен, если указаны повторения (вес может быть пустым). */
export function toSetValue(set: EditorSet): SetValue | null {
  const weight = parseWeight(set.weight)
  const reps = parseReps(set.reps)
  if (weight === null || reps === null) return null
  return { weight, reps }
}

export function fromWorkout(exercises: WorkoutExercise[]): EditorExercise[] {
  return exercises.map((e) => ({
    id: e.id,
    exerciseId: e.exerciseId,
    name: e.name,
    sets: e.sets.map((s) => ({
      id: newId(),
      weight: s.weight > 0 ? weightToInput(s.weight) : '',
      reps: String(s.reps),
    })),
  }))
}

/** Снимок для сервера: только заполненные подходы, порядок как на экране. */
export function toPayload(exercises: EditorExercise[]): WorkoutPayloadExercise[] {
  return exercises.map((e) => ({
    exercise_id: e.exerciseId,
    name: e.name,
    sets: e.sets.map(toSetValue).filter((s): s is SetValue => s !== null),
  }))
}

export type WorkoutTotals = {
  exercises: number
  sets: number
  reps: number
  volume: number
  incompleteSets: number
}

export function totalsOf(exercises: EditorExercise[]): WorkoutTotals {
  const totals: WorkoutTotals = { exercises: 0, sets: 0, reps: 0, volume: 0, incompleteSets: 0 }
  for (const exercise of exercises) {
    let filled = 0
    for (const set of exercise.sets) {
      const value = toSetValue(set)
      if (!value) {
        totals.incompleteSets++
        continue
      }
      filled++
      totals.sets++
      totals.reps += value.reps
      totals.volume += value.weight * value.reps
    }
    if (filled > 0) totals.exercises++
  }
  return totals
}

/**
 * Значения для нового подхода — чтобы чаще всего оставалось поправить одно число:
 *  1) тот же по счёту подход из прошлой тренировки;
 *  2) иначе — копия предыдущего подхода;
 *  3) иначе — пустые поля.
 */
export function nextSetDefaults(
  exercise: EditorExercise,
  context: ExerciseContext | undefined,
): { weight: string; reps: string } {
  const index = exercise.sets.length
  const fromLast = context?.last.sets[index]
  if (fromLast) {
    return { weight: fromLast.weight > 0 ? weightToInput(fromLast.weight) : '', reps: String(fromLast.reps) }
  }
  const previous = exercise.sets[index - 1]
  if (previous) return { weight: previous.weight, reps: previous.reps }
  return { weight: '', reps: '' }
}

export function stepWeight(input: string, direction: 1 | -1): string {
  const current = parseWeight(input) ?? 0
  const next = Math.min(MAX_WEIGHT, Math.max(0, current + direction * WEIGHT_STEP))
  return next > 0 ? weightToInput(next) : ''
}

export function stepReps(input: string, direction: 1 | -1): string {
  const current = parseReps(input) ?? 0
  const next = Math.min(MAX_REPS, Math.max(1, current + direction))
  return String(next)
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Загрузка сплита в тренировку: упражнения сплита добавляются в конец в его порядке.
 * Те, что уже есть в тренировке, не дублируются. Подходы не создаются: записывается
 * только то, что человек действительно сделал («+ Подход» подставит прошлый результат).
 */
export function addSplitExercises(
  current: EditorExercise[],
  splitExercises: Exercise[],
  maxExercises: number,
): { exercises: EditorExercise[]; added: number; skipped: number } {
  const present = new Set(current.map((e) => e.exerciseId).filter((id): id is string => id !== null))
  const missing = splitExercises.filter((e, i, all) => !present.has(e.id) && all.findIndex((x) => x.id === e.id) === i)
  const room = Math.max(0, maxExercises - current.length)
  const toAdd = missing.slice(0, room)
  if (toAdd.length === 0) return { exercises: current, added: 0, skipped: missing.length }
  return {
    exercises: [...current, ...toAdd.map((e) => ({ id: newId(), exerciseId: e.id, name: e.name, sets: [] }))],
    added: toAdd.length,
    skipped: missing.length - toAdd.length,
  }
}

/** В запись попадают только упражнения, в которых есть хотя бы один заполненный подход. */
export function toFinalPayload(exercises: EditorExercise[]): WorkoutPayloadExercise[] {
  return toPayload(exercises).filter((e) => e.sets.length > 0)
}
