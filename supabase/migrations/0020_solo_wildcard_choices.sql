-- Migración 0020: Robin elige categoría, nuevos comodines, tiempo y limpieza de pausa.
-- Ejecutar después de 0019_solo_gameplay.sql.

alter table public.solo_sessions
  add column if not exists pending_category text,
  add column if not exists pending_reroll boolean not null default false,
  add column if not exists time_multiplier numeric not null default 1
    check (time_multiplier > 0);

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
  v_good text[] := array['ojo', 'ancla', 'pose', 'marea'];
  v_neutral text[] := array['fruta', 'den_den', 'haki', 'sake', 'bazuca', 'mihawk', 'law', 'shanks'];
  v_bad text[] := array['yami', 'buggy'];
  v_total int := greatest(p_good + p_neutral + p_bad, 1);
  v_bag jsonb := '{"filo":0,"alma":0,"ancla":0,"ojo":0,"pose":0,"marea":0,"den_den":0,"haki":0,"sake":0,"bazuca":0,"mihawk":0,"law":0,"shanks":0,"fruta":0,"yami":0,"buggy":0}'::jsonb;
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
      v_type := v_neutral[1 + floor(random() * array_length(v_neutral, 1))::int];
    end if;

    v_bag := jsonb_set(v_bag, array[v_type], to_jsonb((v_bag ->> v_type)::int + 1));
    v_rolls := v_rolls || jsonb_build_array(jsonb_build_object('type', v_type, 'kind', v_kind));
  end loop;

  return jsonb_build_object('bag', v_bag, 'rolls', v_rolls);
end;
$$;

drop function if exists public.use_wildcard(uuid, text);

create or replace function public.use_wildcard(p_token uuid, p_type text, p_category text default null)
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
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
  v_chain text[] := array['filo', 'marea', 'alma', 'ancla', 'ojo', 'pose', 'den_den', 'haki', 'sake', 'bazuca', 'mihawk', 'law', 'shanks', 'yami', 'buggy'];
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
  if v_type not in ('filo', 'marea', 'alma', 'ancla', 'ojo', 'pose', 'den_den', 'haki', 'sake', 'bazuca', 'mihawk', 'law', 'shanks', 'fruta', 'yami', 'buggy') then
    raise exception 'Comodín inválido';
  end if;
  if coalesce((v_session.wildcards ->> v_type)::int, 0) <= 0 then
    raise exception 'No te quedan comodines de ese tipo';
  end if;
  if v_type = 'ancla' and v_session.anchor then
    raise exception 'El ancla ya está echada';
  end if;

  v_bag := jsonb_set(
    v_session.wildcards,
    array[v_type],
    to_jsonb(coalesce((v_session.wildcards ->> v_type)::int, 0) - 1)
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

  if v_type = 'haki' then
    update public.solo_sessions
      set wildcards = v_bag, round_multiplier = 2, no_streak = true,
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'haki', 'phase', 'between',
      'wildcards', v_bag, 'round_multiplier', 2, 'no_streak', true
    );
  end if;

  if v_type = 'sake' then
    v_lives_max := coalesce((v_session.settings ->> 'lives_max')::int, 5);

    update public.solo_sessions
      set wildcards = v_bag,
          lives = least(v_session.lives + 1, v_lives_max),
          round_multiplier = 0.5,
          wildcard_between_used = true
      where id = v_session.id
      returning * into v_session;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'sake', 'phase', 'between',
      'wildcards', v_bag, 'lives', v_session.lives, 'round_multiplier', 0.5
    );
  end if;

  if v_type = 'mihawk' then
    update public.solo_sessions
      set wildcards = v_bag, zero_points = true, no_streak = true,
          pending_hint = 'answer', wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'mihawk', 'phase', 'between',
      'wildcards', v_bag, 'zero_points', true, 'deferred', true
    );
  end if;

  if v_type = 'den_den' then
    update public.solo_sessions
      set wildcards = v_bag, pending_hint = 'letter', round_multiplier = 0.5,
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'den_den', 'phase', 'between',
      'wildcards', v_bag, 'round_multiplier', 0.5, 'deferred', true
    );
  end if;

  if v_type = 'bazuca' then
    update public.solo_sessions
      set wildcards = v_bag, pending_filo = true, pending_harder = true,
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'bazuca', 'phase', 'between',
      'wildcards', v_bag, 'deferred', true
    );
  end if;

  if v_type = 'marea' then
    update public.solo_sessions
      set wildcards = v_bag, pending_easier = true, wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'marea', 'phase', 'between',
      'wildcards', v_bag, 'deferred', true
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

  if v_type = 'law' then
    update public.solo_sessions
      set wildcards = v_bag, pending_reroll = true, wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'law', 'phase', 'between',
      'wildcards', v_bag, 'deferred', true
    );
  end if;

  if v_type = 'shanks' then
    update public.solo_sessions
      set wildcards = v_bag, round_multiplier = 2, yami_active = false,
          time_multiplier = 0.5, wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'shanks', 'phase', 'between',
      'wildcards', v_bag, 'round_multiplier', 2, 'time_multiplier', 0.5
    );
  end if;

  if v_type = 'ojo' then
    if v_category is null or not exists (
      select 1 from public.questions where category = v_category
    ) then
      select category into v_category
      from public.questions
      where category is not null and btrim(category) <> ''
      order by random()
      limit 1;
    end if;

    update public.solo_sessions
      set wildcards = v_bag,
          pending_category = v_category,
          pending_ojo = false,
          wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'ojo', 'phase', 'between',
      'wildcards', v_bag, 'category', v_category, 'deferred', true
    );
  end if;

  if v_type = 'filo' then
    update public.solo_sessions
      set wildcards = v_bag, pending_filo = true, wildcard_between_used = true
      where id = v_session.id;

    return jsonb_build_object(
      'ok', true, 'used', v_used, 'resolved', 'filo', 'phase', 'between',
      'wildcards', v_bag, 'deferred', true
    );
  end if;

  raise exception 'Comodín inválido';
