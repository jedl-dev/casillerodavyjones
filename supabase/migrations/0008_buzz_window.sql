-- Migración 0008: ventana de buzz anclada al servidor.
-- Ejecutar después de 0007_solo_wildcards.sql, en el SQL Editor de Supabase.

alter table public.rooms
  add column if not exists buzz_opens_at timestamptz;

-- Nuevo asalto: la carta se abre 1,5 s después de publicarse la ronda.
create or replace function public._advance_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_total int;
  v_next int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;

  perform public._close_result(p_room_id, v_room.question_id);

  v_total := coalesce(array_length(v_room.question_ids, 1), 0);
  v_next := v_room.current_round + 1;

  if v_next > v_total then
    update public.rooms
      set status = 'finished', phase = 'finished',
          question_id = null, round_deadline = null, buzzed_by = null,
          buzz_opens_at = null, blocked_players = '{}'
      where id = p_room_id;
  else
    update public.rooms
      set current_round = v_next,
          question_id = v_room.question_ids[v_next],
          phase = 'question',
          round_deadline = now() + interval '20 seconds',
          buzz_opens_at = now() + interval '1500 milliseconds',
          buzzed_by = null,
          blocked_players = '{}'
      where id = p_room_id;
  end if;
end;
$$;
revoke all on function public._advance_room(uuid) from public, anon, authenticated;

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
        buzz_opens_at = now() + interval '1500 milliseconds',
        buzzed_by = null,
        blocked_players = '{}',
        last_result = null
    where id = v_room.id;

  return jsonb_build_object('ok', true, 'rounds', array_length(v_questions, 1));
end;
$$;
grant execute on function public.start_room(text, uuid) to anon, authenticated;

create or replace function public.buzz(p_code text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room public.rooms%rowtype;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    raise exception 'Jugador no válido';
  end if;

  update public.rooms
    set phase = 'answering',
        buzzed_by = v_player,
        round_deadline = now() + interval '15 seconds'
    where code = upper(btrim(p_code))
      and status = 'playing'
      and phase = 'question'
      and round_deadline > now()
      and now() >= coalesce(buzz_opens_at, '-infinity'::timestamptz)
    returning * into v_room;

  if v_room.id is null then
    return jsonb_build_object('won', false);
  end if;

  return jsonb_build_object('won', true, 'player_id', v_player);
end;
$$;
grant execute on function public.buzz(text, uuid) to anon, authenticated;

create or replace function public.get_room_state(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'now', now(),
    'room', jsonb_build_object(
      'id', r.id,
      'code', r.code,
      'mode', r.mode,
      'status', r.status,
      'max_players', r.max_players,
      'current_round', r.current_round,
      'total_rounds', coalesce(array_length(r.question_ids, 1), 0),
      'phase', r.phase,
      'question_id', r.question_id,
      'round_deadline', r.round_deadline,
      'buzz_opens_at', r.buzz_opens_at,
      'buzzed_by', r.buzzed_by,
      'blocked_players', r.blocked_players,
      'last_result', r.last_result,
      'created_at', r.created_at
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rp.id, 'name', rp.name, 'team', rp.team,
        'score', rp.score, 'is_host', rp.is_host, 'last_seen', rp.last_seen
      ) order by rp.joined_at)
      from public.room_players rp
      where rp.room_id = r.id
    ), '[]'::jsonb),
    'question', case
      when r.question_id is null then null
      else (
        select jsonb_build_object(
          'id', q.id, 'question_text', q.question_text, 'options', q.options,
          'difficulty', q.difficulty, 'image_file', q.image_file
        )
        from public.questions q where q.id = r.question_id
      )
    end
  )
  from public.rooms r
  where r.code = upper(btrim(p_code));
$$;
grant execute on function public.get_room_state(text) to anon, authenticated;
