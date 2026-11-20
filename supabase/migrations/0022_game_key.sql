-- Migración 0022: identificar el juego en partidas, salas y rankings.
-- Ejecutar después de 0021_arcade_profile_country.sql.
-- Sin esta migración la app sigue funcionando: consulta sin game_key y crea
-- salas con la firma antigua (el cliente reintenta sin el parámetro).

alter table public.solo_sessions
  add column if not exists game_key text not null default 'quiz';

alter table public.rooms
  add column if not exists game_key text not null default 'quiz';

alter table public.arcade_scores
  add column if not exists game_key text not null default 'quiz';

alter table public.arcade_duels
  add column if not exists game_key text not null default 'quiz';

create index if not exists arcade_scores_game_idx
  on public.arcade_scores (game_key, score desc);

create index if not exists arcade_duels_game_idx
  on public.arcade_duels (game_key, winner_id, created_at desc);

create index if not exists rooms_game_idx
  on public.rooms (game_key, status);

-- Las vistas son security_invoker: anon necesita leer la columna nueva.
grant select (player_id, score, difficulty, created_at, game_key)
  on public.arcade_scores to anon, authenticated;

-- =========================================================
-- RANKINGS POR JUEGO
-- =========================================================

drop view if exists public.arcade_solo_leaderboard_all;
drop view if exists public.arcade_solo_leaderboard_week;
drop view if exists public.arcade_duel_leaderboard_all;
drop view if exists public.arcade_duel_leaderboard_week;

create view public.arcade_solo_leaderboard_all
with (security_invoker = true)
as
select
  b.game_key,
  p.id,
  p.username,
  p.avatar_key,
  p.frame_key,
  b.score,
  b.created_at,
  (row_number() over (
    partition by b.game_key
    order by b.score desc, p.username asc
  ))::int as rank
from (
  select distinct on (game_key, player_id) game_key, player_id, score, created_at
  from public.arcade_scores
  order by game_key, player_id, score desc, created_at asc
) b
join public.arcade_players p on p.id = b.player_id;

create view public.arcade_solo_leaderboard_week
with (security_invoker = true)
as
select
  b.game_key,
  p.id,
  p.username,
  p.avatar_key,
  p.frame_key,
  b.score,
  b.created_at,
  (row_number() over (
    partition by b.game_key
    order by b.score desc, p.username asc
  ))::int as rank
from (
  select distinct on (game_key, player_id) game_key, player_id, score, created_at
  from public.arcade_scores
  where created_at >= date_trunc('week', now())
  order by game_key, player_id, score desc, created_at asc
) b
join public.arcade_players p on p.id = b.player_id;

create view public.arcade_duel_leaderboard_all
with (security_invoker = true)
as
select
  d.game_key,
  p.id,
  p.username,
  p.avatar_key,
  p.frame_key,
  count(*)::int as wins,
  (row_number() over (
    partition by d.game_key
    order by count(*) desc, p.username asc
  ))::int as rank
from public.arcade_duels d
join public.arcade_players p on p.id = d.winner_id
group by d.game_key, p.id, p.username, p.avatar_key, p.frame_key;

create view public.arcade_duel_leaderboard_week
with (security_invoker = true)
as
select
  d.game_key,
  p.id,
  p.username,
  p.avatar_key,
  p.frame_key,
  count(*)::int as wins,
  (row_number() over (
    partition by d.game_key
    order by count(*) desc, p.username asc
  ))::int as rank
from public.arcade_duels d
join public.arcade_players p on p.id = d.winner_id
where d.created_at >= date_trunc('week', now())
group by d.game_key, p.id, p.username, p.avatar_key, p.frame_key;

grant select on
  public.arcade_solo_leaderboard_all,
  public.arcade_solo_leaderboard_week,
  public.arcade_duel_leaderboard_all,
  public.arcade_duel_leaderboard_week
to anon, authenticated;

-- =========================================================
-- PUNTUACIONES: guardar el juego y rankear dentro de él
-- =========================================================

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

  insert into public.arcade_scores (player_id, score, difficulty, session_token, game_key)
  values (
    v_session.player_id,
    v_session.score,
    (select difficulty from public.questions where id = v_session.question_ids[array_length(v_session.question_ids, 1)]),
    p_session,
    v_session.game_key
  )
  on conflict (session_token) do nothing;

  select count(*) + 1 into v_rank
  from (
    select distinct on (player_id) player_id, score
    from public.arcade_scores
    where game_key = v_session.game_key
    order by player_id, score desc
  ) best
  where best.score > v_session.score;

  return jsonb_build_object('ok', true, 'score', v_session.score, 'rank', v_rank);
end;
$$;
grant execute on function public.claim_solo_score(uuid) to anon, authenticated;

-- =========================================================
-- DUELOS: heredan el juego de la sala
-- =========================================================

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
  v_game_key text;
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

  select game_key into v_game_key
  from public.rooms
  where id = p_room_id;

  insert into public.arcade_duels (room_id, winner_id, loser_id, winner_score, loser_score, game_key)
  values (p_room_id, v_winner, v_loser, v_winner_score, v_loser_score, coalesce(v_game_key, 'quiz'))
  on conflict (room_id) do nothing;
end;
$$;
revoke all on function public._record_duel(uuid) from public, anon, authenticated;

-- =========================================================
-- SALAS: juego en la creación y la partida rápida
-- =========================================================

drop function if exists public.create_room(text, text, text, uuid);
drop function if exists public.quick_match(text, text, text, uuid);

create or replace function public.create_room(
  p_name text,
  p_mode text,
  p_client_id text,
  p_player_token uuid default null,
  p_game_key text default 'quiz'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_game text := lower(btrim(coalesce(p_game_key, 'quiz')));
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
  if v_game !~ '^[a-z0-9_]{2,32}$' then
    raise exception 'Juego no válido';
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

  insert into public.rooms (code, mode, max_players, game_key)
  values (public._new_room_code(), p_mode, v_max, v_game)
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
    'mode', p_mode,
    'game_key', v_game
  );
end;
$$;
grant execute on function public.create_room(text, text, text, uuid, text) to anon, authenticated;

create or replace function public.quick_match(
  p_name text,
  p_client_id text,
  p_mode text,
  p_player_token uuid default null,
  p_game_key text default 'quiz'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_game text := lower(btrim(coalesce(p_game_key, 'quiz')));
  v_existing jsonb;
  v_code text;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 16 then
    raise exception 'Nombre inválido';
  end if;
  if p_mode <> '1v1' then
    raise exception 'Modo no disponible';
  end if;
  if v_game !~ '^[a-z0-9_]{2,32}$' then
    raise exception 'Juego no válido';
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
    and r.game_key = v_game
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at
  limit 1
  for update skip locked;

  if v_code is not null then
    return public.join_room(v_code, v_name, v_client, p_player_token);
  end if;

  return public.create_room(v_name, '1v1', v_client, p_player_token, v_game);
end;
$$;
grant execute on function public.quick_match(text, text, text, uuid, text) to anon, authenticated;

-- =========================================================
-- ESTADO DE SALA: exponer el juego
-- =========================================================

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
      'game_key', r.game_key,
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