end;
$$;

create or replace function public.solo_categories()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(category order by category), '[]'::jsonb)
  from (
    select distinct category
    from public.questions
    where category is not null and btrim(category) <> ''
  ) s;
$$;
grant execute on function public.solo_categories() to anon, authenticated;

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
  v_mult numeric := 1;
  v_round_mult numeric;
  v_limit int;
  v_elapsed int;
  v_time_bonus int := 0;
  v_bet_stake int := 0;
  v_bet_delta int := 0;
  v_bets_max int;
  v_bets_left int;
  v_gained int;
  v_life_cost int;
  v_flag int;
  v_roll jsonb := '[]'::jsonb;
  v_bonus_wildcards int := 0;
  v_bonus_lives int := 0;
  v_summary jsonb := '{}'::jsonb;
  v_phase text;
  v_key text;
  v_value int;
  v_skip_streak boolean;
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
  v_skip_streak := coalesce(v_session.no_streak, false) or coalesce(v_session.zero_points, false);

  select correct_answer, difficulty into v_correct_answer, v_difficulty
  from public.questions where id = v_ids[v_round];

  v_correct := coalesce(v_correct_answer = p_answer, false);
  v_limit := greatest(5, ceil(public._time_limit(v_difficulty, v_session.settings) * coalesce(v_session.time_multiplier, 1))::int);
  v_elapsed := case
    when v_session.question_started_at is null then 0
    else greatest(0, floor(extract(epoch from (now() - v_session.question_started_at)))::int)
  end;
  if v_elapsed > v_limit + 2 then
    v_correct := false;
  end if;
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

    if v_skip_streak then
      v_mult := 1;
    else
      v_streak := v_streak + 1;
      v_mult := public._solo_multiplier(v_streak, v_session.settings);
    end if;

    if coalesce(v_session.zero_points, false) then
      v_gained := 0;
    else
      v_gained := round(v_base * v_mult * v_round_mult)::int;
      v_time_bonus := greatest(0, v_limit - v_elapsed)
        * coalesce((v_session.settings ->> 'time_bonus_per_second')::int, 1000);
      v_gained := v_gained + v_time_bonus;
    end if;

    v_session.score := v_session.score + v_gained;

    if v_skip_streak then
      v_streak := 0;
    else
      v_session.best_streak := greatest(v_session.best_streak, v_streak);
    end if;

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

  -- Apuesta doble o nada
  v_bet_stake := case
    when coalesce(v_session.bet_active, false) then coalesce(v_session.bet_stake, 0)
    else 0
  end;

  if v_bet_stake > 0 and not coalesce(v_session.zero_points, false) then
    if v_correct then
      v_bet_delta := v_bet_stake;
    else
      v_bet_delta := -least(v_bet_stake, greatest(v_session.score, 0));
    end if;
    v_session.score := v_session.score + v_bet_delta;
    v_session.bets_used := coalesce(v_session.bets_used, 0) + 1;
  end if;

  v_bets_max := coalesce((v_session.settings ->> 'bets_per_run')::int, 3);
  v_bets_left := greatest(v_bets_max - coalesce(v_session.bets_used, 0), 0);

  -- Bandera nueva: tirada de comodines
  if v_status = 'playing' then
    v_flag := public._flag_of(v_round, v_total);

    if v_flag > coalesce(v_session.last_flag, 0) then
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

      v_session.last_flag := v_flag;
      v_session.tide_rolls := coalesce(v_session.tide_rolls, 0) + 1;
    end if;
  end if;

  if v_status = 'won' then
    v_bonus_wildcards := (v_session.settings ->> 'bonus_unused_wildcard')::int
      * ((v_session.wildcards ->> 'filo')::int
       + (v_session.wildcards ->> 'alma')::int
       + (v_session.wildcards ->> 'ancla')::int
       + (v_session.wildcards ->> 'ojo')::int
       + (v_session.wildcards ->> 'pose')::int
       + (v_session.wildcards ->> 'marea')::int
       + (v_session.wildcards ->> 'den_den')::int
       + (v_session.wildcards ->> 'haki')::int
       + (v_session.wildcards ->> 'sake')::int
       + (v_session.wildcards ->> 'bazuca')::int
       + (v_session.wildcards ->> 'mihawk')::int
       + (v_session.wildcards ->> 'fruta')::int
       + coalesce((v_session.wildcards ->> 'law')::int, 0)
       + coalesce((v_session.wildcards ->> 'shanks')::int, 0));
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
        last_flag = v_session.last_flag,
        tide_rolls = v_session.tide_rolls,
        round_multiplier = 1,
        question_started_at = null,
        time_multiplier = 1,
        pending_category = null,
        pending_reroll = false,
        bets_used = v_session.bets_used,
        bet_active = false,
        bet_stake = 0,
        yami_active = false,
        no_streak = false,
        zero_points = false,
        pending_filo = false,
        pending_ruta = false,
        pending_ojo = false,
        pending_easier = false,
        pending_harder = false,
        pending_hint = null,
        wildcard_between_used = false,
        last_roll = coalesce(v_roll -> 'rolls', '[]'::jsonb),
        summary = v_summary,
        last_result = jsonb_build_object(
          'correct', v_correct,
          'correct_answer', v_correct_answer,
          'round', v_session.current_round,
          'points_gained', v_gained,
          'streak', v_streak,
          'multiplier', v_mult,
          'time_limit', v_limit,
          'elapsed', v_elapsed,
          'time_bonus', v_time_bonus,
          'bet_stake', v_bet_stake,
          'bet_delta', v_bet_delta,
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
    'multiplier', v_mult,
    'time_limit', v_limit,
    'elapsed', v_elapsed,
    'time_bonus', v_time_bonus,
    'bet_stake', v_bet_stake,
    'bet_delta', v_bet_delta,
    'bets_left', v_bets_left,
    'anchor', case when v_correct then v_session.anchor else false end,
    'wildcards', v_session.wildcards,
    'roll', coalesce(v_roll -> 'rolls', '[]'::jsonb),
    'summary', case when v_phase = 'finished' then v_summary else '{}'::jsonb end,
    'round', v_round,
    'total', v_total
  );
