export type WorkoutStatus = 'active' | 'completed'

export type SetValue = {
  weight: number
  reps: number
}

export type WorkoutExercise = {
  id: string
  exerciseId: string | null
  name: string
  sets: SetValue[]
}

export type Workout = {
  id: string
  status: WorkoutStatus
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
  /** Метка последнего изменения на сервере — по ней черновик на устройстве понимает, актуален ли он */
  updatedAt: string
  /** Название сплита, по которому шла тренировка (снимок на момент тренировки) */
  splitName: string | null
  exercises: WorkoutExercise[]
}

/** Короткая запись для списков (история, календарь). */
export type WorkoutSummary = {
  id: string
  startedAt: string
  finishedAt: string | null
  durationSeconds: number | null
  splitName: string | null
  exerciseNames: string[]
  setsCount: number
}

export type Exercise = {
  id: string
  name: string
}

/** Сплит — именованный список упражнений из личного списка, в нужном порядке. */
export type Split = {
  id: string
  name: string
  exercises: Exercise[]
}

/** Всё, что известно об упражнении по прошлым завершённым тренировкам. */
export type ExerciseContext = {
  exerciseId: string
  workoutsCount: number
  maxWeight: number
  maxVolume: number
  repsByWeight: { weight: number; maxReps: number }[]
  last: {
    workoutId: string
    startedAt: string
    sets: SetValue[]
  }
}

export type WeightRecord = {
  exerciseId: string
  exerciseName: string
  workoutId: string
  startedAt: string
  weight: number
  previous: number
}

export type ExerciseStatPoint = {
  workoutId: string
  startedAt: string
  setsCount: number
  totalReps: number
  volume: number
  topWeight: number
}

/** Снимок тренировки, который уходит на сервер. */
export type WorkoutPayloadExercise = {
  exercise_id: string | null
  name: string
  sets: SetValue[]
}

export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string }
