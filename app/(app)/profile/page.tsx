import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getExercises, getProfile } from '@/lib/data'
import { MAX_EXERCISES_IN_LIBRARY } from '@/lib/validation'
import { PageTitle } from '@/components/page-title'
import { ExerciseManager } from '@/components/profile/exercise-manager'
import { NameForm } from '@/components/profile/name-form'
import { PasswordForm } from '@/components/profile/password-form'
import { SignOutButton } from '@/components/profile/sign-out-button'
import { ThemeSwitch } from '@/components/profile/theme-switch'
import { Eyebrow, Skeleton } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Профиль' }

export default function ProfilePage() {
  return (
    <>
      <PageTitle title="Профиль" />
      <div className="flex flex-col gap-7">
        <section aria-label="Оформление">
          <Eyebrow className="mb-2">Оформление</Eyebrow>
          <ThemeSwitch />
        </section>
        <Suspense fallback={<ProfileSkeleton />}>
          <Account />
        </Suspense>
      </div>
    </>
  )
}

async function Account() {
  const [profile, exercises] = await Promise.all([getProfile(), getExercises()])
  return (
    <>
      <section aria-label="Имя">
        <Eyebrow className="mb-2">Имя</Eyebrow>
        <NameForm key={profile.displayName} name={profile.displayName} />
      </section>

      <section aria-label="Мои упражнения">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Eyebrow>Мои упражнения</Eyebrow>
          <span className="tabular text-xs font-medium text-muted">
            {exercises.length} из {MAX_EXERCISES_IN_LIBRARY}
          </span>
        </div>
        <ExerciseManager exercises={exercises} />
      </section>

      <section aria-label="Аккаунт">
        <Eyebrow className="mb-2">Аккаунт</Eyebrow>
        {profile.email ? <p className="mb-3 break-all px-1 text-[15px] text-muted">{profile.email}</p> : null}
        <div className="flex flex-col gap-3">
          <PasswordForm />
          <SignOutButton />
        </div>
      </section>
    </>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-busy>
      <Skeleton className="h-16" />
      <Skeleton className="h-64" />
      <Skeleton className="h-32" />
    </div>
  )
}
