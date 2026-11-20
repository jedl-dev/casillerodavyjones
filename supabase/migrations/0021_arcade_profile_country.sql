-- Migración 0021: bandera/país del perfil.
-- Ejecutar después de 0020_solo_wildcard_choices.sql.
-- Sin esta migración la app sigue funcionando: la bandera queda guardada
-- solo en el dispositivo (el cliente reintenta el guardado sin país).

alter table public.arcade_players
  add column if not exists country text;

alter table public.arcade_players
  drop constraint if exists arcade_players_country_check;

alter table public.arcade_players
  add constraint arcade_players_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

create or replace function public.get_arcade_player()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.arcade_players%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('exists', false);
  end if;

  select * into v_row
  from public.arcade_players
  where user_id = v_uid;

  if v_row.id is null then
    return jsonb_build_object('exists', false);
  end if;

  return jsonb_build_object(
    'exists', true,
    'token', v_row.token,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key,
    'frame_key', v_row.frame_key,
    'country', v_row.country,
    'day_streak', v_row.day_streak,
    'best_day_streak', v_row.best_day_streak,
    'last_played_on', v_row.last_played_on
  );
end;
$$;
revoke execute on function public.get_arcade_player() from public, anon;
grant execute on function public.get_arcade_player() to authenticated;

drop function if exists public.update_arcade_profile(uuid, text, text);

create or replace function public.update_arcade_profile(
  p_token uuid,
  p_avatar_key text,
  p_frame_key text,
  p_country text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar text := coalesce(nullif(btrim(p_avatar_key), ''), 'inicial');
  v_frame text := coalesce(nullif(btrim(p_frame_key), ''), 'inicial');
  v_country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
  v_row public.arcade_players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para editar tu perfil';
  end if;
  if v_avatar <> 'inicial' and v_avatar !~ '^avatar_[0-9]{2}$' then
    raise exception 'Avatar inválido';
  end if;
  if v_frame <> 'inicial' and v_frame !~ '^frame_[0-9]{2}$' then
    raise exception 'Marco inválido';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'País inválido';
  end if;

  update public.arcade_players
    set avatar_key = v_avatar,
        frame_key = v_frame,
        country = v_country,
        last_seen = now()
    where token = p_token
      and user_id = auth.uid()
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Jugador no válido';
  end if;

  return jsonb_build_object(
    'ok', true,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key,
    'frame_key', v_row.frame_key,
    'country', v_row.country,
    'day_streak', v_row.day_streak,
    'best_day_streak', v_row.best_day_streak,
    'last_played_on', v_row.last_played_on
  );
end;
$$;
revoke execute on function public.update_arcade_profile(uuid, text, text, text) from public, anon;
grant execute on function public.update_arcade_profile(uuid, text, text, text) to authenticated;
