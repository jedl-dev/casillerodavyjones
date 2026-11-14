-- Auto-check de la migración 0005. Ejecutar después de supabase/migrations/0005_round_results.sql.
-- Falla con excepción si algo no cumple; termina con "verify: ok".

do $$
declare
  v_args int;
  v_src text;
begin
  select count(*) into v_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'join_room' and p.pronargs = 3;
  if v_args <> 1 then
    raise exception 'join_room(text, text, text) no existe';
  end if;

  select prosrc into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_close_result'
  limit 1;
  if v_src is null then
    raise exception 'Falta _close_result';
  end if;
  if v_src like '%''at''%' then
    raise exception '_close_result no debe escribir la clave at';
  end if;

  select prosrc into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer' and p.pronargs = 3
  limit 1;
  if v_src is null or v_src not like '%''round''%' then
    raise exception 'answer no etiqueta el resultado con su ronda';
  end if;

  select prosrc into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'force_timeout' and p.pronargs = 2
  limit 1;
  if v_src is null or v_src not like '%''round''%' then
    raise exception 'force_timeout no etiqueta el resultado con su ronda';
  end if;

  raise notice 'verify: ok';
end $$;
