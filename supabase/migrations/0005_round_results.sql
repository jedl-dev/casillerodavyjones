-- Migración 0005: cada resultado lleva su ronda y unirse no reutiliza la sesión.
-- Ejecutar después de 0004_host_heartbeat.sql, en el SQL Editor de Supabase.

-- =========================================================
-- EL CIERRE NO PISA EL TIMESTAMP DEL RESULTADO
-- =========================================================

create or replace function public._close_result(p_room_id uuid, p_question_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rooms
    set last_result = coalesce(last_result, '{}'::jsonb)
      || jsonb_build_object(
           'correct_answer',
           (select correct_answer from public.questions where id = p_question_id))
  where id = p_room_id
    and last_result is not null
    and last_result ->> 'correct_answer' is null;
$$;
revoke all on function public._close_result(uuid, uuid) from public, anon, authenticated;

-- =========================================================
-- RESULTADOS ETIQUETADOS CON SU RONDA
-- =========================================================

create or replace function public.answer(p_code text, p_token uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room public.rooms%rowtype;
  v_correct boolean;
  v_correct_answer text;
  v_blocked uuid[];
  v_team text;
  v_eligible int;
  v_name text;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    raise exception 'Jugador no válido';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(btrim(p_code))
  for update;

  if v_room.id is null then
    raise exception 'Sala no encontrada';
  end if;
  if v_room.status <> 'playing' then
    raise exception 'No es tu turno';
  end if;
  if v_room.round_deadline is not null and now() > v_room.round_deadline then
    raise exception 'Turno expirado';
  end if;

  if not (
    (v_room.phase = 'answering' and v_room.buzzed_by = v_player)
    or (v_room.phase = 'steal' and not (v_player = any(v_room.blocked_players)))
  ) then
    raise exception 'No es tu turno';
  end if;

  select correct_answer into v_correct_answer
  from public.questions where id = v_room.question_id;

  v_correct := coalesce(v_correct_answer = p_answer, false);

  select name into v_name from public.room_players where id = v_player;

  if v_correct then
    update public.room_players set score = score + 1 where id = v_player;

    update public.rooms
      set last_result = jsonb_build_object(
        'player_id', v_player,
        'player_name', v_name,
        'correct', true,
        'correct_answer', null,
        'timeout', false,
        'round', v_room.current_round,
        'at', now()
      )
      where id = v_room.id;

    perform public._advance_room(v_room.id);

    return jsonb_build_object('correct', true);
  end if;

  v_blocked := v_room.blocked_players || v_player;
  if v_room.mode = '2v2' then
    select rp.team into v_team from public.room_players rp where rp.id = v_player;
    select coalesce(array_agg(rp.id), '{}') into v_blocked
    from public.room_players rp
    where rp.room_id = v_room.id
      and (rp.id = any(v_blocked) or rp.team is not distinct from v_team);
  end if;

  update public.rooms
    set last_result = jsonb_build_object(
      'player_id', v_player,
      'player_name', v_name,
      'correct', false,
      'correct_answer', null,
      'timeout', false,
      'round', v_room.current_round,
      'at', now()
    ),
    blocked_players = v_blocked
    where id = v_room.id;

  if v_room.phase = 'steal' then
    perform public._advance_room(v_room.id);
  else
    select count(*) into v_eligible
    from public.room_players
    where room_id = v_room.id and not (id = any(v_blocked));

    if v_eligible > 0 then
      update public.rooms
        set phase = 'steal',
            buzzed_by = null,
            round_deadline = now() + interval '15 seconds'
        where id = v_room.id;
    else
      perform public._advance_room(v_room.id);
    end if;
  end if;

  return jsonb_build_object('correct', false);
end;
$$;
grant execute on function public.answer(text, uuid, text) to anon, authenticated;

create or replace function public.force_timeout(p_code text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room public.rooms%rowtype;
  v_blocked uuid[];
  v_team text;
  v_eligible int;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    raise exception 'Jugador no válido';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(btrim(p_code))
  for update;

  if v_room.id is null then
    raise exception 'Sala no encontrada';
  end if;
  if v_room.status <> 'playing' then
    return jsonb_build_object('advanced', false);
  end if;
  if v_room.round_deadline is not null and now() < v_room.round_deadline then
    raise exception 'Aún hay tiempo';
  end if;

  if v_room.phase = 'answering' then
    v_blocked := case
      when v_room.buzzed_by is null then v_room.blocked_players
      else v_room.blocked_players || v_room.buzzed_by
    end;

    if v_room.mode = '2v2' and v_room.buzzed_by is not null then
      select rp.team into v_team from public.room_players rp where rp.id = v_room.buzzed_by;
      select coalesce(array_agg(rp.id), '{}') into v_blocked
      from public.room_players rp
      where rp.room_id = v_room.id
        and (rp.id = any(v_blocked) or rp.team is not distinct from v_team);
    end if;

    update public.rooms
      set last_result = jsonb_build_object(
        'player_id', v_room.buzzed_by,
        'player_name', (select name from public.room_players where id = v_room.buzzed_by),
        'correct', null,
        'correct_answer', null,
        'timeout', true,
        'round', v_room.current_round,
        'at', now()
      ),
      blocked_players = v_blocked
      where id = v_room.id;

    select count(*) into v_eligible
    from public.room_players
    where room_id = v_room.id and not (id = any(v_blocked));

    if v_eligible > 0 then
      update public.rooms
        set phase = 'steal',
            buzzed_by = null,
            round_deadline = now() + interval '15 seconds'
        where id = v_room.id;
    else
      perform public._advance_room(v_room.id);
    end if;
  elsif v_room.phase = 'question' then
    update public.rooms
      set last_result = jsonb_build_object(
        'player_id', null,
        'player_name', null,
        'correct', null,
        'correct_answer', null,
        'timeout', true,
        'round', v_room.current_round,
        'at', now()
      )
      where id = v_room.id;

    perform public._advance_room(v_room.id);
  elsif v_room.phase = 'steal' then
    perform public._advance_room(v_room.id);
  else
    return jsonb_build_object('advanced', false);
  end if;

  return jsonb_build_object('advanced', true);
end;
$$;
grant execute on function public.force_timeout(text, uuid) to anon, authenticated;

-- =========================================================
-- UNIRSE NO DEVUELVE LA SESIÓN DE OTRA PESTAÑA
-- =========================================================

-- shortcut: dos jugadores del mismo cliente dejan _client_room ambiguo; el flujo
-- normal (crear en una pestaña, unirse por código en otra) no lo provoca.
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
