-- Migración 0004: latido de presencia y relevo de mando.
-- Ejecutar después de 0003_steal_and_reports.sql, en el SQL Editor de Supabase.

-- =========================================================
-- PRESENCIA
-- =========================================================

alter table public.room_players
  add column if not exists last_seen timestamptz not null default now();

create index if not exists room_players_seen_idx
  on public.room_players (room_id, last_seen);

-- =========================================================
-- LATIDO
-- =========================================================

-- Late el jugador y, si la sala aún no ha empezado, limpia fantasmas para que
-- las plazas y el arranque no se queden clavados.
create or replace function public.ping(p_code text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room public.rooms%rowtype;
  v_next_host uuid;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    raise exception 'Jugador no válido';
  end if;

  update public.room_players set last_seen = now() where id = v_player;

  select r.* into v_room
  from public.rooms r
  join public.room_players rp on rp.room_id = r.id
  where rp.id = v_player;

  if v_room.id is null or v_room.status <> 'waiting' then
    return jsonb_build_object('ok', true);
  end if;

  select * into v_room from public.rooms where id = v_room.id for update;

  delete from public.room_players
  where room_id = v_room.id
    and last_seen < now() - interval '45 seconds'
    and id <> v_player;

  if not exists (select 1 from public.room_players where room_id = v_room.id) then
    delete from public.rooms where id = v_room.id;
    return jsonb_build_object('ok', true);
  end if;

  if not exists (
    select 1 from public.room_players where room_id = v_room.id and is_host
  ) then
    select id into v_next_host
    from public.room_players
    where room_id = v_room.id
    order by joined_at
    limit 1;
    update public.room_players set is_host = true where id = v_next_host;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.ping(text, uuid) to anon, authenticated;

-- =========================================================
-- RELEVO DE MANDO
-- =========================================================

-- Solo el más antiguo fresco puede reclamar, y solo si el capitán lleva 30 s mudo.
create or replace function public.claim_host(p_code text, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player uuid;
  v_room public.rooms%rowtype;
  v_claimer uuid;
begin
  v_player := public._player_id(p_code, p_token);
  if v_player is null then
    raise exception 'Jugador no válido';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(btrim(p_code))
  for update;

  if v_room.id is null or v_room.status = 'finished' then
    return jsonb_build_object('ok', false);
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = v_room.id and is_host
      and last_seen > now() - interval '30 seconds'
  ) then
    return jsonb_build_object('ok', false);
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = v_room.id and id = v_player and is_host
  ) then
    return jsonb_build_object('ok', false);
  end if;

  if not exists (
    select 1 from public.room_players
    where room_id = v_room.id and id = v_player
      and last_seen > now() - interval '15 seconds'
  ) then
    return jsonb_build_object('ok', false);
  end if;

  select id into v_claimer
  from public.room_players
  where room_id = v_room.id
    and is_host = false
    and last_seen > now() - interval '15 seconds'
  order by joined_at
  limit 1;

  if v_claimer is distinct from v_player then
    return jsonb_build_object('ok', false);
  end if;

  -- Reclamar el mando de una sala en espera limpia a los fantasmas primero:
  -- si no, el nuevo capitán nunca podría arrancar.
  if v_room.status = 'waiting' then
    delete from public.room_players
    where room_id = v_room.id
      and last_seen < now() - interval '45 seconds'
      and id <> v_player;
  end if;

  update public.room_players set is_host = false where room_id = v_room.id and is_host;
  update public.room_players set is_host = true where id = v_player;

  return jsonb_build_object('ok', true, 'player_id', v_player);
end;
$$;
grant execute on function public.claim_host(text, uuid) to anon, authenticated;

-- =========================================================
-- SALIDA (misma lógica que 0003, el nuevo host salta fantasmas)
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

-- =========================================================
-- ESTADO (añade last_seen)
-- =========================================================

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

-- =========================================================
-- LIMPIEZA DE SALAS EN ESPERA SIN NADIE FRESCO
-- =========================================================

create or replace function public.cleanup_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms r
  where r.expires_at < now()
     or (r.status = 'finished' and r.created_at < now() - interval '1 hour')
     or (r.status = 'waiting' and not exists (
           select 1 from public.room_players rp
           where rp.room_id = r.id
             and rp.last_seen > now() - interval '45 seconds'
         ));

  delete from public.solo_sessions
  where expires_at < now()
     or (status <> 'playing' and created_at < now() - interval '1 hour');
$$;
revoke all on function public.cleanup_rooms() from public, anon, authenticated;

-- Escrituras directas cerradas (RLS sigue mandando; esto deja el privilegio limpio).
revoke insert, update, delete on public.room_players from anon, authenticated;
