-- Auto-check de la migración 0020.

do $$
declare
  v_src text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'solo_sessions'
      and column_name in ('pending_category', 'pending_reroll', 'time_multiplier')
    group by table_schema
    having count(*) = 3
  ) then
    raise exception 'Faltan columnas de elección/tiempo';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'use_wildcard' and p.pronargs = 2
  ) then
    raise exception 'Sigue existiendo use_wildcard(uuid, text)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'use_wildcard' and p.pronargs = 3
  ) then
    raise exception 'Falta use_wildcard(uuid, text, text)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'solo_categories'
  ) then
    raise exception 'Falta solo_categories()';
  end if;

  if jsonb_typeof(public.solo_categories()) <> 'array' then
    raise exception 'solo_categories no devuelve un array';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_roll_wildcards' limit 1;
  if v_src is null or v_src not like '%law%' or v_src not like '%shanks%' then
    raise exception 'La ruleta no conoce Law/Shanks';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'use_wildcard' limit 1;
  if v_src is null or v_src not like '%pending_category%'
     or v_src not like '%pending_reroll%' or v_src not like '%time_multiplier%' then
    raise exception 'use_wildcard no aplica las nuevas elecciones';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'answer_solo' limit 1;
  if v_src is null or v_src not like '%time_multiplier%'
     or v_src not like '%shanks%' then
    raise exception 'answer_solo no usa el tiempo ni los nuevos comodines';
  end if;

  select prosrc into v_src from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'advance_solo' limit 1;
  if v_src is null or v_src not like '%pending_category%'
     or v_src not like '%pending_reroll%' or v_src not like '%time_multiplier%' then
    raise exception 'advance_solo no resuelve categoría/reroll/tiempo';
  end if;

  raise notice 'verify 0020: ok';
end $$;
