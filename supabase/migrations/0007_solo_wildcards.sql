-- Migración 0007: comodines, ruleta y puntuación del modo solo.
-- Ejecutar después de 0006_duel_only_abandon.sql, en el SQL Editor de Supabase.

-- =========================================================
-- AJUSTES DEL JUEGO
-- =========================================================

create table if not exists public.game_settings (
  id boolean primary key default true check (id),
  lives_start int not null default 3 check (lives_start between 1 and 9),
  lives_max int not null default 5 check (lives_max between 1 and 9),
  rounds_facil int not null default 5 check (rounds_facil between 0 and 20),
  rounds_intermedia int not null default 5 check (rounds_intermedia between 0 and 20),
  rounds_dificil int not null default 4 check (rounds_dificil between 0 and 20),
  rounds_muy_dificil int not null default 4 check (rounds_muy_dificil between 0 and 20),
  rounds_imposible int not null default 2 check (rounds_imposible between 0 and 20),
  points_facil int not null default 10 check (points_facil between 0 and 9999),
  points_intermedia int not null default 20 check (points_intermedia between 0 and 9999),
  points_dificil int not null default 35 check (points_dificil between 0 and 9999),
  points_muy_dificil int not null default 55 check (points_muy_dificil between 0 and 9999),
  points_imposible int not null default 90 check (points_imposible between 0 and 9999),
  streak_step1_at int not null default 3 check (streak_step1_at between 0 and 50),
  streak_step1_mult numeric not null default 1.10 check (streak_step1_mult between 1 and 5),
  streak_step2_at int not null default 6 check (streak_step2_at between 0 and 50),
  streak_step2_mult numeric not null default 1.25 check (streak_step2_mult between 1 and 5),
  streak_step3_at int not null default 9 check (streak_step3_at between 0 and 50),
  streak_step3_mult numeric not null default 1.50 check (streak_step3_mult between 1 and 5),
  bonus_unused_wildcard int not null default 100 check (bonus_unused_wildcard between 0 and 9999),
  bonus_life int not null default 200 check (bonus_life between 0 and 9999),
  roulette_start_min int not null default 2 check (roulette_start_min between 0 and 6),
  roulette_start_max int not null default 3 check (roulette_start_max between 0 and 6),
  roulette_mid_min int not null default 1 check (roulette_mid_min between 0 and 6),
  roulette_mid_max int not null default 2 check (roulette_mid_max between 0 and 6),
  updated_at timestamptz not null default now()
);

insert into public.game_settings (id) values (true) on conflict do nothing;

alter table public.game_settings enable row level security;

drop policy if exists game_settings_admin_read on public.game_settings;
create policy game_settings_admin_read on public.game_settings
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists game_settings_admin_write on public.game_settings;
create policy game_settings_admin_write on public.game_settings
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke insert, delete on public.game_settings from anon, authenticated;
grant select, update on public.game_settings to authenticated;

-- =========================================================
-- ESTADO DE LA SESIÓN
-- =========================================================

alter table public.solo_sessions
  add column if not exists wildcards jsonb not null
    default '{"eliminar":0,"cambiar":0,"vida":0,"ancla":0}'::jsonb,
  add column if not exists anchor boolean not null default false,
  add column if not exists streak int not null default 0,
  add column if not exists best_streak int not null default 0,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists roulette_mid_done boolean not null default false,
  add column if not exists wildcard_round int not null default 0,
  add column if not exists summary jsonb not null default '{}'::jsonb;

-- =========================================================
-- HELPERS INTERNOS
-- =========================================================

create or replace function public._roll_wildcards(p_min int, p_max int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_types text[] := array['eliminar', 'cambiar', 'vida', 'ancla'];
  v_count int;
  v_type text;
  v_rolls jsonb := '[]'::jsonb;
  v_bag jsonb := '{"eliminar":0,"cambiar":0,"vida":0,"ancla":0}'::jsonb;
  i int;
begin
  v_count := p_min + floor(random() * (p_max - p_min + 1))::int;

  for i in 1..v_count loop
    v_type := v_types[1 + floor(random() * 4)::int];
    v_bag := jsonb_set(v_bag, array[v_type], to_jsonb((v_bag ->> v_type)::int + 1));
    v_rolls := v_rolls || to_jsonb(v_type);
  end loop;

  return jsonb_build_object('bag', v_bag, 'rolls', v_rolls);
end;
$$;
revoke all on function public._roll_wildcards(int, int) from public, anon, authenticated;

create or replace function public._solo_multiplier(p_streak int, p_settings jsonb)
returns numeric
language sql
immutable
as $$
  select case
    when p_streak >= (p_settings ->> 'streak_step3_at')::int
      then (p_settings ->> 'streak_step3_mult')::numeric
    when p_streak >= (p_settings ->> 'streak_step2_at')::int
      then (p_settings ->> 'streak_step2_mult')::numeric
    when p_streak >= (p_settings ->> 'streak_step1_at')::int
      then (p_settings ->> 'streak_step1_mult')::numeric
    else 1.0
  end;
$$;
revoke all on function public._solo_multiplier(int, jsonb) from public, anon, authenticated;

-- =========================================================
-- EMPEZAR PARTIDA
-- =========================================================

create or replace function public.start_solo()
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
begin
  perform public.cleanup_rooms();

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

  insert into public.solo_sessions (question_ids, current_round, lives, wildcards, settings)
  values (v_questions, 1, v_settings.lives_start, v_roll -> 'bag', to_jsonb(v_settings))
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
    'question', v_question
  );
