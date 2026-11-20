-- Migración 0009: cuentas (Google), perfiles, puntuaciones y duelos.
-- Ejecutar después de 0008_buzz_window.sql, en el SQL Editor de Supabase.

-- =========================================================
-- PERFILES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_changed_at timestamptz not null default now(),
  avatar_key text not null default 'inicial',
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,16}$');

alter table public.profiles drop constraint if exists profiles_avatar_key;
alter table public.profiles
  add constraint profiles_avatar_key
  check (avatar_key = 'inicial' or avatar_key ~ '^avatar_[0-9]{2}$');

alter table public.profiles enable row level security;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select to anon, authenticated using (true);

grant select on public.profiles to anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- =========================================================
-- PUNTUACIONES DEL SOLO
-- =========================================================

create table if not exists public.solo_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null check (score >= 0),
  difficulty text,
  session_token uuid not null unique,
  created_at timestamptz not null default now()
);

create index if not exists solo_scores_best_idx on public.solo_scores (user_id, score desc);
create index if not exists solo_scores_score_idx on public.solo_scores (score desc);

alter table public.solo_scores enable row level security;

drop policy if exists solo_scores_public_read on public.solo_scores;
create policy solo_scores_public_read on public.solo_scores
  for select to anon, authenticated using (true);

grant select on public.solo_scores to anon, authenticated;
revoke insert, update, delete on public.solo_scores from anon, authenticated;

-- =========================================================
-- DUELOS
-- =========================================================

create table if not exists public.duel_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique,
  winner_id uuid not null references public.profiles(id) on delete cascade,
  loser_id uuid not null references public.profiles(id) on delete cascade,
  winner_score int,
  loser_score int,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);

create index if not exists duel_wins_idx on public.duel_results (winner_id, created_at desc);

alter table public.duel_results enable row level security;

drop policy if exists duel_results_public_read on public.duel_results;
create policy duel_results_public_read on public.duel_results
  for select to anon, authenticated using (true);

grant select on public.duel_results to anon, authenticated;
revoke insert, update, delete on public.duel_results from anon, authenticated;

alter table public.room_players
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- =========================================================
-- JUGADORES CON CUENTA
-- =========================================================

create or replace function public.create_room(p_name text, p_mode text, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_client text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_uid uuid := auth.uid();
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

  insert into public.room_players (room_id, name, is_host, user_id)
  values (v_room.id, v_name, true, v_uid)
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
  v_uid uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_count int;
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

  insert into public.room_players (room_id, name, team, user_id)
  values (v_room.id, v_name, null, v_uid)
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

-- =========================================================
-- REGISTRO DEL DUELO AL CERRAR LA SALA
-- =========================================================

create or replace function public._record_duel(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_with_account int;
  v_winner uuid;
  v_loser uuid;
  v_winner_score int;
  v_loser_score int;
begin
  select count(*) into v_with_account
  from public.room_players
  where room_id = p_room_id and user_id is not null;

  if v_with_account <> 2 then
    return;
  end if;

  select user_id, score into v_winner, v_winner_score
  from public.room_players
  where room_id = p_room_id
  order by score desc, joined_at asc
  limit 1;

  select user_id, score into v_loser, v_loser_score
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

  insert into public.duel_results (room_id, winner_id, loser_id, winner_score, loser_score)
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
-- PERFIL: NOMBRE ÚNICO Y AVATAR
-- =========================================================

create or replace function public.save_profile(p_username text, p_avatar_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := btrim(coalesce(p_username, ''));
  v_avatar text := coalesce(nullif(btrim(p_avatar_key), ''), 'inicial');
  v_current public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para guardar tu perfil';
  end if;
  if v_username !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Nombre inválido: de 3 a 16 letras, números o guion bajo';
  end if;
  if v_avatar <> 'inicial' and v_avatar !~ '^avatar_[0-9]{2}$' then
    raise exception 'Avatar inválido';
  end if;

  select * into v_current from public.profiles where id = v_uid;

  if v_current.id is not null
     and v_current.username is distinct from v_username
     and now() - v_current.username_changed_at < interval '30 days' then
    raise exception 'Solo puedes cambiar el nombre una vez cada 30 días';
  end if;

  begin
    insert into public.profiles (id, username, avatar_key)
    values (v_uid, v_username, v_avatar)
    on conflict (id) do update
      set username = excluded.username,
          avatar_key = excluded.avatar_key,
          username_changed_at = case
            when public.profiles.username is distinct from excluded.username then now()
            else public.profiles.username_changed_at
          end;
  exception when unique_violation then
    raise exception 'Ese nombre ya está cogido';
  end;

  return jsonb_build_object('ok', true, 'username', v_username, 'avatar_key', v_avatar);
end;
$$;
grant execute on function public.save_profile(text, text) to authenticated;

-- =========================================================
-- RECLAMAR LA MARCA DEL SOLO
-- =========================================================

create or replace function public.claim_solo_score(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.solo_sessions%rowtype;
  v_profile public.profiles%rowtype;
  v_rank int;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para guardar tu marca';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null then
    raise exception 'Completa tu perfil antes de guardar';
  end if;

  select * into v_session
  from public.solo_sessions
  where token = p_token
  for update;

  if v_session.id is null then
    raise exception 'Sesión no encontrada';
  end if;
  if v_session.status = 'playing' then
    raise exception 'La partida sigue en curso';
  end if;

  insert into public.solo_scores (user_id, score, difficulty, session_token)
  values (
    v_uid,
    v_session.score,
    (select difficulty from public.questions where id = v_session.question_ids[array_length(v_session.question_ids, 1)]),
    p_token
  )
  on conflict (session_token) do nothing;

  select count(*) + 1 into v_rank
  from (
    select distinct on (user_id) user_id, score
    from public.solo_scores
    order by user_id, score desc
  ) best
  where best.score > v_session.score;

  return jsonb_build_object('ok', true, 'score', v_session.score, 'rank', v_rank);
end;
$$;
grant execute on function public.claim_solo_score(uuid) to authenticated;

-- =========================================================
-- RANKINGS
-- =========================================================

create or replace view public.solo_leaderboard_all
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, b.score, b.created_at
from (
  select distinct on (user_id) user_id, score, created_at
  from public.solo_scores
  order by user_id, score desc, created_at asc
) b
join public.profiles p on p.id = b.user_id;

create or replace view public.solo_leaderboard_week
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, b.score, b.created_at
from (
  select distinct on (user_id) user_id, score, created_at
  from public.solo_scores
  where created_at >= date_trunc('week', now())
  order by user_id, score desc, created_at asc
) b
join public.profiles p on p.id = b.user_id;

create or replace view public.duel_leaderboard_all
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, count(*)::int as wins
from public.duel_results d
join public.profiles p on p.id = d.winner_id
group by p.id, p.username, p.avatar_key;

create or replace view public.duel_leaderboard_week
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, count(*)::int as wins
from public.duel_results d
join public.profiles p on p.id = d.winner_id
where d.created_at >= date_trunc('week', now())
group by p.id, p.username, p.avatar_key;

grant select on
  public.solo_leaderboard_all,
  public.solo_leaderboard_week,
  public.duel_leaderboard_all,
  public.duel_leaderboard_week
to anon, authenticated;
