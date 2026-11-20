-- Auto-check de la migración 0008. Ejecutar después de 0008_buzz_window.sql.

do $$
declare
  v_src text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'buzz_opens_at'
  ) then
    raise exception 'Falta rooms.buzz_opens_at';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'buzz' limit 1;
  if v_src is null or v_src not like '%buzz_opens_at%' then
    raise exception 'buzz no respeta la ventana del servidor';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_advance_room' limit 1;
  if v_src is null or v_src not like '%buzz_opens_at%' then
    raise exception '_advance_room no abre la ventana';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_room_state' limit 1;
  if v_src is null or v_src not like '%''now''%' then
    raise exception 'get_room_state no devuelve la hora del servidor';
  end if;

  raise notice 'verify: ok';
end $$;
