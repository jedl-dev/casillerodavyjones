-- One Piece Quiz - esquema Supabase
-- Ejecutar completo en el SQL Editor de Supabase (rol postgres).

create extension if not exists pgcrypto;

-- =========================================================
-- TABLAS
-- =========================================================

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  options jsonb not null
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_answer text not null,
  difficulty text not null
    check (difficulty in ('Muy Fácil', 'Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible')),
  image_file text,
  category text not null default 'General',
  created_at timestamptz not null default now(),
  constraint correct_answer_is_option check (options @> jsonb_build_array(correct_answer))
);

create index if not exists questions_difficulty_idx on public.questions (difficulty);
create unique index if not exists questions_text_key on public.questions (question_text);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('1v1', '2v2', 'ffa4')),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players int not null,
  current_round int not null default 0,
  phase text not null default 'waiting' check (phase in ('waiting', 'question', 'answering', 'finished')),
  question_ids uuid[] not null default '{}',
  question_id uuid references public.questions(id) on delete set null,
  round_deadline timestamptz,
  buzzed_by uuid,
  last_result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 16),
  team text check (team in ('A', 'B')),
  score int not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now()
);

create index if not exists room_players_room_idx on public.room_players (room_id);

create table if not exists public.room_secrets (
  player_id uuid primary key references public.room_players(id) on delete cascade,
  token uuid not null default gen_random_uuid()
);

create table if not exists public.solo_sessions (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  question_ids uuid[] not null default '{}',
  current_round int not null default 0,
  score int not null default 0,
  lives int not null default 3,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost')),
  last_result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);

-- =========================================================
-- RLS
-- =========================================================

alter table public.questions enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_secrets enable row level security;
alter table public.solo_sessions enable row level security;

drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read on public.rooms
  for select to anon, authenticated using (true);

drop policy if exists room_players_public_read on public.room_players;
create policy room_players_public_read on public.room_players
  for select to anon, authenticated using (true);

grant select on public.rooms, public.room_players to anon, authenticated;

-- questions y room_secrets: sin policies para anon (solo RPC con security definer).
-- solo_sessions: sin policies para anon (solo RPC con security definer).

-- =========================================================
-- REALTIME
-- =========================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players'
  ) then
    execute 'alter publication supabase_realtime add table public.room_players';
  end if;
end $$;

-- =========================================================
-- HELPERS INTERNOS (no expuestos a anon)
-- =========================================================

create or replace function public._new_room_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public._new_room_code() from public, anon, authenticated;

