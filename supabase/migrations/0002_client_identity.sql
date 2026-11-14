-- Identidad de sesión para evitar que un mismo navegador se una dos veces
-- a la misma sala o se empareje consigo mismo en partida rápida.

alter table public.room_secrets
  add column if not exists client_id text;

create index if not exists room_secrets_client_idx
  on public.room_secrets (client_id);

drop function if exists public.create_room(text, text);
drop function if exists public.create_room(text, text, text);
drop function if exists public.join_room(text, text);
drop function if exists public.join_room(text, text, text);
drop function if exists public.quick_match(text);
drop function if exists public.quick_match(text, text);
drop function if exists public._client_room(text);

create or replace function public._client_room(p_client_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', r.code,
    'room_id', r.id,
    'player_id', rp.id,
    'token', rs.token,
    'max_players', r.max_players,
    'mode', r.mode
  )
  from public.room_secrets rs
  join public.room_players rp on rp.id = rs.player_id
  join public.rooms r on r.id = rp.room_id
  where rs.client_id = p_client_id
    and r.status in ('waiting', 'playing')
    and r.expires_at > now()
  order by r.created_at desc
  limit 1;
$$;
revoke all on function public._client_room(text) from public, anon, authenticated;

create or replace function public.create_room(p_name text, p_mode text, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_max int;
  v_existing jsonb;
  v_room public.rooms%rowtype;
  v_player uuid;
  v_token uuid;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 16 then
    raise exception 'Nombre inválido';
  end if;

  v_max := case p_mode
    when '1v1' then 2
    when '2v2' then 4
    when 'ffa4' then 4
    else null
  end;
  if v_max is null then
    raise exception 'Modo inválido';
  end if;

  if v_client is not null then
    v_existing := public._client_room(v_client);
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  perform public.cleanup_rooms();

  insert into public.rooms (code, mode, max_players)
  values (public._new_room_code(), p_mode, v_max)
  returning * into v_room;

  insert into public.room_players (room_id, name, is_host)
  values (v_room.id, v_name, true)
  returning id into v_player;

  insert into public.room_secrets (player_id, client_id)
  values (v_player, v_client)
  returning token into v_token;

  return jsonb_build_object(
    'code', v_room.code,
    'room_id', v_room.id,
    'player_id', v_player,
    'token', v_token,
    'max_players', v_max,
    'mode', p_mode
  );
end;
$$;
grant execute on function public.create_room(text, text, text) to anon, authenticated;

create or replace function public.join_room(p_code text, p_name text, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_room public.rooms%rowtype;
  v_count int;
  v_team text;
  v_player uuid;
  v_token uuid;
  v_existing jsonb;
  v_other jsonb;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 16 then
    raise exception 'Nombre inválido';
  end if;

  perform public.cleanup_rooms();

  select * into v_room
  from public.rooms
  where code = upper(btrim(p_code))
  for update;

  if v_room.id is null then
    raise exception 'Sala no encontrada';
  end if;

  if v_client is not null then
    select jsonb_build_object(
      'code', v_room.code,
      'room_id', v_room.id,
      'player_id', rp.id,
      'token', rs.token,
      'max_players', v_room.max_players,
      'mode', v_room.mode
    )
    into v_existing
    from public.room_secrets rs
    join public.room_players rp on rp.id = rs.player_id
    where rs.client_id = v_client and rp.room_id = v_room.id
    limit 1;

    if v_existing is not null then
      return v_existing;
    end if;

    v_other := public._client_room(v_client);
    if v_other is not null then
      raise exception 'Ya estás en otra sala. Sal de ella antes de unirte a otra.';
    end if;
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'La partida ya empezó';
  end if;

  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if v_count >= v_room.max_players then
    raise exception 'Sala llena';
  end if;

  v_team := case
    when v_room.mode = '2v2' then (case when v_count % 2 = 0 then 'A' else 'B' end)
    else null
  end;

  insert into public.room_players (room_id, name, team)
  values (v_room.id, v_name, v_team)
  returning id into v_player;

  insert into public.room_secrets (player_id, client_id)
  values (v_player, v_client)
  returning token into v_token;

  return jsonb_build_object(
    'code', v_room.code,
    'room_id', v_room.id,
    'player_id', v_player,
    'token', v_token,
    'max_players', v_room.max_players,
    'mode', v_room.mode
  );
end;
$$;
grant execute on function public.join_room(text, text, text) to anon, authenticated;

create or replace function public.quick_match(p_name text, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_existing jsonb;
  v_code text;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 16 then
    raise exception 'Nombre inválido';
  end if;

  if v_client is not null then
    v_existing := public._client_room(v_client);
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  perform public.cleanup_rooms();

  select r.code into v_code
  from public.rooms r
  where r.status = 'waiting'
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at
  limit 1
  for update skip locked;

  if v_code is not null then
    return public.join_room(v_code, v_name, v_client);
  end if;

  return public.create_room(v_name, 'ffa4', v_client);
end;
$$;
grant execute on function public.quick_match(text, text) to anon, authenticated;
