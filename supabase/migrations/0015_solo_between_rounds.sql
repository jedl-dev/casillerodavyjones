-- Migración 0015: comodines solo entre rondas, preparando la siguiente.
-- Ejecutar después de 0014_solo_onepiece_wildcards.sql.

alter table public.solo_sessions
  add column if not exists phase text not null default 'question'
    check (phase in ('question', 'between', 'finished')),
  add column if not exists pending_filo boolean not null default false,
  add column if not exists pending_ruta boolean not null default false,
  add column if not exists pending_ojo boolean not null default false,
  add column if not exists wildcard_between_used boolean not null default false,
  add column if not exists last_roll jsonb not null default '[]'::jsonb;

update public.solo_sessions
  set phase = case when status = 'playing' then 'question' else 'finished' end
  where phase is null or phase = 'question';

-- =========================================================
-- RESPONDER: CIERRA LA RONDA Y ABRE LA PAUSA
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
  v_phase text;
  v_key text;
  v_value int;
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
  if coalesce(v_session.phase, 'question') <> 'question' then
    raise exception 'Primero continúa a la siguiente ronda';
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

      for v_key, v_value in
        select key, value::int from jsonb_each_text(v_roll -> 'bag')
      loop
        v_session.wildcards := jsonb_set(
          coalesce(v_session.wildcards, '{}'::jsonb),
          array[v_key],
          to_jsonb(coalesce((v_session.wildcards ->> v_key)::int, 0) + v_value)
        );
      end loop;

      v_session.last_tide := v_new_tide;
      v_session.tide_rolls := coalesce(v_session.tide_rolls, 0) + 1;
    end if;
  end if;

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
    v_phase := 'finished';
  elsif v_status = 'lost' then
    v_summary := jsonb_build_object(
      'won', false,
      'bonus_wildcards', 0,
      'bonus_lives', 0,
      'best_streak', v_session.best_streak,
      'total', v_session.score
    );
    v_phase := 'finished';
  else
    v_phase := 'between';
  end if;

  update public.solo_sessions
    set score = v_session.score,
        lives = v_session.lives,
        status = v_status,
        phase = v_phase,
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
        pending_filo = false,
        pending_ruta = false,
        pending_ojo = false,
        wildcard_between_used = false,
        last_roll = coalesce(v_roll -> 'rolls', '[]'::jsonb),
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

  return jsonb_build_object(
    'correct', v_correct,
    'correct_answer', v_correct_answer,
    'finished', v_phase = 'finished',
    'won', v_status = 'won',
    'phase', v_phase,
    'lives', v_session.lives,
    'score', v_session.score,
    'points_gained', v_gained,
    'streak', v_streak,
    'best_streak', v_session.best_streak,
    'multiplier', public._solo_multiplier(v_streak, v_session.settings),
    'anchor', case when v_correct then v_session.anchor else false end,
    'wildcards', v_session.wildcards,
    'roll', coalesce(v_roll -> 'rolls', '[]'::jsonb),
    'summary', case when v_phase = 'finished' then v_summary else '{}'::jsonb end,
    'round', v_round,
    'total', v_total
  );
end;
$$;
grant execute on function public.answer_solo(uuid, text) to anon, authenticated;

-- =========================================================
-- USAR COMODÍN SOLO EN LA PAUSA
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
  v_type text := p_type;
  v_used text := p_type;
  v_lives_max int;
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
  if coalesce(v_session.phase, 'question') <> 'between' then
    raise exception 'Los comodines solo se usan entre rondas';
  end if;
  if v_session.wildcard_between_used then
    raise exception 'Ya usaste un comodín en esta pausa';
  end if;
  if v_type not in ('filo', 'ruta', 'alma', 'ancla', 'ojo', 'pose', 'fruta', 'yami', 'buggy') then
    raise exception 'Comodín inválido';
  end if;
  if (v_session.wildcards ->> v_type)::int <= 0 then
    raise exception 'No te quedan comodines de ese tipo';
  end if;
  if v_type = 'ancla' and v_session.anchor then
    raise exception 'El ancla ya está echada';
  end if;
  if v_type in ('pose', 'yami') and v_session.round_multiplier > 1 then
    raise exception 'Ya hay una marea activa para la siguiente ronda';
  end if;

  v_bag := jsonb_set(
    v_session.wildcards,
    array[v_type],
    to_jsonb((v_session.wildcards ->> v_type)::int - 1)
  );

  if v_type = 'fruta' then
    v_type := v_chain[1 + floor(random() * array_length(v_chain, 1))::int];
  end if;

  if v_type = 'alma' then
    v_lives_max := coalesce((v_session.settings ->> 'lives_max')::int, 5);

    update public.solo_sessions
      set wildcards = v_bag,
          lives = least(v_session.lives + 1, v_lives_max),
          wildcard_between_used = true
      where id = v_session.id
      returning * into v_session;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type, 'phase', 'between',
      'wildcards', v_bag, 'lives', v_session.lives
    );
  end if;

  if v_type = 'ancla' then
    update public.solo_sessions
      set wildcards = v_bag, anchor = true, wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'ancla', 'phase', 'between',
      'wildcards', v_bag, 'anchor', true
    );
  end if;

  if v_type = 'pose' then
    update public.solo_sessions
      set wildcards = v_bag, round_multiplier = 2, yami_active = false,
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'pose', 'phase', 'between',
      'wildcards', v_bag, 'round_multiplier', 2
    );
  end if;

  if v_type = 'yami' then
    update public.solo_sessions
      set wildcards = v_bag, round_multiplier = 2, yami_active = true,
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'yami', 'phase', 'between',
      'wildcards', v_bag, 'round_multiplier', 2, 'yami_active', true,
      'life_cost', coalesce((v_session.settings ->> 'yami_life_cost')::int, 2)
    );
  end if;

  if v_type = 'buggy' then
    update public.solo_sessions
      set wildcards = v_bag, wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'buggy', 'phase', 'between',
      'wildcards', v_bag
    );
  end if;

  if v_type in ('filo', 'ruta', 'ojo') then
    update public.solo_sessions
      set wildcards = v_bag,
          pending_filo = (v_type = 'filo'),
          pending_ruta = (v_type = 'ruta'),
          pending_ojo = (v_type = 'ojo'),
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', v_type, 'phase', 'between',
      'wildcards', v_bag, 'deferred', true
    );
  end if;

  raise exception 'Comodín inválido';
