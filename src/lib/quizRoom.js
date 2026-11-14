export function rankPlayers(players) {
  return [...players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );
}

export function teamTotals(players) {
  return players.reduce((totals, player) => {
    if (player.team) {
      totals[player.team] = (totals[player.team] || 0) + player.score;
    }
    return totals;
  }, {});
}

export function modeLabel(mode) {
  return {
    '1v1': 'Duelo 1 vs 1',
    '2v2': 'Equipos 2 vs 2',
    ffa4: 'Todos contra todos (4)'
  }[mode] || mode;
}

export function sideLayout(players, mode) {
  if (mode === '2v2') {
    return {
      left: players.filter((player) => player.team === 'A'),
      right: players.filter((player) => player.team === 'B')
    };
  }
  if (mode === '1v1') {
    return { left: players.slice(0, 1), right: players.slice(1) };
  }
  const half = Math.ceil(players.length / 2);
  return { left: players.slice(0, half), right: players.slice(half) };
}

export function canAnswer(room, playerId) {
  if (room.phase === 'answering') return room.buzzed_by === playerId;
  if (room.phase === 'steal') return !(room.blocked_players || []).includes(playerId);
  return false;
}

export function timeoutDue(room, now) {
  if (!room || room.status !== 'playing' || !room.round_deadline) return false;
  if (room.phase !== 'question' && room.phase !== 'answering' && room.phase !== 'steal') {
    return false;
  }
  return now >= new Date(room.round_deadline).getTime();
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function avatarHue(name) {
  let hash = 0;
  for (const char of String(name || '')) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return hash;
}

export function winnerOf(players, mode) {
  if (mode === '2v2') {
    const entries = Object.entries(teamTotals(players)).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return { kind: 'tie', score: 0 };
    if (entries.length > 1 && entries[0][1] === entries[1][1]) {
      return { kind: 'tie', score: entries[0][1] };
    }
    return { kind: 'team', team: entries[0][0], score: entries[0][1] };
  }

  const ranking = rankPlayers(players);
  if (ranking.length === 0) return { kind: 'tie', score: 0 };
  if (ranking.length > 1 && ranking[0].score === ranking[1].score) {
    return { kind: 'tie', score: ranking[0].score };
  }
  return { kind: 'player', player: ranking[0], score: ranking[0].score };
}

export function feedbackForRound(feedback, currentRound) {
  if (!feedback) return null;
  if (typeof feedback.round !== 'number') return feedback;
  if (feedback.round === currentRound) return feedback;
  if (feedback.round === currentRound - 1 && (feedback.correct === true || feedback.timeout === true)) {
    return feedback;
  }
  return null;
}

export function resultIdentity(feedback) {
  if (!feedback) return '';
  return `${feedback.at ?? ''}|${feedback.round ?? ''}|${feedback.player_id ?? ''}`;
}

export function feedbackKey(feedback) {
  if (!feedback) return '';
  return `${feedback.at ?? ''}|${feedback.correct_answer ?? ''}|${feedback.round ?? ''}`;
}

export function hostAway(players, now, staleMs = 30000, freshMs = 15000) {  const host = players.find((player) => player.is_host);
  const away = !host
    || (host.last_seen ? now - Date.parse(host.last_seen) > staleMs : true);

  if (!away) return { away: false, claimerId: null };

  const claimer = players.find((player) => !player.is_host
    && player.last_seen
    && now - Date.parse(player.last_seen) <= freshMs);

  return { away: true, claimerId: claimer ? claimer.id : null };
}

export function shareText(room, players) {
  const ranking = rankPlayers(players)
    .map((player, index) => `${index + 1}. ${player.name} - ${player.score}`)
    .join('\n');

  return `⚓ El Casillero de Davy D. Jones - ${modeLabel(room.mode)}\n${ranking}\n\n¿Me superas?`;
}

const ENTRY_CLASSES = ['top', 'left', 'right'];

export function entryClass(seed) {
  const index = Math.abs(Math.trunc(seed)) % ENTRY_CLASSES.length;
  return `ask-enter--${ENTRY_CLASSES[index]}`;
}

export function bestStreakOf(answers) {
  let best = 0;
  let run = 0;
  for (const answer of answers || []) {
    run = answer?.isCorrect ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function duelStatsFor(results) {
  const byPlayer = {};
  const rounds = new Set();

  for (const result of results || []) {
    if (!result) continue;
    if (typeof result.round === 'number') rounds.add(result.round);

    const id = result.player_id;
    if (!id) continue;

    const entry = byPlayer[id] || { correct: 0, wrong: 0, streak: 0, best: 0 };
    if (result.correct === true) {
      entry.correct += 1;
      entry.streak += 1;
      entry.best = Math.max(entry.best, entry.streak);
    } else {
      entry.wrong += 1;
      entry.streak = 0;
    }
    byPlayer[id] = entry;
  }

  return { byPlayer, rounds: rounds.size };
}
