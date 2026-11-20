-- Auto-check de la migración 0014.

do $$
declare
  v_n int;
  v_src text;
  v_points int;
begin
  select points_facil into v_points from public.game_settings where id;
  if v_points < 100000 then
    raise exception 'La escala de Berries no se aplicó (puntos Fácil: %)', v_points;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name in ('round_multiplier', 'yami_active', 'last_tide', 'tide_rolls')
    group by table_schema
    having count(*) = 4
  ) then
    raise exception 'Faltan columnas de comodines nuevos';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings'
      and column_name in ('roulette_good', 'roulette_neutral', 'roulette_bad', 'roulette_per_tide', 'wildcards_max')
    group by table_schema
    having count(*) = 5
  ) then
    raise exception 'Faltan ajustes de la ruleta';
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_roll_wildcards' and p.pronargs = 4;
  if v_n <> 1 then
    raise exception 'Falta _roll_wildcards(int, int, int, int)';
  end if;

  select count(*) into v_n from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_tide_of' and p.pronargs = 1;
  if v_n <> 1 then
    raise exception 'Falta _tide_of(text)';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'use_wildcard' limit 1;
  if v_src is null or v_src not like '%ojo%' or v_src not like '%fruta%' or v_src not like '%yami%' then
    raise exception 'use_wildcard no soporta los comodines nuevos';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_solo' limit 1;
  if v_src is null or v_src not like '%"filo":1%' then
    raise exception 'start_solo no reparte el trío fijo';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%_roll_wildcards%' or v_src not like '%round_multiplier%' then
    raise exception 'answer_solo no aplica multiplicador ni ruleta por marea';
  end if;

  raise notice 'verify: ok';
end $$;
