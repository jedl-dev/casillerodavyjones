-- Auto-check de la migración 0004. Ejecutar después de supabase/migrations/0004_host_heartbeat.sql.
-- Falla con excepción si algo no cumple; termina con "verify: ok".

do $$
declare
  v_args int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players'
      and column_name = 'last_seen' and is_nullable = 'NO'
  ) then
    raise exception 'Falta room_players.last_seen (not null)';
  end if;

  select count(*) into v_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'ping' and p.pronargs = 2;
  if v_args <> 1 then
    raise exception 'ping(text, uuid) no existe';
  end if;

  select count(*) into v_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'claim_host' and p.pronargs = 2;
  if v_args <> 1 then
    raise exception 'claim_host(text, uuid) no existe';
  end if;

  if has_table_privilege('anon', 'public.room_players', 'INSERT')
     or has_table_privilege('anon', 'public.room_players', 'UPDATE')
     or has_table_privilege('anon', 'public.room_players', 'DELETE') then
    raise exception 'anon no debe poder escribir en room_players';
  end if;

  raise notice 'verify: ok';
end $$;

-- Comprobación manual con una sala real (no verificable por catálogo):
-- select (public.get_room_state('<CODIGO>') -> 'players' -> 0) ? 'last_seen';
