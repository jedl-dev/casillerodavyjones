-- Auto-check de la migración 0015.

do $$
declare
  v_n int;
  v_src text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name in ('phase', 'pending_filo', 'pending_ruta', 'pending_ojo', 'wildcard_between_used')
    group by table_schema
    having count(*) = 5
  ) then
    raise exception 'Faltan columnas de la pausa entre rondas';
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'advance_solo' and p.pronargs = 1;
  if v_n <> 1 then
    raise exception 'Falta advance_solo(uuid)';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'use_wildcard' limit 1;
  if v_src is null or v_src not like '%between%' then
    raise exception 'use_wildcard no exige la pausa entre rondas';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%between%' then
    raise exception 'answer_solo no abre la pausa';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'advance_solo' limit 1;
  if v_src is null or v_src not like '%pending_filo%' or v_src not like '%pending_ojo%' then
    raise exception 'advance_solo no resuelve los comodines diferidos';
  end if;

  raise notice 'verify: ok';
end $$;
