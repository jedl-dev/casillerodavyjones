import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarHue,
  bestStreakOf,
  canAnswer,
  feedbackForRound,
  feedbackKey,
  formatBounty,
  resultIdentity,
  duelStatsFor,
  entryClass,
  hostAway,
  initials,
  modeLabel,
  ownedWildcards,
  rankPlayers,
  shareText,
  sideLayout,
  teamTotals,
  timeoutDue,
  validUsername,
  winnerOf
} from './quizRoom.js';

test('rankPlayers ordena por puntaje y desempata por nombre', () => {
  const players = [
    { id: '1', name: 'Zoro', score: 2, team: null },
    { id: '2', name: 'Luffy', score: 5, team: null },
    { id: '3', name: 'Ace', score: 2, team: null }
  ];

  assert.deepEqual(
    rankPlayers(players).map((player) => player.name),
    ['Luffy', 'Ace', 'Zoro']
  );
});

test('teamTotals suma los puntajes por equipo', () => {
  const players = [
    { name: 'A1', score: 3, team: 'A' },
    { name: 'A2', score: 2, team: 'A' },
    { name: 'B1', score: 4, team: 'B' }
  ];

  assert.deepEqual(teamTotals(players), { A: 5, B: 4 });
});

test('modeLabel traduce los modos conocidos', () => {
  assert.equal(modeLabel('2v2'), 'Equipos 2 vs 2');
  assert.equal(modeLabel('desconocido'), 'desconocido');
});

test('shareText incluye el ranking y el modo', () => {
  const text = shareText(
    { mode: '1v1' },
    [
      { name: 'Luffy', score: 4 },
      { name: 'Ace', score: 1 }
    ]
  );

  assert.match(text, /Duelo 1 vs 1/);
  assert.match(text, /1\. Luffy - 4/);
  assert.match(text, /2\. Ace - 1/);
});

test('sideLayout reparte un jugador por lado en 1v1', () => {
  const players = [
    { id: 'a', name: 'Luffy', score: 0, team: null },
    { id: 'b', name: 'Ace', score: 0, team: null }
  ];

  const { left, right } = sideLayout(players, '1v1');

  assert.deepEqual(left.map((player) => player.id), ['a']);
  assert.deepEqual(right.map((player) => player.id), ['b']);
});

test('sideLayout agrupa por equipo en 2v2', () => {
  const players = [
    { id: 'a1', name: 'Luffy', score: 0, team: 'A' },
    { id: 'b1', name: 'Ace', score: 0, team: 'B' },
    { id: 'a2', name: 'Zoro', score: 0, team: 'A' },
    { id: 'b2', name: 'Nami', score: 0, team: 'B' }
  ];

  const { left, right } = sideLayout(players, '2v2');

  assert.deepEqual(left.map((player) => player.id), ['a1', 'a2']);
  assert.deepEqual(right.map((player) => player.id), ['b1', 'b2']);
});

test('sideLayout reparte dos y dos por orden de llegada en 4 jugadores', () => {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, score: 0, team: null }));

  const { left, right } = sideLayout(players, 'ffa4');

  assert.deepEqual(left.map((player) => player.id), ['a', 'b']);
  assert.deepEqual(right.map((player) => player.id), ['c', 'd']);
});

test('canAnswer solo deja responder a quien pulsó BUZZ', () => {
  assert.equal(canAnswer({ phase: 'answering', buzzed_by: 'p1' }, 'p1'), true);
  assert.equal(canAnswer({ phase: 'answering', buzzed_by: 'p1' }, 'p2'), false);
});

test('canAnswer deja robar a quien no está bloqueado', () => {
  assert.equal(canAnswer({ phase: 'steal', blocked_players: ['p1'] }, 'p2'), true);
  assert.equal(canAnswer({ phase: 'steal', blocked_players: ['p1'] }, 'p1'), false);
});

test('canAnswer no permite responder antes de pulsar BUZZ', () => {
  assert.equal(canAnswer({ phase: 'question', blocked_players: [] }, 'p1'), false);
});

test('timeoutDue pide avanzar cuando vence el reloj de cualquier fase jugable', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 60000).toISOString();
  const base = { status: 'playing', phase: 'question', round_deadline: past };

  assert.equal(timeoutDue(base, Date.now()), true);
  assert.equal(timeoutDue({ ...base, phase: 'answering' }, Date.now()), true);
  assert.equal(timeoutDue({ ...base, phase: 'steal' }, Date.now()), true);
  assert.equal(timeoutDue({ ...base, round_deadline: future }, Date.now()), false);
  assert.equal(timeoutDue({ ...base, status: 'finished' }, Date.now()), false);
  assert.equal(timeoutDue({ ...base, round_deadline: null }, Date.now()), false);
});

