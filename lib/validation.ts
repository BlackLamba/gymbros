import { z } from 'zod'

export const MAX_EXERCISES_IN_LIBRARY = 30
export const MAX_EXERCISES_IN_WORKOUT = 40
export const MAX_SETS_PER_EXERCISE = 50
export const MAX_WEIGHT = 999.99
export const MAX_REPS = 999

export const exerciseNameSchema = z
  .string()
  .trim()
  .min(1, 'Введите название упражнения')
  .max(60, 'Название не длиннее 60 символов')

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Введите имя')
  .max(40, 'Имя не длиннее 40 символов')

const setSchema = z.object({
  weight: z.number().min(0).max(MAX_WEIGHT),
  reps: z.number().int().min(1).max(MAX_REPS),
})

const payloadExerciseSchema = z.object({
  exercise_id: z.uuid().nullable(),
  name: exerciseNameSchema,
  sets: z.array(setSchema).max(MAX_SETS_PER_EXERCISE),
})

/** Тело запроса синхронизации тренировки. */
export const syncRequestSchema = z.object({
  exercises: z.array(payloadExerciseSchema).max(MAX_EXERCISES_IN_WORKOUT),
  expect: z.enum(['active', 'completed']),
  finish: z.boolean().optional(),
  startedAt: z.iso.datetime({ offset: true }).optional(),
  finishedAt: z.iso.datetime({ offset: true }).optional(),
})

export type SyncRequest = z.infer<typeof syncRequestSchema>
