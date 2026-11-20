-- Migración 0012: nombres con acentos y eñes.
-- Ejecutar después de 0011_arcade_profile.sql.

alter table public.arcade_players drop constraint if exists arcade_players_username_format;
alter table public.arcade_players
  add constraint arcade_players_username_format
  check (username ~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿ_]{3,16}$');

create or replace function public.claim_arcade_name(p_name text, p_token uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_row public.arcade_players%rowtype;
begin
  if v_name !~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿ_]{3,16}$' then
    raise exception 'Nombre inválido: de 3 a 16 letras, números o guion bajo';
  end if;

  select * into v_row
  from public.arcade_players
  where lower(username) = lower(v_name);

  if v_row.id is null then
    begin
      insert into public.arcade_players (username)
      values (v_name)
      returning * into v_row;
    exception when unique_violation then
      raise exception 'Ese nombre ya está en uso';
    end;
  else
    if p_token is null or v_row.token is distinct from p_token then
      raise exception 'Ese nombre ya está en uso';
    end if;
    update public.arcade_players set last_seen = now() where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'token', v_row.token,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key,
    'frame_key', v_row.frame_key
  );
end;
$$;
grant execute on function public.claim_arcade_name(text, uuid) to anon, authenticated;
