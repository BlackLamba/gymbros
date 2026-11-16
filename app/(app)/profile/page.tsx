import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChevronRight } from 'lucide-react'
import { getExercises, getFriendName, getProfile, getSplits } from '@/lib/data'
import { MAX_EXERCISES_IN_LIBRARY, MAX_SPLITS } from '@/lib/validation'
import { PageTitle } from '@/components/page-title'
import { ExerciseManager } from '@/components/profile/exercise-manager'
import { NameForm } from '@/components/profile/name-form'
import { PasswordForm } from '@/components/profile/password-form'
import { SignOutButton } from '@/components/profile/sign-out-button'
import { SplitManager } from '@/components/profile/split-manager'
import { ThemeSwitch } from '@/components/profile/theme-switch'
import { Eyebrow, Skeleton } from '@/components/ui/card'
import { Collapsible } from '@/components/ui/collapsible'

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
  const [profile, exercises, splits, friendName] = await Promise.all([
    getProfile(),
    getExercises(),
    getSplits(),
    getFriendName(),
  ])
  return (
    <>
      <section aria-label="Имя">
        <Eyebrow className="mb-2">Имя</Eyebrow>
        <NameForm key={profile.displayName} name={profile.displayName} />
      </section>

      <section aria-label="Сплиты">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Eyebrow>Сплиты</Eyebrow>
          <span className="tabular text-xs font-medium text-muted">
            {splits.length} из {MAX_SPLITS}
          </span>
        </div>
        <SplitManager splits={splits} exercises={exercises} />
      </section>

      <section aria-label="Мои упражнения">
        <Eyebrow className="mb-2">Упражнения</Eyebrow>
        <Collapsible title="Мои упражнения" meta={`${exercises.length} из ${MAX_EXERCISES_IN_LIBRARY}`}>
          <ExerciseManager exercises={exercises} />
        </Collapsible>
      </section>

      {friendName ? (
        <section aria-label="Друг">
          <Eyebrow className="mb-2">Друг</Eyebrow>
          <Link
            href="/friend"
            className="flex min-h-16 items-center gap-3 rounded-3xl border border-border bg-surface px-4 py-3 transition-colors active:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[17px] font-semibold leading-snug">Тренировки: {friendName}</span>
              <span className="mt-0.5 block text-sm text-muted">Только просмотр</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" />
          </Link>
        </section>
      ) : null}

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
      <Skeleton className="h-40" />
      <Skeleton className="h-16" />
      <Skeleton className="h-32" />
    </div>
  )
}
