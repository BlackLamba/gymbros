import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getActiveWorkout, getExercises, getProgressContext, getSplits } from '@/lib/data'
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
  const [workout, library, splits, tz] = await Promise.all([
    getActiveWorkout(),
    getExercises(),
    getSplits(),
    getTimeZone(),
  ])
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
        splitName: workout.splitName,
      }}
      initialExercises={workout.exercises}
      library={library}
      splits={splits}
      contexts={contexts}
      tz={tz}
    />
  )
}
