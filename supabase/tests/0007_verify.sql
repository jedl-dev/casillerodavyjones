-- Auto-check de la migración 0007. Ejecutar después de supabase/migrations/0007_solo_wildcards.sql.
-- Falla con excepción si algo no cumple; termina con "verify: ok".

do $$
declare
  v_args int;
  v_src text;
  v_row public.game_settings%rowtype;
begin
  select * into v_row from public.game_settings where id;
  if v_row.id is null then
    raise exception 'Falta la fila de game_settings';
  end if;

  if v_row.lives_start < 1 or v_row.lives_max < v_row.lives_start then
    raise exception 'Vidas mal configuradas (inicio %, max %)', v_row.lives_start, v_row.lives_max;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name in ('wildcards', 'anchor', 'streak', 'best_streak', 'settings', 'summary')
    group by table_schema
    having count(*) = 6
  ) then
    raise exception 'Faltan columnas de comodines en solo_sessions';
  end if;

  select count(*) into v_args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'use_wildcard' and p.pronargs = 2;
  if v_args <> 1 then
    raise exception 'use_wildcard(uuid, text) no existe';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null
     or v_src not like '%points_gained%'
     or v_src not like '%bonus_wildcards%'
     or v_src not like '%roulette_mid_done%' then
    raise exception 'answer_solo no puntúa o no tira la ruleta de la mitad';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_solo' limit 1;
  if v_src is null or v_src not like '%_roll_wildcards%' then
    raise exception 'start_solo no reparte comodines';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'game_settings'
      and cmd = 'UPDATE' and 'authenticated' = any (roles)
  ) then
    raise exception 'Falta la política de escritura del admin en game_settings';
  end if;

  raise notice 'verify: ok';
end $$;