end;
$$;

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
  v_disabled text[];
  v_new uuid;
  v_band int;
  v_target int;
  v_bands text[] := array['Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible'];
  v_hint_type text;
  v_hint_value text;
  v_wrong text[];
  v_limit int;
  v_bet_stake int := 0;
  v_bets_max int;
  v_bets_left int;
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

  if v_session.pending_easier or v_session.pending_harder then
    select public._tide_of(difficulty) into v_band
    from public.questions where id = v_ids[v_round];

    v_target := case
      when v_session.pending_easier then greatest(1, v_band - 1)
      when v_session.pending_harder then least(5, v_band + 1)
      else v_band
    end;

    if v_target <> v_band then
      select q.id into v_new
      from public.questions q
      where q.difficulty = v_bands[v_target]
        and q.id <> all (v_ids)
      order by random()
      limit 1;

      if v_new is not null then
        v_ids[v_round] := v_new;
      end if;
    end if;
  end if;

  if coalesce(v_session.pending_reroll, false) then
    select q.id into v_new
    from public.questions q
    where q.difficulty = (
      select difficulty from public.questions where id = v_ids[v_round]
    )
      and q.id <> all (v_ids)
    order by random()
    limit 1;

    if v_new is not null then
      v_ids[v_round] := v_new;
    end if;
  end if;

  if v_session.pending_category is not null then
    v_category := v_session.pending_category;

    select q.id into v_new
    from public.questions q
    where q.category = v_category
      and q.id <> all (v_ids)
    order by random()
    limit 1;

    if v_new is not null then
      v_ids[v_round] := v_new;
    else
      select category into v_category
      from public.questions
      where id = v_ids[v_round];
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
    select category into v_category
    from public.questions where id = v_ids[v_round];
  end if;

  if v_session.pending_hint is not null then
    select correct_answer into v_correct
    from public.questions where id = v_ids[v_round];

    v_hint_type := v_session.pending_hint;
    v_hint_value := case
      when v_session.pending_hint = 'letter' then upper(substr(v_correct, 1, 1))
      else v_correct
    end;
  end if;

  if coalesce(v_session.bet_active, false) then
    select case q.difficulty
      when 'Fácil' then (v_session.settings ->> 'points_facil')::int
      when 'Intermedia' then (v_session.settings ->> 'points_intermedia')::int
      when 'Difícil' then (v_session.settings ->> 'points_dificil')::int
      when 'Muy Difícil' then (v_session.settings ->> 'points_muy_dificil')::int
      when 'Imposible' then (v_session.settings ->> 'points_imposible')::int
      else 1000
    end
    into v_bet_stake
    from public.questions q
    where q.id = v_ids[v_round];

    v_bet_stake := coalesce(v_bet_stake, 0);
  end if;

  update public.solo_sessions
    set question_ids = v_ids,
        phase = 'question',
        question_started_at = now(),
        pending_filo = false,
        pending_ruta = false,
        pending_ojo = false,
        pending_category = null,
        pending_reroll = false,
        pending_easier = false,
        pending_harder = false,
        pending_hint = null,
        wildcard_between_used = false,
        last_roll = '[]'::jsonb,
        bet_stake = v_bet_stake
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

  v_limit := greatest(5, ceil(public._time_limit(v_question ->> 'difficulty', v_session.settings) * coalesce(v_session.time_multiplier, 1))::int);
  v_bets_max := coalesce((v_session.settings ->> 'bets_per_run')::int, 3);
  v_bets_left := greatest(v_bets_max - coalesce(v_session.bets_used, 0), 0);

  return jsonb_build_object(
    'phase', 'question',
    'question', v_question,
    'disabled', coalesce(v_disabled, '{}'),
    'category', coalesce(v_category, null),
    'hint_type', coalesce(v_hint_type, null),
    'hint_value', coalesce(v_hint_value, null),
    'wildcards', v_session.wildcards,
    'round_multiplier', v_session.round_multiplier,
    'yami_active', v_session.yami_active,
    'no_streak', v_session.no_streak,
    'zero_points', v_session.zero_points,
    'anchor', v_session.anchor,
    'lives', v_session.lives,
    'score', v_session.score,
    'streak', v_session.streak,
    'round', v_round,
    'time_limit', v_limit,
    'bet_active', v_session.bet_active,
    'bet_stake', v_bet_stake,
    'bets_left', v_bets_left,
    'total', coalesce(array_length(v_ids, 1), 0)
  );
end;
$$;

grant execute on function public.use_wildcard(uuid, text, text) to anon, authenticated;