end;
$$;
grant execute on function public.use_wildcard(uuid, text) to anon, authenticated;

-- =========================================================
-- AVANZAR A LA SIGUIENTE PREGUNTA
-- =========================================================

create or replace function public.advance_solo(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.solo_sessions%rowtype;
  v_ids uuid[];
  v_round int;
  v_question jsonb;
  v_correct text;
  v_category text;
  v_result_category text;
  v_wrong text[];
  v_disabled text[];
  v_new uuid;
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
  if coalesce(v_session.phase, 'question') <> 'between' then
    raise exception 'No toca avanzar';
  end if;

  v_ids := v_session.question_ids;
  v_round := v_session.current_round;

  if v_session.pending_ruta then
    select q.id into v_new
    from public.questions q
    where q.difficulty = (select difficulty from public.questions where id = v_ids[v_round])
      and q.id <> all (v_ids)
    order by random()
    limit 1;

    if v_new is not null then
      v_ids[v_round] := v_new;
    end if;
  end if;

  if v_session.pending_filo then
    select correct_answer into v_correct
    from public.questions where id = v_ids[v_round];

    select coalesce(array_agg(option), '{}') into v_wrong
    from (
      select jsonb_array_elements_text(q.options) as option
      from public.questions q where q.id = v_ids[v_round]
    ) s
    where option is distinct from v_correct;

    select coalesce(array_agg(pick), '{}') into v_disabled
    from (
      select pick from unnest(v_wrong) as pick order by random() limit 2
    ) s;
  end if;

  if v_session.pending_ojo then
    select category into v_result_category
    from public.questions where id = v_ids[v_round];
  end if;

  update public.solo_sessions
    set question_ids = v_ids,
        phase = 'question',
        pending_filo = false,
        pending_ruta = false,
        pending_ojo = false,
        wildcard_between_used = false,
        last_roll = '[]'::jsonb
    where id = v_session.id
    returning * into v_session;

  select jsonb_build_object(
    'question_text', q.question_text,
    'options', q.options,
    'difficulty', q.difficulty,
    'image_file', q.image_file
  )
  into v_question
  from public.questions q
  where q.id = v_ids[v_round];

  return jsonb_build_object(
    'phase', 'question',
    'question', v_question,
    'disabled', coalesce(v_disabled, '{}'),
    'category', coalesce(v_result_category, null),
    'wildcards', v_session.wildcards,
    'round_multiplier', v_session.round_multiplier,
    'yami_active', v_session.yami_active,
    'anchor', v_session.anchor,
    'lives', v_session.lives,
    'score', v_session.score,
    'streak', v_session.streak,
    'round', v_round,
    'total', coalesce(array_length(v_ids, 1), 0)
  );
end;
$$;
grant execute on function public.advance_solo(uuid) to anon, authenticated;

-- =========================================================
-- ESTADO CON FASE
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
    'phase', coalesce(s.phase, 'question'),
    'pending_filo', s.pending_filo,
    'pending_ruta', s.pending_ruta,
    'pending_ojo', s.pending_ojo,
    'wildcard_between_used', s.wildcard_between_used,
    'last_roll', s.last_roll,
    'last_result', s.last_result,
    'round', s.current_round,
    'total', coalesce(array_length(s.question_ids, 1), 0),
    'status', s.status,
    'question', case
      when s.status <> 'playing' or coalesce(s.phase, 'question') <> 'question' then null
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
