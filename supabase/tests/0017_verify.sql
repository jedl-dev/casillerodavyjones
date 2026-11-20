-- Auto-check de la migración 0017.

do $$
declare
  v_src text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings'
      and column_name in ('question_seconds', 'question_seconds_step', 'time_bonus_per_second')
    group by table_schema
    having count(*) = 3
  ) then
    raise exception 'Faltan ajustes de tiempo';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name = 'question_started_at'
  ) then
    raise exception 'Falta question_started_at';
  end if;

  if public._time_limit('Fácil', '{}'::jsonb) <> 30 then
    raise exception 'El límite base no es 30 s';
  end if;
  if public._time_limit('Imposible', '{}'::jsonb) <> 50 then
    raise exception 'El límite de Imposible no es 50 s';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'begin_solo' and p.pronargs = 1
  ) then
    raise exception 'Falta begin_solo(uuid)';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%time_bonus_per_second%'
     or v_src not like '%question_started_at%' then
    raise exception 'answer_solo no aplica tiempo ni bonus';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'advance_solo' limit 1;
  if v_src is null or v_src not like '%question_started_at = now()%'
     or v_src not like '%time_limit%' then
    raise exception 'advance_solo no arranca el reloj';
  end if;

  raise notice 'verify 0017: ok';
end $$;
