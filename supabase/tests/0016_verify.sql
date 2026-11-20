-- Auto-check de la migración 0016.

do $$
declare
  v_src text;
  v_n int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name in ('last_flag', 'pending_easier', 'pending_harder', 'pending_hint', 'no_streak', 'zero_points')
    group by table_schema
    having count(*) = 6
  ) then
    raise exception 'Faltan columnas de banderas y costes';
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_flag_of' and p.pronargs = 2;
  if v_n <> 1 then
    raise exception 'Falta _flag_of(int, int)';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_roll_wildcards' limit 1;
  if v_src is null or v_src like '%''ruta''%' or v_src not like '%marea%' then
    raise exception 'La ruleta sigue usando ruta o no conoce marea';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_solo' limit 1;
  if v_src is null or v_src not like '%"filo":0%' then
    raise exception 'start_solo sigue regalando el trío fijo';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%_flag_of%' then
    raise exception 'answer_solo no tira por bandera';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'use_wildcard' limit 1;
  if v_src is null or v_src not like '%mihawk%' or v_src not like '%marea%' then
    raise exception 'use_wildcard no soporta los comodines nuevos';
  end if;

  raise notice 'verify: ok';
end $$;