end;
$$;
grant execute on function public.start_solo() to anon, authenticated;

-- =========================================================
-- USAR COMODÍN
-- =========================================================

create or replace function public.use_wildcard(p_token uuid, p_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.solo_sessions%rowtype;
  v_bag jsonb;
  v_ids uuid[];
  v_question_id uuid;
  v_correct text;
  v_wrong text[];
  v_disabled text[];
  v_new uuid;
  v_question jsonb;
  v_lives_max int;
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
  if p_type not in ('eliminar', 'cambiar', 'vida', 'ancla') then
    raise exception 'Comodín inválido';
  end if;
  if (v_session.wildcards ->> p_type)::int <= 0 then
    raise exception 'No te quedan comodines de ese tipo';
  end if;
  if v_session.wildcard_round = v_session.current_round then
    raise exception 'Ya usaste un comodín en esta ronda';
  end if;
  if p_type = 'ancla' and v_session.anchor then
    raise exception 'El ancla ya está echada';
  end if;

  v_bag := jsonb_set(
    v_session.wildcards,
    array[p_type],
    to_jsonb((v_session.wildcards ->> p_type)::int - 1)
  );

  v_ids := v_session.question_ids;
  v_question_id := v_ids[v_session.current_round];

  if p_type = 'eliminar' then
    select correct_answer into v_correct
    from public.questions where id = v_question_id;

    select coalesce(array_agg(option), '{}') into v_wrong
    from (
      select jsonb_array_elements_text(q.options) as option
      from public.questions q
      where q.id = v_question_id
    ) s
    where option is distinct from v_correct;

    select coalesce(array_agg(pick), '{}') into v_disabled
    from (
      select pick from unnest(v_wrong) as pick order by random() limit 2
    ) s;

    update public.solo_sessions
      set wildcards = v_bag, wildcard_round = v_session.current_round
      where id = v_session.id;

    return jsonb_build_object('ok', true, 'wildcards', v_bag, 'disabled', v_disabled, 'round', v_session.current_round);
  end if;

  if p_type = 'cambiar' then
    select q.id into v_new
    from public.questions q
    where q.difficulty = (select difficulty from public.questions where id = v_question_id)
      and q.id <> all (v_ids)
    order by random()
    limit 1;

    if v_new is null then
      raise exception 'No hay otra pregunta de esa dificultad';
    end if;

    v_ids[v_session.current_round] := v_new;

    update public.solo_sessions
      set wildcards = v_bag,
          question_ids = v_ids,
          wildcard_round = v_session.current_round
      where id = v_session.id;

    select jsonb_build_object(
      'question_text', q.question_text,
      'options', q.options,
      'difficulty', q.difficulty,
      'image_file', q.image_file
    )
    into v_question
    from public.questions q where q.id = v_new;

    return jsonb_build_object('ok', true, 'wildcards', v_bag, 'question', v_question, 'round', v_session.current_round);
  end if;

  if p_type = 'vida' then
    v_lives_max := coalesce((v_session.settings ->> 'lives_max')::int, 5);

    update public.solo_sessions
      set wildcards = v_bag,
          lives = least(v_session.lives + 1, v_lives_max),
          wildcard_round = v_session.current_round
      where id = v_session.id
      returning * into v_session;

    return jsonb_build_object('ok', true, 'wildcards', v_bag, 'lives', v_session.lives, 'round', v_session.current_round);
  end if;

  update public.solo_sessions
    set wildcards = v_bag, anchor = true, wildcard_round = v_session.current_round
    where id = v_session.id;

  return jsonb_build_object('ok', true, 'wildcards', v_bag, 'anchor', true, 'round', v_session.current_round);
end;
$$;
grant execute on function public.use_wildcard(uuid, text) to anon, authenticated;

-- =========================================================
-- RESPONDER CON PUNTOS, RACHA, ANCLA Y RULETA
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
  v_difficulty text;
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
  v_base int;
  v_streak int;
  v_mult numeric;
  v_gained int;
  v_roll jsonb := '[]'::jsonb;
  v_bonus_wildcards int := 0;
  v_bonus_lives int := 0;
  v_summary jsonb := '{}'::jsonb;
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

  select correct_answer, difficulty into v_correct_answer, v_difficulty
  from public.questions
  where id = v_ids[v_round];

  v_correct := coalesce(v_correct_answer = p_answer, false);

  v_streak := v_session.streak;
  v_gained := 0;

  if v_correct then
    v_base := case v_difficulty
      when 'Fácil' then (v_session.settings ->> 'points_facil')::int
      when 'Intermedia' then (v_session.settings ->> 'points_intermedia')::int
      when 'Difícil' then (v_session.settings ->> 'points_dificil')::int
      when 'Muy Difícil' then (v_session.settings ->> 'points_muy_dificil')::int
      when 'Imposible' then (v_session.settings ->> 'points_imposible')::int
      else 10
    end;

    v_streak := v_streak + 1;
    v_mult := public._solo_multiplier(v_streak, v_session.settings);
    v_gained := round(v_base * v_mult)::int;

    v_session.score := v_session.score + v_gained;
    v_session.best_streak := greatest(v_session.best_streak, v_streak);

    if v_round >= v_total then
      v_status := 'won';
    else
      v_status := 'playing';
      v_round := v_round + 1;
    end if;
  else
    v_streak := 0;
    v_session.lives := v_session.lives - 1;

    if v_session.lives <= 0 then
      v_status := 'lost';
    elsif v_session.anchor then
      -- El ancla absorbe el retroceso: no se pierde casilla. En la ultima
      -- ronda no hay a donde avanzar, asi que la pregunta se cambia.
      v_status := 'playing';
      if v_round >= v_total then
        select q.id into v_pick
        from public.questions q
        where q.difficulty = (select difficulty from public.questions where id = v_ids[v_round])
          and q.id <> all (v_original)
        order by random()
        limit 1;

        if v_pick is not null then
          v_ids[v_round] := v_pick;
        else
          v_status := 'lost';
        end if;
      else
        v_round := v_round + 1;
      end if;
    else
      v_status := 'playing';
      v_failed := v_round;
      v_round := greatest(1, v_round - 1);

      select difficulty into v_diff from public.questions where id = v_ids[v_round];
      select q.id into v_pick
      from public.questions q
      where q.difficulty = v_diff
        and q.id <> all (v_original)
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
          and q.id <> all (v_original)
          and (v_first is null or q.id <> v_first)
        order by random()
        limit 1;
        if v_pick is not null then
          v_ids[v_failed] := v_pick;
        end if;
      end if;
    end if;
  end if;

  -- Ruleta de la mitad
  if v_status = 'playing' and not v_session.roulette_mid_done
     and v_round >= ceil(v_total / 2.0) then
    v_roll := public._roll_wildcards(
      (v_session.settings ->> 'roulette_mid_min')::int,
      (v_session.settings ->> 'roulette_mid_max')::int
    );
    select jsonb_object_agg(key, sum(value::int))
    into v_session.wildcards
    from (
      select key, value from jsonb_each_text(v_session.wildcards)
      union all
      select key, value from jsonb_each_text(v_roll -> 'bag')
    ) s
    group by key;
    v_session.roulette_mid_done := true;
  end if;

  -- Cierre de partida: bonus
  if v_status <> 'playing' then
    v_bonus_wildcards := (v_session.settings ->> 'bonus_unused_wildcard')::int
      * ((v_session.wildcards ->> 'eliminar')::int
       + (v_session.wildcards ->> 'cambiar')::int
       + (v_session.wildcards ->> 'vida')::int
       + (v_session.wildcards ->> 'ancla')::int);
    v_bonus_lives := (v_session.settings ->> 'bonus_life')::int * greatest(v_session.lives, 0);

    v_session.score := v_session.score + v_bonus_wildcards + v_bonus_lives;

    v_summary := jsonb_build_object(
      'bonus_wildcards', v_bonus_wildcards,
      'bonus_lives', v_bonus_lives,
      'best_streak', v_session.best_streak,
      'total', v_session.score
    );
  end if;

  update public.solo_sessions
    set score = v_session.score,
        lives = v_session.lives,
        status = v_status,
        current_round = v_round,
        question_ids = v_ids,
        streak = v_streak,
        best_streak = v_session.best_streak,
        anchor = case when v_correct then v_session.anchor else false end,
        wildcards = v_session.wildcards,
        roulette_mid_done = v_session.roulette_mid_done,
        summary = v_summary,
        last_result = jsonb_build_object(
          'correct', v_correct,
          'correct_answer', v_correct_answer,
          'round', v_session.current_round,
          'points_gained', v_gained,
          'streak', v_streak,
          'multiplier', public._solo_multiplier(v_streak, v_session.settings),
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
    'points_gained', v_gained,
    'streak', v_streak,
    'best_streak', v_session.best_streak,
    'multiplier', public._solo_multiplier(v_streak, v_session.settings),
    'anchor', case when v_correct then v_session.anchor else false end,
    'wildcards', v_session.wildcards,
    'roll', v_roll,
    'summary', case when v_status <> 'playing' then v_summary else '{}'::jsonb end,
    'round', v_round,
    'total', v_total,
    'question', v_question
  );
end;
$$;
grant execute on function public.answer_solo(uuid, text) to anon, authenticated;

-- =========================================================
-- ESTADO COMPLETO
-- =========================================================

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
    'streak', s.streak,
    'best_streak', s.best_streak,
    'anchor', s.anchor,
    'wildcards', s.wildcards,
    'summary', s.summary,
    'settings', s.settings,
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
