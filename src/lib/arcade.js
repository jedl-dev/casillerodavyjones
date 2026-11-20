import { supabase } from './supabase';
import { setPlayerName } from './user';
import { toIdentity } from './identity';

export { toIdentity };

const IDENTITY_KEY = 'opq:arcade';

export function getArcadeIdentity() {
  try {
    return JSON.parse(window.localStorage.getItem(IDENTITY_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setArcadeIdentity(identity) {
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Sin almacenamiento: la identidad vive solo en memoria.
  }
  if (identity?.username) setPlayerName(identity.username);
  try {
    window.dispatchEvent(new CustomEvent('opq:identity', { detail: identity }));
  } catch {
    // Sin window (SSR): no hay nada que anunciar.
  }
}

export function clearArcadeIdentity() {
  try {
    window.localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // Sin almacenamiento.
  }
  try {
    window.dispatchEvent(new CustomEvent('opq:identity', { detail: null }));
  } catch {
    // Sin window (SSR): no hay nada que anunciar.
  }
}

export async function getArcadePlayer() {
  const { data, error } = await supabase.rpc('get_arcade_player');
  if (error) throw new Error(error.message);
  return data;
}

export async function claimArcadeName(name) {
  const clean = String(name || '').trim();
  const { data, error } = await supabase.rpc('claim_arcade_name', {
    p_name: clean,
    p_token: null
  });
  if (error) throw new Error(error.message);

  const identity = toIdentity(data, getArcadeIdentity());
  setArcadeIdentity(identity);
  return identity;
}

export async function updateArcadeProfile(token, avatarKey, frameKey, country = null, syncCountry = true) {
  const params = { p_token: token, p_avatar_key: avatarKey, p_frame_key: frameKey };
  let data;
  let error;
  let countrySynced = syncCountry;

  if (syncCountry) {
    ({ data, error } = await supabase.rpc('update_arcade_profile', {
      ...params,
      p_country: country || null
    }));

    // Sin la migración 0021 la función no acepta país: se guarda el resto igual.
    if (error && /Could not find the function|PGRST202|schema cache/i.test(error.message)) {
      countrySynced = false;
      ({ data, error } = await supabase.rpc('update_arcade_profile', params));
    }
  } else {
    ({ data, error } = await supabase.rpc('update_arcade_profile', params));
  }

  if (error) throw new Error(error.message);

  const current = getArcadeIdentity();
  const identity = {
    ...(current || {}),
    username: data.username,
    avatar_key: data.avatar_key,
    frame_key: data.frame_key,
    country: countrySynced ? (data.country ?? country ?? null) : (country ?? null),
    day_streak: data.day_streak ?? current?.day_streak ?? 0,
    best_day_streak: data.best_day_streak ?? current?.best_day_streak ?? 0,
    last_played_on: data.last_played_on ?? current?.last_played_on ?? null
  };
  setArcadeIdentity(identity);
  return { identity, countrySynced };
}

export async function claimSoloScore(sessionToken) {
  const { data, error } = await supabase.rpc('claim_solo_score', { p_session: sessionToken });
  if (error) throw new Error(error.message);
  return data;
}

const LEADERBOARDS = {
  solo: {
    all: 'arcade_solo_leaderboard_all',
    week: 'arcade_solo_leaderboard_week',
    order: 'score',
    columns: 'id, username, avatar_key, frame_key, score, rank',
    baseColumns: 'id, username, avatar_key, frame_key, score'
  },
  duel: {
    all: 'arcade_duel_leaderboard_all',
    week: 'arcade_duel_leaderboard_week',
    order: 'wins',
    columns: 'id, username, avatar_key, frame_key, wins, rank',
    baseColumns: 'id, username, avatar_key, frame_key, wins'
  }
};

// Sin la migración 0022 las vistas no tienen game_key ni rank.
const missingGameColumn = (error) => Boolean(
  error && /game_key|rank|column .* does not exist|42703/i.test(error.message)
);

export async function fetchLeaderboard(kind, period, game = 'quiz', limit = 20) {
  const table = LEADERBOARDS[kind] || LEADERBOARDS.solo;
  const source = period === 'week' ? table.week : table.all;

  const build = (complete) => {
    let query = supabase
      .from(source)
      .select(complete ? table.columns : table.baseColumns)
      .order(table.order, { ascending: false })
      .limit(limit);
    if (complete) query = query.eq('game_key', game);
    return query;
  };

  let { data, error } = await build(true);
  if (missingGameColumn(error)) ({ data, error } = await build(false));

  if (error) throw new Error(error.message);
  return data;
}

// Marcas propias: las vistas ya exponen una fila por jugador.
export async function fetchPlayerStats(username, game = 'quiz') {
  if (!username) {
    return { bestSolo: null, soloRow: null, duelWins: 0, duelRow: null };
  }

  const fetchOne = async (view, columns, baseColumns) => {
    const build = (complete) => {
      let query = supabase.from(view).select(complete ? columns : baseColumns).eq('username', username);
      if (complete) query = query.eq('game_key', game);
      return query.maybeSingle();
    };

    let { data, error } = await build(true);
    if (missingGameColumn(error)) ({ data, error } = await build(false));
    if (error) throw new Error(error.message);
    return data;
  };

  const [solo, duel] = await Promise.all([
    fetchOne(
      'arcade_solo_leaderboard_all',
      'id, username, avatar_key, frame_key, score, created_at, rank',
      'id, username, avatar_key, frame_key, score, created_at'
    ),
    fetchOne(
      'arcade_duel_leaderboard_all',
      'id, username, avatar_key, frame_key, wins, rank',
      'id, username, avatar_key, frame_key, wins'
    )
  ]);

  return {
    bestSolo: solo?.score ?? null,
    soloAt: solo?.created_at ?? null,
    soloRow: solo ?? null,
    duelWins: duel?.wins ?? 0,
    duelRow: duel ?? null
  };
}
