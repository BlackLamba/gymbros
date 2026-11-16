-- Gymbro's · 4 · Сплиты и просмотр тренировок друга
--
-- Миграция только ДОБАВЛЯЕТ новое. Существующие таблицы, строки и политики RLS
-- не меняются: каждый по-прежнему читает и правит только свои данные.
--
--   1. workouts.split_name — название сплита, по которому шла тренировка (необязательное)
--   2. таблицы splits и split_exercises — личные сплиты (списки упражнений)
--   3. save_split() — атомарное сохранение сплита
--   4. save_workout() — тот же код + необязательный параметр p_split_name
--   5. friend_display_name(), friend_workouts(), friend_workout() — чтение
--      сохранённых тренировок второго пользователя (только чтение)
--
-- Выполняется одной транзакцией: либо применится целиком, либо не применится вовсе.
-- Применять ДО выкладки новой версии приложения; старая версия с этой схемой работает.

begin;

-- ---------------------------------------------------------------------------
-- 1. Название сплита в тренировке (снимок: переименование сплита историю не меняет)
-- ---------------------------------------------------------------------------
alter table public.workouts
  add column split_name text
  constraint workouts_split_name_check
    check (split_name is null or (split_name = btrim(split_name) and char_length(split_name) between 1 and 40));

-- ---------------------------------------------------------------------------
-- 2. Сплиты
-- ---------------------------------------------------------------------------
create table public.splits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null
             check (name = btrim(name) and char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Название уникально для пользователя без учёта регистра
create unique index splits_user_name_key on public.splits (user_id, lower(name));

create table public.split_exercises (
  split_id    uuid not null references public.splits (id) on delete cascade,
  -- Упражнение удалили из личного списка — оно исчезает и из сплитов
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position    integer not null check (position >= 0),
  primary key (split_id, exercise_id),
  unique (split_id, position)
);

create index split_exercises_exercise_idx on public.split_exercises (exercise_id);

create trigger splits_set_updated_at
  before update on public.splits
  for each row execute function public.set_updated_at();

-- Лимит: 12 сплитов на пользователя
create function public.enforce_split_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.splits s where s.user_id = new.user_id) >= 12 then
    raise exception 'split_limit_reached'
      using hint = 'Можно создать не больше 12 сплитов';
  end if;
  return new;
end;
$$;

create trigger splits_enforce_limit
  before insert on public.splits
  for each row execute function public.enforce_split_limit();

-- RLS: сплиты видит и меняет только владелец
alter table public.splits          enable row level security;
alter table public.split_exercises enable row level security;

revoke all on table public.splits, public.split_exercises from anon, authenticated;
grant select, insert, update, delete on table public.splits, public.split_exercises to authenticated;

create policy splits_select_own on public.splits
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy splits_insert_own on public.splits
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy splits_update_own on public.splits
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy splits_delete_own on public.splits
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy split_exercises_select_own on public.split_exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.splits s
      where s.id = split_exercises.split_id and s.user_id = (select auth.uid())
    )
  );

