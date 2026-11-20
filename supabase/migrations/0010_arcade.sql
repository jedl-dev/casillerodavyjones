-- Migración 0010: adiós cuentas. Arcade con nombre único y marca por nombre.
-- Ejecutar después de 0009_accounts.sql, en el SQL Editor de Supabase.

-- =========================================================
-- FUERA EL MUNDO DE CUENTAS
-- =========================================================

drop view if exists public.solo_leaderboard_all;
drop view if exists public.solo_leaderboard_week;
drop view if exists public.duel_leaderboard_all;
drop view if exists public.duel_leaderboard_week;

drop table if exists public.duel_results;
drop table if exists public.solo_scores;
drop table if exists public.profiles cascade;

drop function if exists public.save_profile(text, text);
drop function if exists public._record_duel(uuid);
drop function if exists public.claim_solo_score(uuid);

alter table public.room_players drop column if exists user_id;

-- =========================================================
-- JUGADORES ARCADE
-- =========================================================

create table if not exists public.arcade_players (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  token uuid not null default gen_random_uuid(),
  avatar_key text not null default 'inicial',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create unique index if not exists arcade_players_username_key
  on public.arcade_players (lower(username));
create unique index if not exists arcade_players_token_key
  on public.arcade_players (token);

alter table public.arcade_players drop constraint if exists arcade_players_username_format;
alter table public.arcade_players
  add constraint arcade_players_username_format
  check (username ~ '^[A-Za-z0-9_]{3,16}$');

alter table public.arcade_players drop constraint if exists arcade_players_avatar_key;
alter table public.arcade_players
  add constraint arcade_players_avatar_key
  check (avatar_key = 'inicial' or avatar_key ~ '^avatar_[0-9]{2}$');

alter table public.arcade_players enable row level security;

drop policy if exists arcade_players_public_read on public.arcade_players;
create policy arcade_players_public_read on public.arcade_players
  for select to anon, authenticated using (true);

-- El token es secreto: se conceden solo las columnas públicas.
grant select (id, username, avatar_key) on public.arcade_players to anon, authenticated;
revoke insert, update, delete on public.arcade_players from anon, authenticated;

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
  if v_name !~ '^[A-Za-z0-9_]{3,16}$' then
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
    update public.arcade_players
      set last_seen = now()
      where id = v_row.id
      returning * into v_row;
  end if;

  return jsonb_build_object(
    'token', v_row.token,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key
  );
end;
$$;
grant execute on function public.claim_arcade_name(text, uuid) to anon, authenticated;

-- =========================================================
-- MARCAS DEL SOLO
-- =========================================================

create table if not exists public.arcade_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.arcade_players(id) on delete cascade,
  score int not null check (score >= 0),
  difficulty text,
  session_token uuid not null unique,
  created_at timestamptz not null default now()
);

create index if not exists arcade_scores_best_idx on public.arcade_scores (player_id, score desc);
create index if not exists arcade_scores_score_idx on public.arcade_scores (score desc);

alter table public.arcade_scores enable row level security;

drop policy if exists arcade_scores_public_read on public.arcade_scores;
create policy arcade_scores_public_read on public.arcade_scores
  for select to anon, authenticated using (true);

-- El token de sesión es secreto: solo se exponen las columnas del ranking.
revoke select on public.arcade_scores from anon, authenticated;
grant select (player_id, score, difficulty, created_at) on public.arcade_scores to anon, authenticated;
revoke insert, update, delete on public.arcade_scores from anon, authenticated;

alter table public.solo_sessions
  add column if not exists player_id uuid references public.arcade_players(id) on delete set null;

alter table public.room_players
  add column if not exists arcade_player_id uuid references public.arcade_players(id) on delete set null;

-- =========================================================
-- EMPEZAR PARTIDA CON NOMBRE
-- =========================================================

drop function if exists public.start_solo();

