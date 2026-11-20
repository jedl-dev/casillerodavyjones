-- Migración 0014: comodines de One Piece, ruleta por marea y recompensas en Berries.
-- Ejecutar después de 0013_reports_resolved.sql.

-- =========================================================
-- ESCALA DE BERRIES (x10.000)
-- =========================================================

-- Los topes originales eran 9.999; las recompensas en Berries necesitan más.
alter table public.game_settings drop constraint if exists game_settings_points_facil_check;
alter table public.game_settings drop constraint if exists game_settings_points_intermedia_check;
alter table public.game_settings drop constraint if exists game_settings_points_dificil_check;
alter table public.game_settings drop constraint if exists game_settings_points_muy_dificil_check;
alter table public.game_settings drop constraint if exists game_settings_points_imposible_check;
alter table public.game_settings drop constraint if exists game_settings_bonus_unused_wildcard_check;
alter table public.game_settings drop constraint if exists game_settings_bonus_life_check;

alter table public.game_settings
  add constraint game_settings_points_facil_check check (points_facil between 0 and 100000000),
  add constraint game_settings_points_intermedia_check check (points_intermedia between 0 and 100000000),
  add constraint game_settings_points_dificil_check check (points_dificil between 0 and 100000000),
  add constraint game_settings_points_muy_dificil_check check (points_muy_dificil between 0 and 100000000),
  add constraint game_settings_points_imposible_check check (points_imposible between 0 and 100000000),
  add constraint game_settings_bonus_unused_wildcard_check check (bonus_unused_wildcard between 0 and 100000000),
  add constraint game_settings_bonus_life_check check (bonus_life between 0 and 100000000);

do $$
begin
  if (select points_facil from public.game_settings where id) < 100000 then
    update public.game_settings
      set points_facil = points_facil * 10000,
          points_intermedia = points_intermedia * 10000,
          points_dificil = points_dificil * 10000,
          points_muy_dificil = points_muy_dificil * 10000,
          points_imposible = points_imposible * 10000,
          bonus_unused_wildcard = bonus_unused_wildcard * 10000,
          bonus_life = bonus_life * 10000;

    update public.arcade_scores set score = score * 10000;
    update public.solo_sessions set score = score * 10000 where status = 'playing';
  end if;
end $$;

alter table public.game_settings
  add column if not exists roulette_good int not null default 55
    check (roulette_good between 0 and 100),
  add column if not exists roulette_neutral int not null default 30
    check (roulette_neutral between 0 and 100),
  add column if not exists roulette_bad int not null default 15
    check (roulette_bad between 0 and 100),
  add column if not exists roulette_per_tide int not null default 1
    check (roulette_per_tide between 0 and 4),
  add column if not exists wildcards_max int not null default 8
    check (wildcards_max between 3 and 12),
  add column if not exists yami_life_cost int not null default 2
    check (yami_life_cost between 1 and 5);

alter table public.solo_sessions
  add column if not exists round_multiplier numeric not null default 1,
  add column if not exists yami_active boolean not null default false,
  add column if not exists last_tide int not null default 0,
  add column if not exists tide_rolls int not null default 0;

do $$
begin
  update public.solo_sessions
    set wildcards = coalesce(wildcards, '{}'::jsonb)
      || '{"filo":0,"ruta":0,"alma":0,"ancla":0,"ojo":0,"pose":0,"fruta":0,"yami":0,"buggy":0}'::jsonb
    where status = 'playing';
end $$;

-- =========================================================
-- HELPERS
-- =========================================================

create or replace function public._tide_of(p_difficulty text)
returns int
language sql
immutable
as $$
  select case p_difficulty
    when 'Fácil' then 1
    when 'Intermedia' then 2
    when 'Difícil' then 3
    when 'Muy Difícil' then 4
    when 'Imposible' then 5
    else 0
  end;
$$;

drop function if exists public._roll_wildcards(int, int);