create or replace function public._player_id(p_code text, p_token uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select rp.id
  from public.rooms r
  join public.room_players rp on rp.room_id = r.id
  join public.room_secrets s on s.player_id = rp.id
  where r.code = upper(btrim(p_code)) and s.token = p_token;
$$;
revoke all on function public._player_id(text, uuid) from public, anon, authenticated;

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
  v_total := coalesce(array_length(v_room.question_ids, 1), 0);
  v_next := v_room.current_round + 1;

  if v_next > v_total then
    update public.rooms
      set status = 'finished', phase = 'finished',
          question_id = null, round_deadline = null, buzzed_by = null
      where id = p_room_id;
  else
    update public.rooms
      set current_round = v_next,
          question_id = v_room.question_ids[v_next],
          phase = 'question',
          round_deadline = now() + interval '20 seconds',
          buzzed_by = null
      where id = p_room_id;
  end if;
end;
$$;
revoke all on function public._advance_room(uuid) from public, anon, authenticated;

-- =========================================================
-- RPC DE JUGADOR (grant anon)
-- =========================================================

-- Modo solitario: sesión en servidor, sin exponer IDs ni respuestas.
drop function if exists public.get_quiz_pool();
drop function if exists public.check_solo_answer(uuid, text);

create or replace function public.start_solo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_questions uuid[];
  v_session public.solo_sessions%rowtype;
  v_question jsonb;
begin
  perform public.cleanup_rooms();

  with picks as (
    select id, difficulty,
           row_number() over (partition by difficulty order by random()) as rn
    from public.questions
  ),
  ordered as (
    select id,
           row_number() over (order by case difficulty
             when 'Fácil' then 1
             when 'Intermedia' then 2
             when 'Difícil' then 3
             when 'Muy Difícil' then 4
             when 'Imposible' then 5
             else 6
           end, rn) as position
    from picks
    where (difficulty = 'Fácil' and rn <= 4)
       or (difficulty = 'Intermedia' and rn <= 4)
       or (difficulty = 'Difícil' and rn <= 3)
       or (difficulty = 'Muy Difícil' and rn <= 3)
       or (difficulty = 'Imposible' and rn <= 1)
  )
  select array_agg(id order by position) into v_questions from ordered;

  if v_questions is null or array_length(v_questions, 1) = 0 then
    raise exception 'No hay preguntas cargadas';
  end if;

  insert into public.solo_sessions (question_ids, current_round)
  values (v_questions, 1)
  returning * into v_session;

  select jsonb_build_object(
    'question_text', q.question_text,
    'options', q.options,
    'difficulty', q.difficulty,
    'image_file', q.image_file
  )
  into v_question
  from public.questions q
  where q.id = v_session.question_ids[1];

  return jsonb_build_object(
    'token', v_session.token,
    'lives', v_session.lives,
    'score', v_session.score,
    'round', v_session.current_round,
    'total', array_length(v_questions, 1),
    'question', v_question
  );
end;
$$;
grant execute on function public.start_solo() to anon, authenticated;

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
  v_total int;
  v_status text;
  v_question jsonb;
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

  select correct_answer into v_correct_answer
  from public.questions
  where id = v_session.question_ids[v_round];

  v_correct := coalesce(v_correct_answer = p_answer, false);

  if v_correct then
    v_session.score := v_session.score + 1;
  else
    v_session.lives := v_session.lives - 1;
  end if;

  if v_session.lives <= 0 then
    v_status := 'lost';
  elsif v_round >= v_total then
    v_status := 'won';
  else
    v_status := 'playing';
    v_round := v_round + 1;
  end if;

  update public.solo_sessions
    set score = v_session.score,
        lives = v_session.lives,
        status = v_status,
        current_round = v_round,
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
    where q.id = v_session.question_ids[v_round];
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

create or replace function public.get_solo_state(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'token', s.token,
    'lives', s.lives,
    'score', s.score,
    'round', s.current_round,
    'total', coalesce(array_length(s.question_ids, 1), 0),
    'status', s.status,
    'question', case
      when s.status <> 'playing' then null
      else (
        select jsonb_build_object(
          'question_text', q.question_text,
          'options', q.options,
          'difficulty', q.difficulty,
          'image_file', q.image_file
        )
        from public.questions q
        where q.id = s.question_ids[s.current_round]
      )
    end
  )
  from public.solo_sessions s
  where s.token = p_token;
$$;
grant execute on function public.get_solo_state(uuid) to anon, authenticated;

create or replace function public.create_room(p_name text, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_max int;
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

  perform public.cleanup_rooms();

  insert into public.rooms (code, mode, max_players)
  values (public._new_room_code(), p_mode, v_max)
  returning * into v_room;

  insert into public.room_players (room_id, name, is_host)
  values (v_room.id, v_name, true)
  returning id into v_player;

  insert into public.room_secrets (player_id) values (v_player)
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
grant execute on function public.create_room(text, text) to anon, authenticated;

create or replace function public.join_room(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
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

  insert into public.room_secrets (player_id) values (v_player)
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
grant execute on function public.join_room(text, text) to anon, authenticated;

create or replace function public.quick_match(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  perform public.cleanup_rooms();

  select r.code into v_code
  from public.rooms r
  where r.status = 'waiting'
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at
  limit 1
  for update skip locked;

  if v_code is not null then
    return public.join_room(v_code, p_name);
  end if;

  return public.create_room(p_name, 'ffa4');
end;
$$;
grant execute on function public.quick_match(text) to anon, authenticated;

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
  where rn <= 2;

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
        last_result = null
    where id = v_room.id;

  return jsonb_build_object('ok', true, 'rounds', array_length(v_questions, 1));
end;
$$;
grant execute on function public.start_room(text, uuid) to anon, authenticated;

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

-- Buzz atómico: solo un jugador puede ganar el turno.
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
    returning * into v_room;

  if v_room.id is null then
    return jsonb_build_object('won', false);
  end if;

  return jsonb_build_object('won', true, 'player_id', v_player);
end;
$$;
grant execute on function public.buzz(text, uuid) to anon, authenticated;

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
  if v_room.status <> 'playing' or v_room.phase <> 'answering' then
    raise exception 'No es tu turno';
  end if;
  if v_room.buzzed_by is distinct from v_player then
    raise exception 'No es tu turno';
  end if;
  if v_room.round_deadline is not null and now() > v_room.round_deadline then
    raise exception 'Turno expirado';
  end if;

  select correct_answer into v_correct_answer
  from public.questions where id = v_room.question_id;

  v_correct := coalesce(v_correct_answer = p_answer, false);

  if v_correct then
    update public.room_players set score = score + 1 where id = v_player;
  end if;

  update public.rooms
    set last_result = jsonb_build_object(
      'player_id', v_player,
      'player_name', (select name from public.room_players where id = v_player),
      'correct', v_correct,
      'correct_answer', v_correct_answer,
      'timeout', false,
      'at', now()
    )
    where id = v_room.id;

  perform public._advance_room(v_room.id);

  return jsonb_build_object(
    'correct', v_correct,
    'correct_answer', v_correct_answer
  );
end;
$$;
grant execute on function public.answer(text, uuid, text) to anon, authenticated;

-- Cualquier jugador puede forzar el avance cuando vence el reloj del servidor.
create or replace function public.force_timeout(p_code text, p_token uuid)
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

  update public.rooms
    set last_result = jsonb_build_object(
      'player_id', null,
      'player_name', null,
      'correct', null,
      'correct_answer', (select correct_answer from public.questions where id = v_room.question_id),
      'timeout', true,
      'at', now()
    )
    where id = v_room.id;

  perform public._advance_room(v_room.id);

  return jsonb_build_object('advanced', true);
end;
$$;
grant execute on function public.force_timeout(text, uuid) to anon, authenticated;

create or replace function public.leave_room(p_code text, p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room_id uuid;
  v_was_host boolean;
  v_next_host uuid;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    return;
  end if;

  select room_id, is_host into v_room_id, v_was_host
  from public.room_players where id = v_player;

  delete from public.room_players where id = v_player;

  if not exists (select 1 from public.room_players where room_id = v_room_id) then
    delete from public.rooms where id = v_room_id;
  elsif v_was_host then
    select id into v_next_host
    from public.room_players
    where room_id = v_room_id
    order by joined_at
    limit 1;
    update public.room_players set is_host = true where id = v_next_host;
  end if;
end;
$$;
grant execute on function public.leave_room(text, uuid) to anon, authenticated;

create or replace function public.cleanup_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms
  where expires_at < now()
     or (status = 'finished' and created_at < now() - interval '1 hour');

  delete from public.solo_sessions
  where expires_at < now()
     or (status <> 'playing' and created_at < now() - interval '1 hour');
$$;
revoke all on function public.cleanup_rooms() from public, anon, authenticated;

-- Limpieza opcional con pg_cron (ejecutar aparte si la extensión está disponible):
-- create extension if not exists pg_cron;
-- select cron.schedule('cleanup_rooms', '*/10 * * * *', 'select public.cleanup_rooms();');