create policy split_exercises_insert_own on public.split_exercises
  for insert to authenticated
  with check (
    exists (
      select 1 from public.splits s
      where s.id = split_exercises.split_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = split_exercises.exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy split_exercises_update_own on public.split_exercises
  for update to authenticated
  using (
    exists (
      select 1 from public.splits s
      where s.id = split_exercises.split_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.splits s
      where s.id = split_exercises.split_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = split_exercises.exercise_id and e.user_id = (select auth.uid())
    )
  );

create policy split_exercises_delete_own on public.split_exercises
  for delete to authenticated
  using (
    exists (
      select 1 from public.splits s
      where s.id = split_exercises.split_id and s.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. save_split: создаёт или обновляет сплит и заменяет его список упражнений.
--
--   p_split_id     — null для нового сплита
--   p_name         — название
--   p_exercise_ids — упражнения из личного списка; порядок в массиве = порядок в сплите
-- ---------------------------------------------------------------------------
create function public.save_split(
  p_split_id     uuid,
  p_name         text,
  p_exercise_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_id   uuid;
  v_ids  uuid[] := coalesce(p_exercise_ids, '{}');
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if char_length(v_name) not between 1 and 40 then
    raise exception 'invalid_split_name';
  end if;

  if cardinality(v_ids) > 30 then
    raise exception 'too_many_exercises';
  end if;

  -- Все упражнения должны быть своими и не повторяться
  if (select count(distinct e.id) from public.exercises e where e.id = any (v_ids) and e.user_id = v_uid)
     <> cardinality(v_ids) then
    raise exception 'invalid_exercises';
  end if;

  if p_split_id is null then
    insert into public.splits (user_id, name)
    values (v_uid, v_name)
    returning id into v_id;
  else
    update public.splits
    set name = v_name
    where id = p_split_id and user_id = v_uid
    returning id into v_id;

    if v_id is null then
      raise exception 'split_not_found';
    end if;

    delete from public.split_exercises where split_id = v_id;
  end if;

  insert into public.split_exercises (split_id, exercise_id, position)
  select v_id, t.exercise_id, (t.ord - 1)::integer
  from unnest(v_ids) with ordinality as t(exercise_id, ord);

  return v_id;
end;
$$;

revoke all on function public.save_split(uuid, text, uuid[]) from public, anon;
grant execute on function public.save_split(uuid, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. save_workout: прежняя логика + необязательный p_split_name.
--
--   p_split_name — null: название сплита не трогать (так вызывает прежняя версия
--                  приложения и правка сохранённой тренировки);
--                  пустая строка: убрать название; иначе — записать.
-- ---------------------------------------------------------------------------
drop function public.save_workout(uuid, jsonb, text, boolean, timestamptz, timestamptz);

create function public.save_workout(
  p_workout_id    uuid,
  p_exercises     jsonb,
  p_expect_status text default 'active',
  p_finish        boolean default false,
  p_started_at    timestamptz default null,
  p_finished_at   timestamptz default null,
  p_split_name    text default null
)
returns public.workouts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  w          public.workouts;
  v_items    jsonb;
  v_started  timestamptz;
  v_finished timestamptz;
  v_split    text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into w from public.workouts
  where id = p_workout_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'workout_not_found';
  end if;

  if w.status <> p_expect_status then
    raise exception 'workout_status_conflict';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'invalid_payload';
  end if;

  if jsonb_array_length(p_exercises) > 40 then
    raise exception 'too_many_exercises';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_exercises) e
    where jsonb_typeof(coalesce(e -> 'sets', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(e -> 'sets', '[]'::jsonb)) > 50
  ) then
    raise exception 'too_many_sets';
  end if;

  v_split := case
    when p_split_name is null then w.split_name
    else nullif(btrim(left(btrim(p_split_name), 40)), '')
  end;

  -- Присваиваем упражнениям идентификаторы и позиции заранее,
  -- чтобы вставить упражнения и подходы двумя простыми запросами.
  select coalesce(
    jsonb_agg(t.elem || jsonb_build_object('_id', gen_random_uuid(), '_pos', t.ord - 1) order by t.ord),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(p_exercises) with ordinality as t(elem, ord);

  delete from public.workout_exercises where workout_id = w.id;

  insert into public.workout_exercises (id, workout_id, exercise_id, exercise_name_snapshot, position)
  select
    (i ->> '_id')::uuid,
    w.id,
    -- Чужое или уже удалённое упражнение не привязываем: остаётся только название
    (select e.id from public.exercises e
      where e.id = nullif(i ->> 'exercise_id', '')::uuid and e.user_id = v_uid),
    left(btrim(i ->> 'name'), 60),
    (i ->> '_pos')::integer
  from jsonb_array_elements(v_items) as i;

  insert into public.workout_sets (workout_exercise_id, set_number, weight, reps)
  select
    (i ->> '_id')::uuid,
    s.ord::integer,
    (s.elem ->> 'weight')::numeric,
    (s.elem ->> 'reps')::integer
  from jsonb_array_elements(v_items) as i,
       jsonb_array_elements(coalesce(i -> 'sets', '[]'::jsonb)) with ordinality as s(elem, ord);

  if w.status = 'active' then
    if p_finish then
      -- Время окончания приходит с устройства; не даём ему уйти в будущее или раньше начала
      v_finished := least(coalesce(p_finished_at, now()), now());
      if v_finished < w.started_at then
        v_finished := w.started_at;
      end if;

      update public.workouts
      set status = 'completed', finished_at = v_finished, split_name = v_split
      where id = w.id
      returning * into w;
    else
      update public.workouts
      set updated_at = now(), split_name = v_split
      where id = w.id
      returning * into w;
    end if;
  else
    v_started  := coalesce(p_started_at, w.started_at);
    v_finished := coalesce(p_finished_at, w.finished_at);

    if v_finished < v_started or v_finished > now() + interval '5 minutes' then
      raise exception 'invalid_time_range';
    end if;

    update public.workouts
    set started_at = v_started, finished_at = v_finished, split_name = v_split
    where id = w.id
    returning * into w;
  end if;

  return w;
end;
$$;

revoke all on function public.save_workout(uuid, jsonb, text, boolean, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.save_workout(uuid, jsonb, text, boolean, timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Тренировки друга — только чтение.
--
-- Политики RLS остаются прежними («вижу только своё»), поэтому история, календарь
-- и прогресс не смешиваются с чужими данными. Чужие СОХРАНЁННЫЕ тренировки отдают
-- только эти три функции. Они выполняются с правами владельца (SECURITY DEFINER),
-- сами проверяют, что вызывающий вошёл в аккаунт, и ничего не изменяют.
-- В приложении ровно два пользователя, поэтому «друг» — это второй аккаунт.
-- ---------------------------------------------------------------------------

-- Имя второго пользователя (null, пока второй аккаунт не создан)
create function public.friend_display_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name
  from public.profiles p
  where (select auth.uid()) is not null
    and p.user_id <> (select auth.uid())
  order by p.created_at
  limit 1;
$$;

-- Список сохранённых тренировок друга, от новых к старым:
--   [{ id, started_at, finished_at, duration_seconds, split_name, exercise_names: [text], sets_count }]
create function public.friend_workouts(p_limit integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at desc), '[]'::jsonb)
  from (
    select
      w.id,
      w.started_at,
      w.finished_at,
      w.duration_seconds,
      w.split_name,
      coalesce(
        (select jsonb_agg(we.exercise_name_snapshot order by we.position)
         from public.workout_exercises we
         where we.workout_id = w.id),
        '[]'::jsonb
      ) as exercise_names,
      (select count(*)
       from public.workout_sets s
       join public.workout_exercises we on we.id = s.workout_exercise_id
       where we.workout_id = w.id)::integer as sets_count
    from public.workouts w
    where (select auth.uid()) is not null
      and w.user_id <> (select auth.uid())
      and w.status = 'completed'
    order by w.started_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 601)
  ) t;
$$;

-- Одна сохранённая тренировка друга целиком (null, если такой нет, она своя или ещё идёт):
--   { id, status, started_at, finished_at, duration_seconds, updated_at, split_name,
--     workout_exercises: [{ id, exercise_id: null, exercise_name_snapshot, position,
--                           workout_sets: [{ set_number, weight, reps }] }] }
create function public.friend_workout(p_workout_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',               w.id,
    'status',           w.status,
    'started_at',       w.started_at,
    'finished_at',      w.finished_at,
    'duration_seconds', w.duration_seconds,
    'updated_at',       w.updated_at,
    'split_name',       w.split_name,
    'workout_exercises', coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'id',                     we.id,
           'exercise_id',            null,
           'exercise_name_snapshot', we.exercise_name_snapshot,
           'position',               we.position,
           'workout_sets', coalesce(
             (select jsonb_agg(
                jsonb_build_object('set_number', s.set_number, 'weight', s.weight, 'reps', s.reps)
                order by s.set_number)
              from public.workout_sets s
              where s.workout_exercise_id = we.id),
             '[]'::jsonb
           )
         )
         order by we.position)
       from public.workout_exercises we
       where we.workout_id = w.id),
      '[]'::jsonb
    )
  )
  from public.workouts w
  where (select auth.uid()) is not null
    and w.id = p_workout_id
    and w.user_id <> (select auth.uid())
    and w.status = 'completed';
$$;

revoke all on function public.friend_display_name() from public, anon;
revoke all on function public.friend_workouts(integer) from public, anon;
revoke all on function public.friend_workout(uuid) from public, anon;

grant execute on function public.friend_display_name() to authenticated;
grant execute on function public.friend_workouts(integer) to authenticated;
grant execute on function public.friend_workout(uuid) to authenticated;

commit;

-- API Supabase сразу увидит новые функции и таблицы
notify pgrst, 'reload schema';
