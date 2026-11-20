-- Auto-check de la migración 0011.

do $$
declare
  v_n int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arcade_players' and column_name = 'frame_key'
  ) then
    raise exception 'Falta arcade_players.frame_key';
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'update_arcade_profile' and p.pronargs = 3;
  if v_n <> 1 then
    raise exception 'Falta update_arcade_profile(uuid, text, text)';
  end if;

  select count(*) into v_n from information_schema.columns
  where table_schema = 'public'
    and column_name = 'frame_key'
    and table_name in (
      'arcade_solo_leaderboard_all',
      'arcade_solo_leaderboard_week',
      'arcade_duel_leaderboard_all',
      'arcade_duel_leaderboard_week'
    );
  if v_n <> 4 then
    raise exception 'Las vistas del ranking no exponen frame_key';
  end if;

  if not has_column_privilege('anon', 'public.arcade_players', 'frame_key', 'SELECT') then
    raise exception 'anon debe poder leer frame_key';
  end if;

  raise notice 'verify: ok';
end $$;
