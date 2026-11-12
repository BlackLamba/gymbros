-- Gymbro's · 1/3 · Таблицы, ограничения, триггеры
-- Выполняется один раз на чистом проекте Supabase (SQL Editor или `supabase db push`).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null
               check (display_name = btrim(display_name) and char_length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exercises — личный список упражнений (не больше 30 на пользователя)
-- ---------------------------------------------------------------------------
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null
             check (name = btrim(name) and char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Название уникально для пользователя без учёта регистра
create unique index exercises_user_name_key on public.exercises (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
create table public.workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  -- Вычисляется базой: не может разойтись с временем начала и окончания
  duration_seconds integer generated always as
                   (extract(epoch from (finished_at - started_at))::integer) stored,
  status           text not null default 'active' check (status in ('active', 'completed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint workouts_finished_matches_status
    check ((status = 'completed') = (finished_at is not null)),
  constraint workouts_finished_after_start
    check (finished_at is null or finished_at >= started_at)
);

create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- Не больше одной активной тренировки на пользователя
create unique index workouts_one_active_per_user
  on public.workouts (user_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- workout_exercises
-- ---------------------------------------------------------------------------
create table public.workout_exercises (
  id                     uuid primary key default gen_random_uuid(),
  workout_id             uuid not null references public.workouts (id) on delete cascade,
  -- Упражнение можно удалить из личного списка: история останется по snapshot-названию
  exercise_id            uuid references public.exercises (id) on delete set null,
  exercise_name_snapshot text not null
                         check (char_length(btrim(exercise_name_snapshot)) between 1 and 60),
  position               integer not null check (position >= 0),
  unique (workout_id, position)
);

create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- workout_sets
-- ---------------------------------------------------------------------------
create table public.workout_sets (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number          integer not null check (set_number >= 1),
  weight              numeric(6, 2) not null check (weight >= 0),   -- кг; 0 = без отягощения
  reps                integer not null check (reps between 1 and 999),
  unique (workout_exercise_id, set_number)
);

-- ---------------------------------------------------------------------------
-- Триггеры
-- ---------------------------------------------------------------------------

-- updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- Лимит: 30 упражнений в личном списке
create function public.enforce_exercise_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.exercises e where e.user_id = new.user_id) >= 30 then
    raise exception 'exercise_limit_reached'
      using hint = 'В личном списке может быть не больше 30 упражнений';
  end if;
  return new;
end;
$$;

create trigger exercises_enforce_limit
  before insert on public.exercises
  for each row execute function public.enforce_exercise_limit();

-- Профиль создаётся автоматически вместе с пользователем.
-- Приложение рассчитано строго на двух человек: третий аккаунт создать нельзя,
-- даже если регистрацию случайно включат в настройках Supabase.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  -- Сериализуем параллельные регистрации, чтобы проверка лимита была надёжной
  lock table public.profiles in share row exclusive mode;

  if (select count(*) from public.profiles) >= 2 then
    raise exception 'user_limit_reached'
      using hint = 'Gymbro''s рассчитан на двух пользователей';
  end if;

  v_name := btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Gymbro'
  ));

  insert into public.profiles (user_id, display_name)
  values (new.id, left(v_name, 40));

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Если пользователи были созданы раньше, чем применена миграция, — создаём им профили
insert into public.profiles (user_id, display_name)
select u.id, left(coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Gymbro'), 40)
from auth.users u
order by u.created_at
limit 2
on conflict (user_id) do nothing;
