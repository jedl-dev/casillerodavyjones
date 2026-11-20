-- Auto-check de la migración 0019.

do $$
declare
  v_src text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name in ('bet_active', 'bet_stake', 'bets_used')
    group by table_schema
    having count(*) = 3
  ) then
    raise exception 'Faltan columnas de apuesta';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings'
      and column_name = 'bets_per_run'
  ) then
    raise exception 'Falta bets_per_run';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'place_bet' and p.pronargs = 2
  ) then
    raise exception 'Falta place_bet(uuid, boolean)';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_solo' limit 1;
  if v_src is null or v_src not like '%v_start_roll%'
     or v_src not like '%day_streak%' or v_src not like '%start_roll%' then
    raise exception 'start_solo no tira al inicio ni actualiza la racha';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%v_bet_delta%' or v_src not like '%bets_used%' then
    raise exception 'answer_solo no resuelve la apuesta';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'advance_solo' limit 1;
  if v_src is null or v_src not like '%bet_stake%' then
    raise exception 'advance_solo no recalcula la apuesta';
  end if;

  raise notice 'verify 0019: ok';
end $$;
