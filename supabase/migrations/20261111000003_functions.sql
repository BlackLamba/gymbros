-- Gymbro's · 3/3 · Функции и представления
-- Все функции — SECURITY INVOKER: выполняются с правами вызывающего, RLS действует внутри.

-- ---------------------------------------------------------------------------
-- start_workout: создаёт активную тренировку или возвращает уже идущую
-- ---------------------------------------------------------------------------
create function public.start_workout()
returns public.workouts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  w public.workouts;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into w from public.workouts
  where user_id = v_uid and status = 'active';
  if found then
    return w;
  end if;

  begin
    insert into public.workouts (user_id, started_at, status)
    values (v_uid, now(), 'active')
    returning * into w;
  exception when unique_violation then
    -- Два одновременных нажатия «Начать»: побеждает первое, второе получает ту же тренировку
    select * into w from public.workouts
    where user_id = v_uid and status = 'active';
  end;

  return w;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_workout: атомарно заменяет содержимое тренировки снимком.
--
--   p_exercises     — [{ "exercise_id": uuid|null, "name": text,
--                        "sets": [{ "weight": number, "reps": number }] }]
--                     Порядок в массиве = порядок в тренировке.
--   p_expect_status — в каком статусе вызывающий ожидает увидеть тренировку.
--                     Защищает завершённую тренировку от перезаписи устаревшим черновиком.
--   p_finish        — завершить активную тренировку.
--   p_started_at / p_finished_at — правка времени (для завершённых) или время
--                     окончания (при завершении).
-- ---------------------------------------------------------------------------
create function public.save_workout(
  p_workout_id    uuid,
  p_exercises     jsonb,
  p_expect_status text default 'active',
  p_finish        boolean default false,
  p_started_at    timestamptz default null,
  p_finished_at   timestamptz default null
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
      set status = 'completed', finished_at = v_finished
      where id = w.id
      returning * into w;
    else
      update public.workouts set updated_at = now()
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
    set started_at = v_started, finished_at = v_finished
    where id = w.id
    returning * into w;
  end if;

  return w;
end;
$$;

-- ---------------------------------------------------------------------------
-- progress_context: всё, что нужно для сравнения с прошлым, одним запросом.
-- Учитываются только ЗАВЕРШЁННЫЕ тренировки, начатые раньше p_before.
--
-- Возвращает массив:
--   { exercise_id, workouts_count, max_weight, max_volume,
--     reps_by_weight: [{ weight, max_reps }],
--     last: { workout_id, started_at, sets: [{ weight, reps }] } }
-- ---------------------------------------------------------------------------
create function public.progress_context(
  p_exercise_ids uuid[],
  p_before       timestamptz default 'infinity'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with prior as (
    select we.exercise_id, we.workout_id, w.started_at, we.position, s.set_number, s.weight, s.reps
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    join public.workout_sets s on s.workout_exercise_id = we.id
    where we.exercise_id = any (p_exercise_ids)
      and w.user_id = (select auth.uid())
      and w.status = 'completed'
      and w.started_at < p_before
  ),
  per_workout as (
    select exercise_id, workout_id, started_at,
           sum(weight * reps) as volume,
           max(weight)        as top_weight
    from prior
    group by exercise_id, workout_id, started_at
  ),
  agg as (
    select exercise_id,
           count(*)        as workouts_count,
           max(top_weight) as max_weight,
           max(volume)     as max_volume
    from per_workout
    group by exercise_id
  ),
  by_weight as (
    select x.exercise_id,
           jsonb_agg(jsonb_build_object('weight', x.weight, 'max_reps', x.max_reps) order by x.weight) as reps_by_weight
    from (
      select exercise_id, weight, max(reps) as max_reps
      from prior
      group by exercise_id, weight
    ) x
    group by x.exercise_id
  ),
  last_workout as (
    select distinct on (exercise_id) exercise_id, workout_id, started_at
    from per_workout
    order by exercise_id, started_at desc
  ),
  last_sets as (
    select l.exercise_id, l.workout_id, l.started_at,
           jsonb_agg(jsonb_build_object('weight', p.weight, 'reps', p.reps) order by p.position, p.set_number) as sets
    from last_workout l
    join prior p on p.exercise_id = l.exercise_id and p.workout_id = l.workout_id
    group by l.exercise_id, l.workout_id, l.started_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'exercise_id',    a.exercise_id,
        'workouts_count', a.workouts_count,
        'max_weight',     a.max_weight,
        'max_volume',     a.max_volume,
        'reps_by_weight', b.reps_by_weight,
        'last', jsonb_build_object(
          'workout_id', ls.workout_id,
          'started_at', ls.started_at,
          'sets',       ls.sets
        )
      )
    ),
    '[]'::jsonb
  )
  from agg a
  join by_weight b using (exercise_id)
  join last_sets ls using (exercise_id);
$$;

-- ---------------------------------------------------------------------------
-- Представления (security_invoker: подчиняются RLS вызывающего)
-- ---------------------------------------------------------------------------

-- Итоги по упражнению в каждой завершённой тренировке — для графика динамики
create view public.workout_exercise_stats
with (security_invoker = true) as
select
  w.user_id,
  we.exercise_id,
  we.workout_id,
  w.started_at,
  count(s.id)::integer          as sets_count,
  sum(s.reps)::integer          as total_reps,
  sum(s.weight * s.reps)        as volume,
  max(s.weight)                 as top_weight
from public.workouts w
join public.workout_exercises we on we.workout_id = w.id
join public.workout_sets s on s.workout_exercise_id = we.id
where w.status = 'completed'
  and we.exercise_id is not null
group by w.user_id, we.exercise_id, we.workout_id, w.started_at;

-- Тренировки, в которых был побит личный рекорд рабочего веса
create view public.weight_records
with (security_invoker = true) as
select
  t.user_id,
  t.exercise_id,
  e.name as exercise_name,
  t.workout_id,
  t.started_at,
  t.top_weight,
  t.prev_best
from (
  select s.*,
         max(s.top_weight) over (
           partition by s.exercise_id
           order by s.started_at
           rows between unbounded preceding and 1 preceding
         ) as prev_best
  from public.workout_exercise_stats s
) t
join public.exercises e on e.id = t.exercise_id
where t.prev_best > 0
  and t.top_weight > t.prev_best;

-- ---------------------------------------------------------------------------
-- Права
-- ---------------------------------------------------------------------------
revoke all on function public.start_workout() from public, anon;
revoke all on function public.save_workout(uuid, jsonb, text, boolean, timestamptz, timestamptz) from public, anon;
revoke all on function public.progress_context(uuid[], timestamptz) from public, anon;

grant execute on function public.start_workout() to authenticated;
grant execute on function public.save_workout(uuid, jsonb, text, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.progress_context(uuid[], timestamptz) to authenticated;

revoke all on table public.workout_exercise_stats, public.weight_records from anon, authenticated;
grant select on table public.workout_exercise_stats, public.weight_records to authenticated;
