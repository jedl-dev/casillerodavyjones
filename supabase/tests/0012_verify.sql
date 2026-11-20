-- Auto-check de la migración 0012.

do $$
declare
  v_def text;
  v_ok boolean := false;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conname = 'arcade_players_username_format'
    and conrelid = 'public.arcade_players'::regclass;

  if v_def is null then
    raise exception 'Falta la restricción de nombre';
  end if;

  -- Prueba real: un nombre con eñe y acento debe entrar y salir.
  begin
    insert into public.arcade_players (username) values ('?and?_99');
    delete from public.arcade_players where username = '?and?_99';
    v_ok := true;
  exception when check_violation then
    raise exception 'La restricción sigue rechazando nombres con acentos';
  end;

  if not v_ok then
    raise exception 'No se pudo probar el nombre con acentos';
  end if;

  raise notice 'verify: ok';
end $$;