create or replace function public.start_solo(p_player_token uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.game_settings%rowtype;
  v_questions uuid[];
  v_session public.solo_sessions%rowtype;
  v_question jsonb;
  v_roll jsonb;
  v_player uuid;
begin
  perform public.cleanup_rooms();

  if p_player_token is not null then
    select id into v_player from public.arcade_players where token = p_player_token;
    if v_player is null then
      raise exception 'Tu nombre ya no está disponible; elige otro';
    end if;
    update public.arcade_players set last_seen = now() where id = v_player;
  end if;

  select * into v_settings from public.game_settings where id;
  if v_settings.id is null then
    insert into public.game_settings (id) values (true)
    returning * into v_settings;
  end if;

  with picks as (
    select id, difficulty,
           row_number() over (partition by difficulty order by random()) as rn
    from public.questions
  ),
  ordered as (
    select id, rn,
           case difficulty
             when 'Fácil' then 1
             when 'Intermedia' then 2
             when 'Difícil' then 3
             when 'Muy Difícil' then 4
             when 'Imposible' then 5
             else 6
           end as band
    from picks
    where (difficulty = 'Fácil' and rn <= v_settings.rounds_facil)
       or (difficulty = 'Intermedia' and rn <= v_settings.rounds_intermedia)
       or (difficulty = 'Difícil' and rn <= v_settings.rounds_dificil)
       or (difficulty = 'Muy Difícil' and rn <= v_settings.rounds_muy_dificil)
       or (difficulty = 'Imposible' and rn <= v_settings.rounds_imposible)
  )
  select array_agg(id order by band, rn) into v_questions from ordered;

  if v_questions is null or array_length(v_questions, 1) = 0 then
    raise exception 'No hay preguntas cargadas';
  end if;

  v_roll := public._roll_wildcards(v_settings.roulette_start_min, v_settings.roulette_start_max);

  insert into public.solo_sessions (question_ids, current_round, lives, wildcards, settings, player_id)
  values (v_questions, 1, v_settings.lives_start, v_roll -> 'bag', to_jsonb(v_settings), v_player)
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
    'streak', v_session.streak,
    'best_streak', v_session.best_streak,
    'anchor', v_session.anchor,
    'round', v_session.current_round,
    'total', array_length(v_questions, 1),
    'wildcards', v_session.wildcards,
    'roll', v_roll -> 'rolls',
    'settings', v_session.settings,
    'named', v_player is not null,
    'question', v_question
  );
end;
$$;
grant execute on function public.start_solo(uuid) to anon, authenticated;