test('initials saca una o dos letras del nombre', () => {
  assert.equal(initials('Monkey D. Luffy'), 'MD');
  assert.equal(initials('Zoro'), 'Z');
  assert.equal(initials('   '), '?');
});

test('avatarHue es estable y cabe en la rueda de color', () => {
  const hue = avatarHue('Luffy');

  assert.equal(avatarHue('Luffy'), hue);
  assert.ok(hue >= 0 && hue < 360);
});

test('winnerOf corona al jugador con más puntos', () => {
  const players = [
    { id: 'a', name: 'Luffy', score: 5, team: null },
    { id: 'b', name: 'Ace', score: 1, team: null }
  ];

  const result = winnerOf(players, '1v1');

  assert.equal(result.kind, 'player');
  assert.equal(result.player.id, 'a');
  assert.equal(result.score, 5);
});

test('winnerOf corona al equipo con más puntos en 2v2', () => {
  const players = [
    { id: 'a1', name: 'Luffy', score: 3, team: 'A' },
    { id: 'a2', name: 'Zoro', score: 2, team: 'A' },
    { id: 'b1', name: 'Ace', score: 3, team: 'B' }
  ];

  const result = winnerOf(players, '2v2');

  assert.equal(result.kind, 'team');
  assert.equal(result.team, 'A');
  assert.equal(result.score, 5);
});

test('winnerOf declara empate cuando hay los mismos puntos', () => {
  const players = [
    { id: 'a', name: 'Luffy', score: 4, team: null },
    { id: 'b', name: 'Ace', score: 4, team: null }
  ];

  const result = winnerOf(players, '1v1');

  assert.equal(result.kind, 'tie');
  assert.equal(result.score, 4);
});

test('hostAway no marca nada si el capitán está fresco', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  const players = [
    { id: 'h', name: 'Luffy', is_host: true, last_seen: '2026-11-13T11:59:55Z' },
    { id: 'b', name: 'Ace', is_host: false, last_seen: '2026-11-13T11:59:59Z' }
  ];

  const result = hostAway(players, now);

  assert.equal(result.away, false);
  assert.equal(result.claimerId, null);
});

test('hostAway deja reclamar al más antiguo fresco', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  const players = [
    { id: 'h', name: 'Luffy', is_host: true, last_seen: '2026-11-13T11:59:20Z' },
    { id: 'b', name: 'Ace', is_host: false, last_seen: '2026-11-13T11:59:59Z' }
  ];

  const result = hostAway(players, now);

  assert.equal(result.away, true);
  assert.equal(result.claimerId, 'b');
});

test('hostAway no nombra reclamante si todos están mudos', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  const players = [
    { id: 'h', name: 'Luffy', is_host: true, last_seen: '2026-11-13T11:59:20Z' },
    { id: 'b', name: 'Ace', is_host: false, last_seen: '2026-11-13T11:59:00Z' }
  ];

  const result = hostAway(players, now);

  assert.equal(result.away, true);
  assert.equal(result.claimerId, null);
});

test('winnerOf declara empate en 4 jugadores', () => {
  const players = [
    { id: 'a', name: 'Luffy', score: 3, team: null },
    { id: 'b', name: 'Ace', score: 3, team: null },
    { id: 'c', name: 'Nami', score: 1, team: null }
  ];

  const result = winnerOf(players, 'ffa4');

  assert.equal(result.kind, 'tie');
  assert.equal(result.score, 3);
});

test('winnerOf declara empate de equipos en 2v2', () => {
  const players = [
    { id: 'a1', name: 'Luffy', score: 2, team: 'A' },
    { id: 'b1', name: 'Ace', score: 1, team: 'B' },
    { id: 'b2', name: 'Nami', score: 1, team: 'B' }
  ];

  const result = winnerOf(players, '2v2');

  assert.equal(result.kind, 'tie');
  assert.equal(result.score, 2);
});

test('feedbackForRound muestra el resultado de la ronda actual', () => {
  const feedback = { round: 3, correct: false };

  assert.equal(feedbackForRound(feedback, 3), feedback);
});

test('feedbackForRound esconde un fallo de la ronda anterior', () => {
  assert.equal(feedbackForRound({ round: 2, correct: false }, 3), null);
});

test('feedbackForRound deja pasar el acierto de la ronda anterior una vez', () => {
  const feedback = { round: 2, correct: true };

  assert.equal(feedbackForRound(feedback, 3), feedback);
});

