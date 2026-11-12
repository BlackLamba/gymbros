-- Gymbro's · 2/3 · Права и Row Level Security
-- Принцип: гость (anon) не видит ничего; вошедший пользователь — только свои строки.

alter table public.profiles          enable row level security;
alter table public.exercises         enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets      enable row level security;

-- Права задаём явно, не полагаясь на настройки проекта по умолчанию
revoke all on table
  public.profiles, public.exercises, public.workouts,
  public.workout_exercises, public.workout_sets
from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, insert, update, delete on table
  public.exercises, public.workouts, public.workout_exercises, public.workout_sets
to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: читать и переименовывать можно только себя.
-- Создаёт профиль триггер, удаляется он вместе с пользователем.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------
create policy exercises_select_own on public.exercises
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy exercises_update_own on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
create policy workouts_select_own on public.workouts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy workouts_insert_own on public.workouts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy workouts_update_own on public.workouts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy workouts_delete_own on public.workouts
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workout_exercises: доступ через владельца тренировки.
-- Привязать можно только упражнение из собственного списка.
-- ---------------------------------------------------------------------------
create policy workout_exercises_select_own on public.workout_exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
  );

create policy workout_exercises_insert_own on public.workout_exercises
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
    and (
      workout_exercises.exercise_id is null
      or exists (
        select 1 from public.exercises e
        where e.id = workout_exercises.exercise_id and e.user_id = (select auth.uid())
      )
    )
  );

create policy workout_exercises_update_own on public.workout_exercises
  for update to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
    and (
      workout_exercises.exercise_id is null
      or exists (
        select 1 from public.exercises e
        where e.id = workout_exercises.exercise_id and e.user_id = (select auth.uid())
      )
    )
  );

create policy workout_exercises_delete_own on public.workout_exercises
  for delete to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- workout_sets: доступ через упражнение → тренировку
-- ---------------------------------------------------------------------------
create policy workout_sets_select_own on public.workout_sets
  for select to authenticated
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = (select auth.uid())
    )
  );

create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = (select auth.uid())
    )
  );

create policy workout_sets_update_own on public.workout_sets
  for update to authenticated
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = (select auth.uid())
    )
  );

create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated
  using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = (select auth.uid())
    )
  );