create or replace function public.claim_solo_score(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.solo_sessions%rowtype;
  v_rank int;
begin
  select * into v_session
  from public.solo_sessions
  where token = p_session
  for update;

  if v_session.id is null then
    raise exception 'Sesión no encontrada';
  end if;
  if v_session.status = 'playing' then
    raise exception 'La partida sigue en curso';
  end if;
  if v_session.player_id is null then
    raise exception 'Juega con un nombre para guardar tu marca';
  end if;

  insert into public.arcade_scores (player_id, score, difficulty, session_token)
  values (
    v_session.player_id,
    v_session.score,
    (select difficulty from public.questions where id = v_session.question_ids[array_length(v_session.question_ids, 1)]),
    p_session
  )
  on conflict (session_token) do nothing;

  select count(*) + 1 into v_rank
  from (
    select distinct on (player_id) player_id, score
    from public.arcade_scores
    order by player_id, score desc
  ) best
  where best.score > v_session.score;

  return jsonb_build_object('ok', true, 'score', v_session.score, 'rank', v_rank);
end;
$$;
grant execute on function public.claim_solo_score(uuid) to anon, authenticated;

-- =========================================================
-- SALAS CON NOMBRE ARCADE
-- =========================================================

drop function if exists public.create_room(text, text, text);
drop function if exists public.join_room(text, text, text);
drop function if exists public.quick_match(text, text, text);

create or replace function public.create_room(
  p_name text,
  p_mode text,
  p_client_id text,
  p_player_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_player_ref uuid;
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

  if p_player_token is not null then
    select id into v_player_ref from public.arcade_players where token = p_player_token;
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

  insert into public.room_players (room_id, name, is_host, arcade_player_id)
  values (v_room.id, v_name, true, v_player_ref)
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
grant execute on function public.create_room(text, text, text, uuid) to anon, authenticated;

create or replace function public.join_room(
  p_code text,
  p_name text,
  p_client_id text,
  p_player_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_player_ref uuid;
  v_room public.rooms%rowtype;
  v_count int;
  v_player uuid;
  v_token uuid;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 16 then
    raise exception 'Nombre inválido';
  end if;

  if p_player_token is not null then
    select id into v_player_ref from public.arcade_players where token = p_player_token;
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

  insert into public.room_players (room_id, name, team, arcade_player_id)
  values (v_room.id, v_name, null, v_player_ref)
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
grant execute on function public.join_room(text, text, text, uuid) to anon, authenticated;

create or replace function public.quick_match(
  p_name text,
  p_client_id text,
  p_mode text,
  p_player_token uuid default null
)
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
    return public.join_room(v_code, v_name, v_client, p_player_token);
  end if;

  return public.create_room(v_name, '1v1', v_client, p_player_token);
end;
$$;
grant execute on function public.quick_match(text, text, text, uuid) to anon, authenticated;

-- =========================================================
-- DUELOS ENTRE NOMBRES
-- =========================================================

create table if not exists public.arcade_duels (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique,
  winner_id uuid not null references public.arcade_players(id) on delete cascade,
  loser_id uuid not null references public.arcade_players(id) on delete cascade,
  winner_score int,
  loser_score int,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);

create index if not exists arcade_duels_wins_idx on public.arcade_duels (winner_id, created_at desc);

alter table public.arcade_duels enable row level security;

drop policy if exists arcade_duels_public_read on public.arcade_duels;
create policy arcade_duels_public_read on public.arcade_duels
  for select to anon, authenticated using (true);

grant select on public.arcade_duels to anon, authenticated;
revoke insert, update, delete on public.arcade_duels from anon, authenticated;

create or replace function public._record_duel(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_with_name int;
  v_winner uuid;
  v_loser uuid;
  v_winner_score int;
  v_loser_score int;
begin
  select count(*) into v_with_name
  from public.room_players
  where room_id = p_room_id and arcade_player_id is not null;

  if v_with_name <> 2 then
    return;
  end if;

  select arcade_player_id, score into v_winner, v_winner_score
  from public.room_players
  where room_id = p_room_id
  order by score desc, joined_at asc
  limit 1;

  select arcade_player_id, score into v_loser, v_loser_score
  from public.room_players
  where room_id = p_room_id
  order by score asc, joined_at desc
  limit 1;

  if v_winner is null or v_loser is null or v_winner = v_loser then
    return;
  end if;
  if v_winner_score = v_loser_score then
    return;
  end if;

  insert into public.arcade_duels (room_id, winner_id, loser_id, winner_score, loser_score)
  values (p_room_id, v_winner, v_loser, v_winner_score, v_loser_score)
  on conflict (room_id) do nothing;
end;
$$;
revoke all on function public._record_duel(uuid) from public, anon, authenticated;

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

    perform public._record_duel(p_room_id);
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

-- =========================================================
-- RANKINGS ARCADE
-- =========================================================

create or replace view public.arcade_solo_leaderboard_all
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, b.score, b.created_at
from (
  select distinct on (player_id) player_id, score, created_at
  from public.arcade_scores
  order by player_id, score desc, created_at asc
) b
join public.arcade_players p on p.id = b.player_id;

create or replace view public.arcade_solo_leaderboard_week
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, b.score, b.created_at
from (
  select distinct on (player_id) player_id, score, created_at
  from public.arcade_scores
  where created_at >= date_trunc('week', now())
  order by player_id, score desc, created_at asc
) b
join public.arcade_players p on p.id = b.player_id;

create or replace view public.arcade_duel_leaderboard_all
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, count(*)::int as wins
from public.arcade_duels d
join public.arcade_players p on p.id = d.winner_id
group by p.id, p.username, p.avatar_key;

create or replace view public.arcade_duel_leaderboard_week
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, count(*)::int as wins
from public.arcade_duels d
join public.arcade_players p on p.id = d.winner_id
where d.created_at >= date_trunc('week', now())
group by p.id, p.username, p.avatar_key;

grant select on
  public.arcade_solo_leaderboard_all,
  public.arcade_solo_leaderboard_week,
  public.arcade_duel_leaderboard_all,
  public.arcade_duel_leaderboard_week
to anon, authenticated;
