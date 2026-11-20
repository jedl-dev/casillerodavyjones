-- Migración 0018: identidad arcade ligada a Supabase Auth (email + contraseña).
-- Ejecutar después de 0017_solo_question_timer.sql.
-- IMPORTANTE: borra los jugadores de prueba actuales para empezar limpio.

alter table public.arcade_players
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists last_played_on date,
  add column if not exists day_streak int not null default 0 check (day_streak >= 0),
  add column if not exists best_day_streak int not null default 0 check (best_day_streak >= 0);

create unique index if not exists arcade_players_user_id_key
  on public.arcade_players (user_id)
  where user_id is not null;

-- Sin migración: los jugadores actuales son de prueba.
delete from public.arcade_players;

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
    'day_streak', v_row.day_streak,
    'best_day_streak', v_row.best_day_streak,
    'last_played_on', v_row.last_played_on
  );
end;
$$;
revoke execute on function public.get_arcade_player() from public, anon;
grant execute on function public.get_arcade_player() to authenticated;

create or replace function public.claim_arcade_name(p_name text, p_token uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_row public.arcade_players%rowtype;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para jugar';
  end if;
  if v_name !~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿ_]{3,16}$' then
    raise exception 'Nombre inválido: de 3 a 16 letras, números o guion bajo';
  end if;

  begin
    select * into v_row
    from public.arcade_players
    where user_id = v_uid;

    if v_row.id is null then
      if exists (
        select 1 from public.arcade_players
        where lower(username) = lower(v_name)
      ) then
        raise exception 'Ese nombre ya está en uso';
      end if;

      insert into public.arcade_players (username, user_id)
      values (v_name, v_uid)
      returning * into v_row;
    elsif v_row.username is distinct from v_name then
      if exists (
        select 1 from public.arcade_players
        where lower(username) = lower(v_name)
          and id <> v_row.id
      ) then
        raise exception 'Ese nombre ya está en uso';
      end if;

      update public.arcade_players
        set username = v_name,
            last_seen = now()
        where id = v_row.id
        returning * into v_row;
    else
      update public.arcade_players
        set last_seen = now()
        where id = v_row.id
        returning * into v_row;
    end if;
  exception
    when unique_violation then
      raise exception 'Ese nombre ya está en uso';
  end;

  return jsonb_build_object(
    'token', v_row.token,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key,
    'frame_key', v_row.frame_key,
    'day_streak', v_row.day_streak,
    'best_day_streak', v_row.best_day_streak,
    'last_played_on', v_row.last_played_on
  );
end;
$$;
revoke execute on function public.claim_arcade_name(text, uuid) from public, anon;
grant execute on function public.claim_arcade_name(text, uuid) to authenticated;

create or replace function public.update_arcade_profile(
  p_token uuid,
  p_avatar_key text,
  p_frame_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar text := coalesce(nullif(btrim(p_avatar_key), ''), 'inicial');
  v_frame text := coalesce(nullif(btrim(p_frame_key), ''), 'inicial');
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

  update public.arcade_players
    set avatar_key = v_avatar,
        frame_key = v_frame,
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
    'day_streak', v_row.day_streak,
    'best_day_streak', v_row.best_day_streak,
    'last_played_on', v_row.last_played_on
  );
end;
$$;
revoke execute on function public.update_arcade_profile(uuid, text, text) from public, anon;
grant execute on function public.update_arcade_profile(uuid, text, text) to authenticated;