create or replace function public._roll_wildcards(
  p_spins int,
  p_good int,
  p_neutral int,
  p_bad int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_good text[] := array['ojo', 'ancla', 'pose'];
  v_bad text[] := array['yami', 'buggy'];
  v_total int := greatest(p_good + p_neutral + p_bad, 1);
  v_bag jsonb := '{"filo":0,"ruta":0,"alma":0,"ancla":0,"ojo":0,"pose":0,"fruta":0,"yami":0,"buggy":0}'::jsonb;
  v_rolls jsonb := '[]'::jsonb;
  v_roll numeric;
  v_kind text;
  v_type text;
  i int;
begin
  for i in 1..greatest(p_spins, 0) loop
    v_roll := random() * v_total;

    if v_roll < p_good then
      v_kind := 'good';
    elsif v_roll < p_good + p_neutral then
      v_kind := 'neutral';
    else
      v_kind := 'bad';
    end if;

    if v_kind = 'good' then
      v_type := v_good[1 + floor(random() * array_length(v_good, 1))::int];
    elsif v_kind = 'bad' then
      v_type := v_bad[1 + floor(random() * array_length(v_bad, 1))::int];
    else
      v_type := 'fruta';
    end if;

    v_bag := jsonb_set(v_bag, array[v_type], to_jsonb((v_bag ->> v_type)::int + 1));
    v_rolls := v_rolls || jsonb_build_array(jsonb_build_object('type', v_type, 'kind', v_kind));
  end loop;

  return jsonb_build_object('bag', v_bag, 'rolls', v_rolls);
end;
$$;
revoke all on function public._roll_wildcards(int, int, int, int) from public, anon, authenticated;

-- =========================================================
-- EMPEZAR: TRÍO FIJO
-- =========================================================

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
  v_player uuid;
  v_first_tide int;
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
    insert into public.game_settings (id) values (true) returning * into v_settings;
  end if;

  with picks as (
    select id, difficulty,
           row_number() over (partition by difficulty order by random()) as rn
    from public.questions
  ),
  ordered as (
    select id, rn, public._tide_of(difficulty) as tide
    from picks
    where (difficulty = 'Fácil' and rn <= v_settings.rounds_facil)
       or (difficulty = 'Intermedia' and rn <= v_settings.rounds_intermedia)
       or (difficulty = 'Difícil' and rn <= v_settings.rounds_dificil)
       or (difficulty = 'Muy Difícil' and rn <= v_settings.rounds_muy_dificil)
       or (difficulty = 'Imposible' and rn <= v_settings.rounds_imposible)
  )
  select array_agg(id order by tide, rn) into v_questions from ordered;

  if v_questions is null or array_length(v_questions, 1) = 0 then
    raise exception 'No hay preguntas cargadas';
  end if;

  select public._tide_of(difficulty) into v_first_tide
  from public.questions where id = v_questions[1];

  insert into public.solo_sessions (
    question_ids, current_round, lives, wildcards, settings, player_id, last_tide
  )
  values (
    v_questions,
    1,
    v_settings.lives_start,
    '{"filo":1,"ruta":1,"alma":1,"ancla":0,"ojo":0,"pose":0,"fruta":0,"yami":0,"buggy":0}'::jsonb,
    to_jsonb(v_settings),
    v_player,
    v_first_tide
  )
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
    'round_multiplier', v_session.round_multiplier,
    'yami_active', v_session.yami_active,
    'round', v_session.current_round,
    'total', array_length(v_questions, 1),
    'wildcards', v_session.wildcards,
    'roll', '[]'::jsonb,
    'settings', v_session.settings,
    'named', v_player is not null,
    'question', v_question
  );
