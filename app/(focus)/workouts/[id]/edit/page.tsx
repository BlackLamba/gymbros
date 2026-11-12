import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getExercises, getProgressContext, getWorkout } from '@/lib/data'
import { getTimeZone } from '@/lib/tz'
import { isUuid } from '@/lib/utils'
import { EditorSkeleton, WorkoutEditor } from '@/components/workout/workout-editor'

export const metadata: Metadata = { title: 'Редактирование тренировки' }

export default function EditWorkoutPage({ params }: PageProps<'/workouts/[id]/edit'>) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditWorkout params={params} />
    </Suspense>
  )
}

async function EditWorkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [workout, library, tz] = await Promise.all([getWorkout(id), getExercises(), getTimeZone()])
  if (!workout) notFound()
  if (workout.status === 'active') redirect('/workout')

  // Подсказки — по тренировкам, которые были раньше редактируемой
  const contexts = await getProgressContext(
    library.map((e) => e.id),
    workout.startedAt,
  )

  return (
    <WorkoutEditor
      key={`${workout.id}:${workout.updatedAt}`}
      mode="edit"
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