test('feedbackForRound deja pasar el tiempo agotado de la ronda anterior', () => {
  const feedback = { round: 2, timeout: true };

  assert.equal(feedbackForRound(feedback, 3), feedback);
});

test('feedbackForRound deja pasar resultados sin ronda', () => {
  const feedback = { correct: true };

  assert.equal(feedbackForRound(feedback, 3), feedback);
});

test('feedbackForRound ignora la ausencia de resultado', () => {
  assert.equal(feedbackForRound(null, 3), null);
});

test('feedbackKey cambia cuando se revela la respuesta', () => {
  const before = feedbackKey({ at: 'a', correct_answer: null, round: 2 });
  const after = feedbackKey({ at: 'a', correct_answer: 'Zoro', round: 2 });

  assert.notEqual(before, after);
  assert.equal(after, feedbackKey({ at: 'a', correct_answer: 'Zoro', round: 2 }));
});

test('resultIdentity agrupa el mismo resultado aunque se revele', () => {
  const before = { at: 'a', round: 2, player_id: 'p1', correct_answer: null };
  const after = { at: 'a', round: 2, player_id: 'p1', correct_answer: 'Zoro' };

  assert.equal(resultIdentity(before), resultIdentity(after));
  assert.notEqual(resultIdentity(before), resultIdentity({ ...after, at: 'b' }));
});

test('entryClass reparte tres entradas', () => {
  assert.equal(entryClass(0), 'ask-enter--top');
  assert.equal(entryClass(1), 'ask-enter--left');
  assert.equal(entryClass(2), 'ask-enter--right');
  assert.equal(entryClass(3), 'ask-enter--top');
});

test('duelStatsFor acumula aciertos y fallos por jugador', () => {
  const { byPlayer, rounds } = duelStatsFor([
    { player_id: 'p1', correct: true, round: 1 },
    { player_id: 'p1', correct: false, round: 2 }
  ]);

  assert.equal(byPlayer.p1.correct, 1);
  assert.equal(byPlayer.p1.wrong, 1);
  assert.equal(byPlayer.p1.streak, 0);
  assert.equal(byPlayer.p1.best, 1);
  assert.equal(rounds, 2);
});

test('duelStatsFor recuerda la mejor racha', () => {
  const { byPlayer } = duelStatsFor([
    { player_id: 'p1', correct: true, round: 1 },
    { player_id: 'p1', correct: true, round: 2 },
    { player_id: 'p1', correct: false, round: 3 }
  ]);

  assert.equal(byPlayer.p1.best, 2);
  assert.equal(byPlayer.p1.streak, 0);
});

test('duelStatsFor cuenta el timeout con jugador como fallo', () => {
  const { byPlayer } = duelStatsFor([
    { player_id: 'p2', correct: null, timeout: true, round: 4 }
  ]);

  assert.equal(byPlayer.p2.wrong, 1);
  assert.equal(byPlayer.p2.correct, 0);
});

test('duelStatsFor ignora los timeouts sin jugador pero cuenta la ronda', () => {
  const { byPlayer, rounds } = duelStatsFor([
    { player_id: null, correct: null, timeout: true, round: 5 }
  ]);

  assert.deepEqual(byPlayer, {});
  assert.equal(rounds, 1);
});

test('duelStatsFor aguanta una lista vacía', () => {
  assert.deepEqual(duelStatsFor([]), { byPlayer: {}, rounds: 0 });
});

test('bestStreakOf mide la mejor racha de aciertos', () => {
  assert.equal(bestStreakOf([]), 0);
  assert.equal(bestStreakOf([
    { isCorrect: true },
    { isCorrect: true },
    { isCorrect: false },
    { isCorrect: true }
  ]), 2);
});

test('validUsername acepta solo letras, numeros y guion bajo de 3 a 16', () => {
  assert.equal(validUsername('Luffy_01'), true);
  assert.equal(validUsername('Namiña'), true);
  assert.equal(validUsername('José'), true);
  assert.equal(validUsername('ab'), false);
  assert.equal(validUsername('a b'), false);
  assert.equal(validUsername('nami!'), false);
  assert.equal(validUsername('x'.repeat(17)), false);
  assert.equal(validUsername(''), false);
});

test('formatBounty separa los miles con comas', () => {
  assert.equal(formatBounty(0), '0');
  assert.equal(formatBounty(22300000), '22,300,000');
  assert.equal(formatBounty(-5), '0');
});

test('ownedWildcards deja solo los que tienen cantidad', () => {
  assert.deepEqual(
    ownedWildcards({ filo: 2, ruta: 0, alma: 1, ancla: 0 }),
    ['filo', 'alma']
  );
  assert.deepEqual(ownedWildcards(null), []);
});
