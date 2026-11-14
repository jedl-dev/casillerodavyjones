-- Auto-check de la migración 0006. Ejecutar después de supabase/migrations/0006_duel_only_abandon.sql.
-- Falla con excepción si algo no cumple; termina con "verify: ok".

do $$
declare
  v_src text;
begin
  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_room' limit 1;
  if v_src is null or v_src not like '%Modo no disponible%' then
    raise exception 'create_room no restringe el modo';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'join_room' limit 1;
  if v_src is null or v_src not like '%Modo no disponible%' then
    raise exception 'join_room no restringe el modo';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_client_room' limit 1;
  if v_src is null or v_src not like '%''1v1''%' then
    raise exception '_client_room no filtra por 1v1';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'leave_room' limit 1;
  if v_src is null or v_src not like '%forfeit%' or v_src not like '%v_name%' then
    raise exception 'leave_room no cierra por abandono con el nombre del que se fue';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%greatest(%' then
    raise exception 'answer_solo no tiene retroceso';
  end if;

  raise notice 'verify: ok';
end $$;
