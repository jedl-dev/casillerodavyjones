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

export const startSolo = () => rpc('start_solo');

export const answerSolo = (token, choice) =>
  rpc('answer_solo', { p_token: token, p_answer: choice });

export const getSoloState = (token) =>
  rpc('get_solo_state', { p_token: token });

export const useWildcard = (token, type) =>
  rpc('use_wildcard', { p_token: token, p_type: type });

export const createRoom = (name, mode, clientId) =>
  rpc('create_room', { p_name: name, p_mode: mode, p_client_id: clientId });

export const joinRoom = (code, name, clientId) =>
  rpc('join_room', { p_code: code, p_name: name, p_client_id: clientId });

export const quickMatch = (name, clientId, mode) =>
  rpc('quick_match', { p_name: name, p_client_id: clientId, p_mode: mode });

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

export async function listQuestions() {
  return unwrap(
    await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })
  );
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
