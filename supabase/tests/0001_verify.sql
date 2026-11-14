-- Auto-check del esquema. Ejecutar después de supabase/migrations/0001_init.sql y supabase/seed.sql.
-- Falla con excepción si algo no cumple; termina con "verify: ok".

do $$
declare
  v_bad int;
  v_diffs int;
  v_total int;
begin
  -- Integridad de datos
  select count(*) into v_bad
  from public.questions
  where jsonb_array_length(options) <> 4;
  if v_bad > 0 then
    raise exception 'Hay % preguntas con opciones distintas de 4', v_bad;
  end if;

  select count(*) into v_bad
  from public.questions
  where not (options @> jsonb_build_array(correct_answer));
  if v_bad > 0 then
    raise exception 'Hay % preguntas cuya respuesta no está en las opciones', v_bad;
  end if;

  select count(distinct difficulty), count(*) into v_diffs, v_total
  from public.questions;
  if v_diffs < 5 then
    raise exception 'Faltan dificultades: solo hay %', v_diffs;
  end if;
  if v_total < 15 then
    raise exception 'Se necesitan al menos 15 preguntas, hay %', v_total;
  end if;

  -- Las tablas con respuestas no deben ser legibles por anon
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('room_secrets', 'solo_sessions')
  ) then
    raise exception 'room_secrets y solo_sessions no deben tener policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'questions'
      and cmd = 'ALL' and 'authenticated' = any (roles)
  ) then
    raise exception 'Falta la policy de admin en questions';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rooms'
      and cmd = 'SELECT' and 'anon' = any (roles)
  ) then
    raise exception 'Falta la policy de lectura pública en rooms';
  end if;

  -- RPC de juego (solo y multijugador)
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_room', 'join_room', 'quick_match', 'start_room', 'get_room_state',
      'buzz', 'answer', 'force_timeout', 'leave_room',
      'start_solo', 'answer_solo', 'get_solo_state'
    )
    group by n.nspname
    having count(*) = 12
  ) then
    raise exception 'Faltan RPC de juego';
  end if;

  -- No debe existir la RPC vieja que filtraba respuestas
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_quiz_pool', 'check_solo_answer')
  ) then
    raise exception 'Siguen existiendo RPC que filtran respuestas';
  end if;

  raise notice 'verify: ok';
end $$;
