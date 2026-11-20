-- Auto-check de la migración 0022.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions' and column_name = 'game_key'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'game_key'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arcade_scores' and column_name = 'game_key'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arcade_duels' and column_name = 'game_key'
  ) then
    raise exception 'Falta game_key en alguna tabla';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_room' and p.pronargs = 4
  ) then
    raise exception 'Sigue existiendo create_room(text, text, text, uuid)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_room' and p.pronargs = 5
  ) then
    raise exception 'Falta create_room(text, text, text, uuid, text)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'quick_match' and p.pronargs = 5
  ) then
    raise exception 'Falta quick_match(text, text, text, uuid, text)';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arcade_solo_leaderboard_all'
      and column_name in ('game_key', 'rank')
    group by table_schema
    having count(*) = 2
  ) then
    raise exception 'La vista del ranking no expone game_key y rank';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('claim_solo_score', '_record_duel', 'get_room_state')
      and pg_get_functiondef(p.oid) like '%game_key%'
    group by n.nspname
    having count(*) = 3
  ) then
    raise exception 'Alguna función no guarda o expone game_key';
  end if;
end;
$$;