end;
$$;
grant execute on function public.start_solo(uuid) to anon, authenticated;

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
  v_category text;
  v_wrong text[];
  v_disabled text[];
  v_new uuid;
  v_question jsonb;
  v_lives_max int;
  v_type text := p_type;
  v_used text := p_type;
  v_chain text[] := array['filo', 'ruta', 'alma', 'ancla', 'ojo', 'pose', 'yami', 'buggy'];
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
  if v_type not in ('filo', 'ruta', 'alma', 'ancla', 'ojo', 'pose', 'fruta', 'yami', 'buggy') then
    raise exception 'Comodín inválido';
  end if;
  if (v_session.wildcards ->> v_type)::int <= 0 then
    raise exception 'No te quedan comodines de ese tipo';
  end if;
  if v_session.wildcard_round = v_session.current_round then
    raise exception 'Ya usaste un comodín en esta ronda';
  end if;
  if v_type = 'ancla' and v_session.anchor then
    raise exception 'El ancla ya está echada';
  end if;
  if v_type in ('pose', 'yami') and v_session.round_multiplier > 1 then
    raise exception 'Ya hay una marea activa esta ronda';
  end if;

  v_bag := jsonb_set(
    v_session.wildcards,
    array[v_type],
    to_jsonb((v_session.wildcards ->> v_type)::int - 1)
  );

  if v_type = 'fruta' then
    v_type := v_chain[1 + floor(random() * array_length(v_chain, 1))::int];
  end if;

  v_ids := v_session.question_ids;
  v_question_id := v_ids[v_session.current_round];

  if v_type = 'filo' then
    select correct_answer, category into v_correct, v_category
    from public.questions where id = v_question_id;

    select coalesce(array_agg(option), '{}') into v_wrong
    from (
      select jsonb_array_elements_text(q.options) as option
      from public.questions q where q.id = v_question_id
    ) s
    where option is distinct from v_correct;

    select coalesce(array_agg(pick), '{}') into v_disabled
    from (
      select pick from unnest(v_wrong) as pick order by random() limit 2
    ) s;

    update public.solo_sessions
      set wildcards = v_bag, wildcard_round = v_session.current_round
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'disabled', v_disabled, 'round', v_session.current_round
    );
  end if;

  if v_type = 'ruta' then
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
      set wildcards = v_bag, question_ids = v_ids, wildcard_round = v_session.current_round
      where id = v_session.id;

    select jsonb_build_object(
      'question_text', q.question_text,
      'options', q.options,
      'difficulty', q.difficulty,
      'image_file', q.image_file
    )
    into v_question
    from public.questions q where q.id = v_new;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'question', v_question, 'round', v_session.current_round
    );
  end if;

  if v_type = 'alma' then
    v_lives_max := coalesce((v_session.settings ->> 'lives_max')::int, 5);

    update public.solo_sessions
      set wildcards = v_bag,
          lives = least(v_session.lives + 1, v_lives_max),
          wildcard_round = v_session.current_round
      where id = v_session.id
      returning * into v_session;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'lives', v_session.lives, 'round', v_session.current_round
    );
  end if;

  if v_type = 'ojo' then
    select category into v_category from public.questions where id = v_question_id;

    update public.solo_sessions
      set wildcards = v_bag, wildcard_round = v_session.current_round
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'category', coalesce(v_category, 'General'),
      'round', v_session.current_round
    );
  end if;

  if v_type = 'pose' then
    update public.solo_sessions
      set wildcards = v_bag, round_multiplier = 2, yami_active = false,
          wildcard_round = v_session.current_round
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'round_multiplier', 2, 'round', v_session.current_round
    );
  end if;

  if v_type = 'yami' then
    update public.solo_sessions
      set wildcards = v_bag, round_multiplier = 2, yami_active = true,
          wildcard_round = v_session.current_round
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'round_multiplier', 2, 'yami_active', true,
      'life_cost', coalesce((v_session.settings ->> 'yami_life_cost')::int, 2),
      'round', v_session.current_round
    );
  end if;

  if v_type = 'buggy' then
    update public.solo_sessions
      set wildcards = v_bag, wildcard_round = v_session.current_round
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type,
      'wildcards', v_bag, 'round', v_session.current_round
    );
  end if;

  update public.solo_sessions
    set wildcards = v_bag, anchor = true, wildcard_round = v_session.current_round
    where id = v_session.id;

  return jsonb_build_object(
    'ok', true, 'used', v_used, 'resolved', 'ancla',
    'wildcards', v_bag, 'anchor', true, 'round', v_session.current_round
  );
end;
$$;
grant execute on function public.use_wildcard(uuid, text) to anon, authenticated;

