import { supabase } from './supabase';

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    if (/schema cache|Could not find the function|does not exist/i.test(error.message)) {
      throw new Error('La base de datos no está actualizada. Ejecuta las migraciones de supabase/migrations.');
    }
    throw new Error(error.message);
  }
  return data;
}

export const startSolo = (playerToken = null) => rpc('start_solo', { p_player_token: playerToken });

export const answerSolo = (token, choice) =>
  rpc('answer_solo', { p_token: token, p_answer: choice });

export const advanceSolo = (token) => rpc('advance_solo', { p_token: token });

export const beginSolo = (token) => rpc('begin_solo', { p_token: token });

export const placeBet = (token, active) =>
  rpc('place_bet', { p_token: token, p_active: active });

export const getSoloState = (token) =>
  rpc('get_solo_state', { p_token: token });

export const useWildcard = (token, type, category = null) =>
  rpc('use_wildcard', { p_token: token, p_type: type, p_category: category });

export const soloCategories = () => rpc('solo_categories');

async function rpcWithGame(name, params) {
  try {
    return await rpc(name, params);
  } catch (error) {
    // Sin la migración 0022 la función no acepta p_game_key: se crea igual.
    if (/no está actualizada|Could not find the function|PGRST202|schema cache/i.test(error.message)) {
      const { p_game_key: _game, ...legacy } = params;
      return rpc(name, legacy);
    }
    throw error;
  }
}

export const createRoom = (name, mode, clientId, playerToken = null, gameKey = 'quiz') =>
  rpcWithGame('create_room', {
    p_name: name,
    p_mode: mode,
    p_client_id: clientId,
    p_player_token: playerToken,
    p_game_key: gameKey
  });

export const joinRoom = (code, name, clientId, playerToken = null) =>
  rpc('join_room', {
    p_code: code,
    p_name: name,
    p_client_id: clientId,
    p_player_token: playerToken
  });

export const quickMatch = (name, clientId, mode, playerToken = null, gameKey = 'quiz') =>
  rpcWithGame('quick_match', {
    p_name: name,
    p_client_id: clientId,
    p_mode: mode,
    p_player_token: playerToken,
    p_game_key: gameKey
  });

export const startRoom = (code, token) =>
  rpc('start_room', { p_code: code, p_token: token });

export const getRoomState = (code) =>
  rpc('get_room_state', { p_code: code });

export const buzz = (code, token) =>
  rpc('buzz', { p_code: code, p_token: token });

export const answer = (code, token, choice) =>
  rpc('answer', { p_code: code, p_token: token, p_answer: choice });

export const forceTimeout = (code, token) =>
  rpc('force_timeout', { p_code: code, p_token: token });

export const leaveRoom = (code, token) =>
  rpc('leave_room', { p_code: code, p_token: token });

export const pingRoom = (code, token) =>
  rpc('ping', { p_code: code, p_token: token });

export const claimHost = (code, token) =>
  rpc('claim_host', { p_code: code, p_token: token });

export const reportQuestion = (questionId, reason, note, clientId) =>
  rpc('report_question', {
    p_question_id: questionId,
    p_reason: reason,
    p_note: note,
    p_client_id: clientId
  });

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function listQuestions({ search = '', difficulty = '', category = '', from = 0, size = 20 } = {}) {
  let query = supabase
    .from('questions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (difficulty) query = query.eq('difficulty', difficulty);
  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('question_text', `%${search}%`);

  const { data, error, count } = await query.range(from, from + size - 1);
  if (error) throw new Error(error.message);

  return { rows: data || [], total: count ?? (data || []).length };
}

export async function listQuestionCategories() {
  const { data, error } = await supabase
    .from('questions')
    .select('category')
    .limit(1000);

  if (error) throw new Error(error.message);

  return [...new Set((data || []).map((row) => row.category).filter(Boolean))].sort();
}

export async function createQuestion(row) {
  return unwrap(await supabase.from('questions').insert(row).select().single());
}

export async function updateQuestion(id, row) {
  return unwrap(
    await supabase.from('questions').update(row).eq('id', id).select().single()
  );
}

export async function deleteQuestion(id) {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getGameSettings() {
  return unwrap(
    await supabase.from('game_settings').select('*').eq('id', true).single()
  );
}

export async function updateGameSettings(row) {
  return unwrap(
    await supabase.from('game_settings').update(row).eq('id', true).select().single()
  );
}

export async function listQuestionReports() {
  const { data, error } = await supabase
    .from('question_reports')
    .select('id, reason, note, created_at, resolved_at, question_id, questions(id, question_text, difficulty, category, correct_answer)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function resolveQuestionReport(id, resolved) {
  const { error } = await supabase
    .from('question_reports')
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
