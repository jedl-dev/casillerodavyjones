-- Auto-check de la migración 0010 (arcade sin cuentas).
-- Ejecutar después de supabase/migrations/0010_arcade.sql.

do $$
declare
  v_n int;
  v_src text;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    raise exception 'profiles sigue existiendo: 0010 no limpió las cuentas';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'arcade_players')
     or not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'arcade_scores')
     or not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'arcade_duels') then
    raise exception 'Faltan las tablas arcade';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'room_players' and column_name = 'arcade_player_id'
  ) then
    raise exception 'Falta room_players.arcade_player_id';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions' and column_name = 'player_id'
  ) then
    raise exception 'Falta solo_sessions.player_id';
  end if;

  -- Los tokens no deben ser legibles por anon.
  if has_column_privilege('anon', 'public.arcade_players', 'token', 'SELECT') then
    raise exception 'anon no debe poder leer el token de los jugadores';
  end if;

  if has_column_privilege('anon', 'public.arcade_scores', 'session_token', 'SELECT') then
    raise exception 'anon no debe poder leer el token de sesión de las marcas';
  end if;

  select count(*) into v_n from information_schema.views
  where table_schema = 'public' and table_name like 'arcade_%leaderboard%';
  if v_n < 4 then
    raise exception 'Faltan vistas del ranking arcade';
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('claim_arcade_name', 'claim_solo_score', 'start_solo', 'create_room', 'join_room', 'quick_match');
  if v_n < 6 then
    raise exception 'Faltan RPC del modo arcade';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'claim_arcade_name' limit 1;
  if v_src is null or v_src not like '%ya está en uso%' then
    raise exception 'claim_arcade_name no rechaza nombres repetidos';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_room' and p.pronargs = 3
  ) then
    raise exception 'Sigue la versión vieja de create_room (sobrecarga ambigua)';
  end if;

  raise notice 'verify: ok';
end $$;
