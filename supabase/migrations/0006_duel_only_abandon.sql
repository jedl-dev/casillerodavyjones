-- Migración 0006: multijugador solo 1v1, victoria por abandono y retroceso del solo.
-- Ejecutar después de 0005_round_results.sql, en el SQL Editor de Supabase.

-- =========================================================
-- SOLO 1V1
-- =========================================================

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
    and r.mode = '1v1'
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

  if p_mode <> '1v1' then
    raise exception 'Modo no disponible';
  end if;

  v_max := 2;

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
  if v_room.mode <> '1v1' then
    raise exception 'Modo no disponible';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'La partida ya empezó';
  end if;

  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if v_count >= v_room.max_players then
    raise exception 'Sala llena';
  end if;

  v_team := null;

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

create or replace function public.start_room(p_code text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_player uuid;
  v_count int;
  v_questions uuid[];
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
  if v_room.mode <> '1v1' then
    raise exception 'Modo no disponible';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'La partida ya empezó';
  end if;
  if not (select is_host from public.room_players where id = v_player) then
    raise exception 'Solo el creador puede iniciar';
  end if;

  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if v_count <> 2 then
    raise exception 'Faltan jugadores';
  end if;

  with picks as (
    select id, difficulty,
           row_number() over (partition by difficulty order by random()) as rn
    from public.questions
  )
  select array_agg(id order by
    case difficulty
      when 'Fácil' then 1
      when 'Intermedia' then 2
      when 'Difícil' then 3
      when 'Muy Difícil' then 4
      when 'Imposible' then 5
      else 6
    end, rn)
  into v_questions
  from picks
  where (difficulty = 'Fácil' and rn <= 3)
     or (difficulty = 'Intermedia' and rn <= 3)
     or (difficulty = 'Difícil' and rn <= 2)
     or (difficulty = 'Muy Difícil' and rn <= 2)
     or (difficulty = 'Imposible' and rn <= 2);

  if v_questions is null or array_length(v_questions, 1) = 0 then
    raise exception 'No hay preguntas cargadas';
  end if;

  update public.rooms
    set status = 'playing',
        current_round = 1,
        question_ids = v_questions,
        question_id = v_questions[1],
        phase = 'question',
        round_deadline = now() + interval '20 seconds',
        buzzed_by = null,
        blocked_players = '{}',
        last_result = null
    where id = v_room.id;

  return jsonb_build_object('ok', true, 'rounds', array_length(v_questions, 1));
end;
$$;
grant execute on function public.start_room(text, uuid) to anon, authenticated;

create or replace function public.quick_match(p_name text, p_client_id text, p_mode text)
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
  if p_mode <> '1v1' then
    raise exception 'Modo no disponible';
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
    and r.mode = '1v1'
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at
  limit 1
  for update skip locked;

  if v_code is not null then
    return public.join_room(v_code, v_name, v_client);
  end if;

  return public.create_room(v_name, '1v1', v_client);
end;
$$;
grant execute on function public.quick_match(text, text, text) to anon, authenticated;

-- =========================================================
-- ABANDONO: EL QUE QUEDA GANA
-- =========================================================

create or replace function public.leave_room(p_code text, p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room public.rooms%rowtype;
  v_was_host boolean;
  v_next_host uuid;
  v_team text;
  v_name text;
  v_blocked uuid[];
  v_eligible int;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    return;
  end if;

  select r.* into v_room
  from public.rooms r
  join public.room_players rp on rp.room_id = r.id
  where rp.id = v_player
  for update of r;

  select is_host, team, name into v_was_host, v_team, v_name
  from public.room_players where id = v_player;

  delete from public.room_players where id = v_player;

  if not exists (select 1 from public.room_players where room_id = v_room.id) then
    delete from public.rooms where id = v_room.id;
    return;
  end if;

  if v_was_host then
    select id into v_next_host
    from public.room_players
    where room_id = v_room.id
      and last_seen > now() - interval '45 seconds'
    order by joined_at
    limit 1;

    if v_next_host is null then
      select id into v_next_host
      from public.room_players
      where room_id = v_room.id
      order by joined_at
      limit 1;
    end if;

    update public.room_players set is_host = true where id = v_next_host;
  end if;

  if v_room.status = 'playing' and v_room.mode = '1v1'
     and (select count(*) from public.room_players where room_id = v_room.id) = 1 then
    update public.rooms
      set status = 'finished',
          phase = 'finished',
          question_id = null,
          round_deadline = null,
          buzzed_by = null,
          blocked_players = '{}',
          last_result = jsonb_build_object(
            'forfeit', true,
            'player_name', v_name,
            'at', now())
      where id = v_room.id;
    return;
  end if;

  if v_room.status <> 'playing' then
    return;
  end if;

  if v_room.phase = 'steal' then
    select count(*) into v_eligible
    from public.room_players
    where room_id = v_room.id and not (id = any(v_room.blocked_players));

    if v_eligible = 0 then
      perform public._advance_room(v_room.id);
    end if;
    return;
  end if;

  if v_room.phase = 'answering' and v_room.buzzed_by = v_player then
    v_blocked := v_room.blocked_players || v_player;

    select count(*) into v_eligible
    from public.room_players
    where room_id = v_room.id and not (id = any(v_blocked));

    if v_eligible > 0 then
      update public.rooms
        set phase = 'steal',
            buzzed_by = null,
            blocked_players = v_blocked,
            round_deadline = now() + interval '15 seconds'
        where id = v_room.id;
    else
      update public.rooms set blocked_players = v_blocked where id = v_room.id;
      perform public._advance_room(v_room.id);
    end if;
  end if;
end;
$$;
grant execute on function public.leave_room(text, uuid) to anon, authenticated;

-- =========================================================
-- SOLO: RETROCESO AL FALLAR
-- =========================================================

create or replace function public.answer_solo(p_token uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.solo_sessions%rowtype;
  v_correct boolean;
  v_correct_answer text;
  v_round int;
  v_failed int;
  v_total int;
  v_status text;
  v_question jsonb;
  v_ids uuid[];
  v_original uuid[];
  v_diff text;
  v_pick uuid;
  v_first uuid;
begin
  select * into v_session
  from public.solo_sessions
  where token = p_token
  for update;

  if v_session.id is null then
    raise exception 'Sesión no encontrada';
  end if;
  if v_session.status <> 'playing' then
    raise exception 'La partida ya terminó';
  end if;

  v_total := array_length(v_session.question_ids, 1);
  v_round := v_session.current_round;
  v_ids := v_session.question_ids;
  v_original := v_session.question_ids;

  select correct_answer into v_correct_answer
  from public.questions
  where id = v_ids[v_round];

  v_correct := coalesce(v_correct_answer = p_answer, false);

  if v_correct then
    v_session.score := v_session.score + 1;

    if v_round >= v_total then
      v_status := 'won';
    else
      v_status := 'playing';
      v_round := v_round + 1;
    end if;
  else
    v_session.lives := v_session.lives - 1;

    if v_session.lives <= 0 then
      v_status := 'lost';
    else
      v_status := 'playing';
      v_failed := v_round;
      v_round := greatest(1, v_round - 1);

      select difficulty into v_diff from public.questions where id = v_ids[v_round];
      select q.id into v_pick
      from public.questions q
      where q.difficulty = v_diff
        and q.id <> all(v_original)
      order by random()
      limit 1;
      if v_pick is not null then
        v_ids[v_round] := v_pick;
        v_first := v_pick;
      else
        v_first := null;
      end if;

      if v_failed <> v_round then
        select difficulty into v_diff from public.questions where id = v_ids[v_failed];
        select q.id into v_pick
        from public.questions q
        where q.difficulty = v_diff
          and q.id <> all(v_original)
          and (v_first is null or q.id <> v_first)
        order by random()
        limit 1;
        if v_pick is not null then
          v_ids[v_failed] := v_pick;
        end if;
      end if;
    end if;
  end if;

  update public.solo_sessions
    set score = v_session.score,
        lives = v_session.lives,
        status = v_status,
        current_round = v_round,
        question_ids = v_ids,
        last_result = jsonb_build_object(
          'correct', v_correct,
          'correct_answer', v_correct_answer,
          'at', now()
        )
    where id = v_session.id;

  if v_status = 'playing' then
    select jsonb_build_object(
      'question_text', q.question_text,
      'options', q.options,
      'difficulty', q.difficulty,
      'image_file', q.image_file
    )
    into v_question
    from public.questions q
    where q.id = v_ids[v_round];
  else
    v_question := null;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'correct_answer', v_correct_answer,
    'finished', v_status <> 'playing',
    'won', v_status = 'won',
    'lives', v_session.lives,
    'score', v_session.score,
    'round', v_round,
    'total', v_total,
    'question', v_question
  );
end;
$$;
grant execute on function public.answer_solo(uuid, text) to anon, authenticated;