-- =========================================================
-- RESPONDER: MULTIPLICADOR, YAMI Y RULETA POR MAREA
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
  v_round_mult numeric;
  v_gained int;
  v_life_cost int;
  v_new_tide int;
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
  v_round_mult := coalesce(v_session.round_multiplier, 1);

  select correct_answer, difficulty into v_correct_answer, v_difficulty
  from public.questions where id = v_ids[v_round];

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
      else 1000
    end;

    v_streak := v_streak + 1;
    v_mult := public._solo_multiplier(v_streak, v_session.settings);
    v_gained := round(v_base * v_mult * v_round_mult)::int;

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
    v_life_cost := case
      when v_session.yami_active
        then coalesce((v_session.settings ->> 'yami_life_cost')::int, 2)
      else 1
    end;
    v_session.lives := v_session.lives - v_life_cost;

    if v_session.lives <= 0 then
      v_status := 'lost';
    elsif v_session.anchor then
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
      where q.difficulty = v_diff and q.id <> all (v_original)
      order by random() limit 1;
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
        order by random() limit 1;
        if v_pick is not null then
          v_ids[v_failed] := v_pick;
        end if;
      end if;
    end if;
  end if;

  -- La marea cambió: tirada de comodines
  if v_status = 'playing' then
    select public._tide_of(difficulty) into v_new_tide
    from public.questions where id = v_ids[v_round];

    if v_new_tide > coalesce(v_session.last_tide, 0) then
      v_roll := public._roll_wildcards(
        coalesce((v_session.settings ->> 'roulette_per_tide')::int, 1),
        coalesce((v_session.settings ->> 'roulette_good')::int, 55),
        coalesce((v_session.settings ->> 'roulette_neutral')::int, 30),
        coalesce((v_session.settings ->> 'roulette_bad')::int, 15)
      );

      select jsonb_object_agg(key, sum(value::int))
      into v_session.wildcards
      from (
        select key, value from jsonb_each_text(v_session.wildcards)
        union all
        select key, value from jsonb_each_text(v_roll -> 'bag')
      ) s
      group by key;

      v_session.last_tide := v_new_tide;
      v_session.tide_rolls := coalesce(v_session.tide_rolls, 0) + 1;
    end if;
  end if;

  -- Bonus solo si ganas
  if v_status = 'won' then
    v_bonus_wildcards := (v_session.settings ->> 'bonus_unused_wildcard')::int
      * ((v_session.wildcards ->> 'filo')::int
       + (v_session.wildcards ->> 'ruta')::int
       + (v_session.wildcards ->> 'alma')::int
       + (v_session.wildcards ->> 'ancla')::int
       + (v_session.wildcards ->> 'ojo')::int
       + (v_session.wildcards ->> 'pose')::int
       + (v_session.wildcards ->> 'fruta')::int);
    v_bonus_lives := (v_session.settings ->> 'bonus_life')::int * greatest(v_session.lives, 0);

    v_session.score := v_session.score + v_bonus_wildcards + v_bonus_lives;

    v_summary := jsonb_build_object(
      'won', true,
      'bonus_wildcards', v_bonus_wildcards,
      'bonus_lives', v_bonus_lives,
      'best_streak', v_session.best_streak,
      'total', v_session.score
    );
  elsif v_status = 'lost' then
    v_summary := jsonb_build_object(
      'won', false,
      'bonus_wildcards', 0,
      'bonus_lives', 0,
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
        last_tide = v_session.last_tide,
        tide_rolls = v_session.tide_rolls,
        round_multiplier = 1,
        yami_active = false,
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
    'roll', coalesce(v_roll -> 'rolls', '[]'::jsonb),
    'roll_bag', coalesce(v_roll -> 'bag', '{}'::jsonb),
    'summary', case when v_status <> 'playing' then v_summary else '{}'::jsonb end,
    'round', v_round,
    'total', v_total,
    'question', v_question
  );
end;
$$;
grant execute on function public.answer_solo(uuid, text) to anon, authenticated;

-- =========================================================
-- ESTADO
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
    'round_multiplier', s.round_multiplier,
    'yami_active', s.yami_active,
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
