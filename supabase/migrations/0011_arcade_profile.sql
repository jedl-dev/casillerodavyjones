-- Migración 0011: avatar y marco editables para jugadores arcade.
-- Ejecutar después de 0010_arcade.sql.

alter table public.arcade_players
  add column if not exists frame_key text not null default 'inicial';

alter table public.arcade_players drop constraint if exists arcade_players_frame_key;
alter table public.arcade_players
  add constraint arcade_players_frame_key
  check (frame_key = 'inicial' or frame_key ~ '^frame_[0-9]{2}$');

grant select (id, username, avatar_key, frame_key) on public.arcade_players to anon, authenticated;

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
    update public.arcade_players set last_seen = now() where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'token', v_row.token,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key,
    'frame_key', v_row.frame_key
  );
end;
$$;
grant execute on function public.claim_arcade_name(text, uuid) to anon, authenticated;

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
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Jugador no válido';
  end if;

  return jsonb_build_object(
    'ok', true,
    'username', v_row.username,
    'avatar_key', v_row.avatar_key,
    'frame_key', v_row.frame_key
  );
end;
$$;
grant execute on function public.update_arcade_profile(uuid, text, text) to anon, authenticated;

drop view if exists public.arcade_solo_leaderboard_all;
drop view if exists public.arcade_solo_leaderboard_week;
drop view if exists public.arcade_duel_leaderboard_all;
drop view if exists public.arcade_duel_leaderboard_week;

create view public.arcade_solo_leaderboard_all
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, p.frame_key, b.score, b.created_at
from (
  select distinct on (player_id) player_id, score, created_at
  from public.arcade_scores
  order by player_id, score desc, created_at asc
) b
join public.arcade_players p on p.id = b.player_id;

create view public.arcade_solo_leaderboard_week
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, p.frame_key, b.score, b.created_at
from (
  select distinct on (player_id) player_id, score, created_at
  from public.arcade_scores
  where created_at >= date_trunc('week', now())
  order by player_id, score desc, created_at asc
) b
join public.arcade_players p on p.id = b.player_id;

create view public.arcade_duel_leaderboard_all
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, p.frame_key, count(*)::int as wins
from public.arcade_duels d
join public.arcade_players p on p.id = d.winner_id
group by p.id, p.username, p.avatar_key, p.frame_key;

create view public.arcade_duel_leaderboard_week
with (security_invoker = true)
as
select p.id, p.username, p.avatar_key, p.frame_key, count(*)::int as wins
from public.arcade_duels d
join public.arcade_players p on p.id = d.winner_id
where d.created_at >= date_trunc('week', now())
group by p.id, p.username, p.avatar_key, p.frame_key;

grant select on
  public.arcade_solo_leaderboard_all,
  public.arcade_solo_leaderboard_week,
  public.arcade_duel_leaderboard_all,
  public.arcade_duel_leaderboard_week
to anon, authenticated;
