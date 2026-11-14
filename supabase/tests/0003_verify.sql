-- Auto-check de la migración 0003. Ejecutar después de supabase/migrations/0003_steal_and_reports.sql.
-- Falla con excepción si algo no cumple; termina con "verify: ok".

do $$
declare
  v_args int;
begin
  -- Columna y fase del robo
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'blocked_players'
  ) then
    raise exception 'Falta rooms.blocked_players';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'rooms_phase_check'
      and conrelid = 'public.rooms'::regclass
      and pg_get_constraintdef(oid) like '%steal%'
  ) then
    raise exception 'rooms_phase_check no admite la fase steal';
  end if;

  -- Reportes: tabla, índice único y RLS
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'question_reports_once'
  ) then
    raise exception 'Falta el índice único question_reports_once';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.question_reports'::regclass and relrowsecurity
  ) then
    raise exception 'question_reports debe tener RLS activo';
  end if;

  if has_table_privilege('anon', 'public.question_reports', 'INSERT') then
    raise exception 'anon no debe poder insertar directo en question_reports';
  end if;

  -- RPC: firmas exactas
  select count(*) into v_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'report_question' and p.pronargs = 4;
  if v_args <> 1 then
    raise exception 'report_question(uuid, text, text, text) no existe';
  end if;

  select count(*) into v_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'quick_match' and p.pronargs = 3;
  if v_args <> 1 then
    raise exception 'quick_match(text, text, text) no existe';
  end if;

  -- Helpers internos fuera del alcance de anon
  if has_function_privilege('anon', 'public._close_result(uuid, uuid)', 'EXECUTE') then
    raise exception 'anon no debe ejecutar _close_result';
  end if;

  raise notice 'verify: ok';
end $$;
