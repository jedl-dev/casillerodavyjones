-- Auto-check de la migración 0018.

do $$
declare
  v_src text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'arcade_players'
      and column_name in ('user_id', 'day_streak', 'best_day_streak', 'last_played_on')
    group by table_schema
    having count(*) = 4
  ) then
    raise exception 'Faltan columnas de identidad/racha en arcade_players';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'arcade_players'
      and indexname = 'arcade_players_user_id_key'
  ) then
    raise exception 'Falta el índice único de user_id';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'claim_arcade_name' limit 1;
  if v_src is null or v_src not like '%auth.uid()%' or v_src not like '%user_id%' then
    raise exception 'claim_arcade_name no usa la sesión';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'update_arcade_profile' limit 1;
  if v_src is null or v_src not like '%auth.uid()%' then
    raise exception 'update_arcade_profile no comprueba la sesión';
  end if;

  if not has_function_privilege('authenticated', 'public.get_arcade_player()', 'execute') then
    raise exception 'authenticated no puede leer su jugador';
  end if;
  if has_function_privilege('anon', 'public.get_arcade_player()', 'execute') then
    raise exception 'anon no debería poder leer jugadores';
  end if;

  if (public.get_arcade_player() ->> 'exists')::boolean is not false then
    raise exception 'Sin sesión no debe existir jugador';
  end if;

  begin
    perform public.claim_arcade_name('AuditPlayer');
    raise exception 'claim_arcade_name no exige sesión';
  exception
    when others then
      if sqlerrm not like '%Inicia sesión%' then
        raise;
      end if;
  end;

  raise notice 'verify 0018: ok';
end $$;
