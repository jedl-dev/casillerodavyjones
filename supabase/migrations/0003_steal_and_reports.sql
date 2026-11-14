-- Migración 0003: turno heredado (robo) y reporte de preguntas.
-- Ejecutar después de 0002_client_identity.sql, en el SQL Editor de Supabase.

-- =========================================================
-- TURNO HEREDADO
-- =========================================================

alter table public.rooms
  add column if not exists blocked_players uuid[] not null default '{}';

alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms
  add constraint rooms_phase_check
  check (phase in ('waiting', 'question', 'answering', 'steal', 'finished'));

-- =========================================================
-- REPORTES DE PREGUNTAS
-- =========================================================

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reason text not null check (reason in ('respuesta', 'dificultad', 'otro')),
  note text check (char_length(note) <= 280),
  client_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists question_reports_once
  on public.question_reports (question_id, coalesce(client_id, ''), reason);

alter table public.question_reports enable row level security;

drop policy if exists question_reports_admin_read on public.question_reports;
create policy question_reports_admin_read on public.question_reports
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Sin grant directo: anon y authenticated solo escriben a través de la RPC.
create or replace function public.report_question(
  p_question_id uuid,
  p_reason text,
  p_note text,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason is null or p_reason not in ('respuesta', 'dificultad', 'otro') then
    raise exception 'Motivo inválido';
  end if;

  insert into public.question_reports (question_id, reason, note, client_id)
  values (
    p_question_id,
    p_reason,
    nullif(btrim(coalesce(p_note, '')), ''),
    nullif(btrim(coalesce(p_client_id, '')), '')
  )
  on conflict do nothing;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.report_question(uuid, text, text, text) to anon, authenticated;
revoke insert, update, delete on public.question_reports from anon, authenticated;

-- =========================================================
-- MÁQUINA DE TURNOS: RONDA CON ROBO
-- =========================================================

-- Rellena la respuesta correcta del último resultado solo al cerrar la ronda.
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
           (select correct_answer from public.questions where id = p_question_id),
           'at', now())
  where id = p_room_id
    and last_result is not null
    and last_result ->> 'correct_answer' is null;
$$;
revoke all on function public._close_result(uuid, uuid) from public, anon, authenticated;

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
          blocked_players = '{}'
      where id = p_room_id;
  else
    update public.rooms
      set current_round = v_next,
          question_id = v_room.question_ids[v_next],
          phase = 'question',
          round_deadline = now() + interval '20 seconds',
          buzzed_by = null,
          blocked_players = '{}'
      where id = p_room_id;
  end if;
end;
$$;
revoke all on function public._advance_room(uuid) from public, anon, authenticated;

-- Acierto: cierra la ronda. Fallo: bloquea al jugador (y a su equipo en 2v2) y
-- abre una única ventana de robo, o cierra la ronda si no queda nadie elegible.
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

-- Silencio: en 'answering' se hereda el turno; en 'question' o 'steal' se cierra.
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

-- El cliente necesita saber quién puede responder durante el robo.
create or replace function public.get_room_state(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
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
      'buzzed_by', r.buzzed_by,
      'blocked_players', r.blocked_players,
      'last_result', r.last_result,
      'created_at', r.created_at
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rp.id, 'name', rp.name, 'team', rp.team,
        'score', rp.score, 'is_host', rp.is_host
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

-- =========================================================
-- PARTIDA RÁPIDA POR MODO
-- =========================================================

drop function if exists public.quick_match(text, text);

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
  if p_mode not in ('1v1', '2v2', 'ffa4') then
    raise exception 'Modo inválido';
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
    and r.mode = p_mode
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at
  limit 1
  for update skip locked;

  if v_code is not null then
    return public.join_room(v_code, v_name, v_client);
  end if;

  return public.create_room(v_name, p_mode, v_client);
end;
$$;
grant execute on function public.quick_match(text, text, text) to anon, authenticated;

-- =========================================================
-- SURTIDO DE PREGUNTAS: 12 RONDAS (3/3/2/2/2)
-- =========================================================

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
  if v_room.status <> 'waiting' then
    raise exception 'La partida ya empezó';
  end if;
  if not (select is_host from public.room_players where id = v_player) then
    raise exception 'Solo el creador puede iniciar';
  end if;

  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if (v_room.mode = '1v1' and v_count <> 2)
     or (v_room.mode = '2v2' and v_count <> 4)
     or (v_room.mode = 'ffa4' and v_count < 2) then
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

-- =========================================================
-- ABANDONO A MITAD DE RONDA
-- =========================================================

-- Si se va el que estaba respondiendo, hereda el turno el resto; si se va el
-- último elegible del robo, la ronda avanza en vez de quedarse colgada.
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

  select is_host, team into v_was_host, v_team
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
    order by joined_at
    limit 1;
    update public.room_players set is_host = true where id = v_next_host;
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
    if v_room.mode = '2v2' then
      select coalesce(array_agg(id), '{}') into v_blocked
      from public.room_players
      where room_id = v_room.id
        and (id = any(v_blocked) or team is not distinct from v_team);
    end if;

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
