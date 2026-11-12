import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getActiveWorkout, getExercises, getProgressContext } from '@/lib/data'
import { getTimeZone } from '@/lib/tz'
import { EditorSkeleton, WorkoutEditor } from '@/components/workout/workout-editor'

export const metadata: Metadata = { title: 'Тренировка' }

export default function ActiveWorkoutPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <ActiveWorkout />
    </Suspense>
  )
}

async function ActiveWorkout() {
  const [workout, library, tz] = await Promise.all([getActiveWorkout(), getExercises(), getTimeZone()])
  if (!workout) redirect('/')

  // История нужна по всему личному списку: подсказка «в прошлый раз» видна уже при выборе упражнения
  const contexts = await getProgressContext(library.map((e) => e.id))

  return (
    <WorkoutEditor
      key={workout.id}
      mode="active"
      workout={{
        id: workout.id,
        startedAt: workout.startedAt,
        finishedAt: workout.finishedAt,
        updatedAt: workout.updatedAt,
      }}
      initialExercises={workout.exercises}
      library={library}
      contexts={contexts}
      tz={tz}
    />
  )
}
