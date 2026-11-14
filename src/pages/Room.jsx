import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import MareaGauge from '../components/MareaGauge';
import '../ui.css';
import './WantedQuiz.css';
import './Room.css';
import { supabase } from '../lib/supabase';
import {
  answer,
  buzz,
  claimHost,
  forceTimeout,
  getRoomState,
  leaveRoom,
  pingRoom,
  reportQuestion,
  startRoom
} from '../lib/quizApi';
import { avatarHue, canAnswer, duelStatsFor, entryClass, feedbackForRound, feedbackKey, hostAway, initials, modeLabel, rankPlayers, resultIdentity, shareText, sideLayout, timeoutDue, winnerOf } from '../lib/quizRoom';
import { getClientId, getPlayerName } from '../lib/user';

const HostIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="6.2" />
    <circle cx="12" cy="12" r="1.8" />
    <path d="M12 2.5v3.3M12 18.2v3.3M2.5 12h3.3M18.2 12h3.3M5.4 5.4l2.3 2.3M16.3 16.3l2.3 2.3M18.6 5.4l-2.3 2.3M7.7 16.3l-2.3 2.3" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="m3 3 10 10M13 3 3 13" />
  </svg>
);

const FlagIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 14.5V2" />
    <path d="M3.5 2.5h8.2l-1.6 3 1.6 3H3.5" />
  </svg>
);

const PlayerChip = ({ player, isMe, isBuzzed, isBlocked }) => (
  <span
    className={`duel-player${isMe ? ' is-me' : ''}${isBuzzed ? ' is-buzzed' : ''}${isBlocked ? ' is-blocked' : ''}`}
  >
    <span
      className="duel-player__avatar"
      style={{ '--avatar-hue': avatarHue(player.name) }}
      aria-hidden="true"
    >
      {initials(player.name)}
    </span>
    <span className="duel-player__name">{player.name}</span>
    <span className="duel-player__score">{player.score}</span>
  </span>
);

const SEA_WAVE =
  'M0 120 C 240 40 480 200 720 120 S 1200 40 1440 120 S 1920 200 2160 120 S 2640 40 2880 120 V320 H0 Z';

const DIFF_CLASS = {
  'Fácil': 'diff-easy',
  'Intermedia': 'diff-intermediate',
  'Difícil': 'diff-hard',
  'Muy Difícil': 'diff-very-hard',
  'Imposible': 'diff-impossible'
};

const DIFF_LEVEL = {
  'Fácil': 1,
  'Intermedia': 2,
  'Difícil': 3,
  'Muy Difícil': 4,
  'Imposible': 5
};

const DIFF_COLOR = {
  'Fácil': '#5fd6c9',
  'Intermedia': '#3fa9c4',
  'Difícil': '#2b7fa8',
  'Muy Difícil': '#3c5d95',
  'Imposible': '#a9c7e8'
};
const MODE_RULES = {
  '1v1': '12 rondas. El primero que toque la carta responde. Un acierto suma; un fallo hereda el turno al rival. Gana quien tenga los puntos.'
};
const QUICK_CHAT = ['¡Vamos!', 'Espera', 'GG', '👋', '🔥', '☠️'];


const Room = ({ session, onExit }) => {
  const { code, room_id: roomId, player_id: playerId, token } = session;

  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [feedback, setFeedback] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [readySelf, setReadySelf] = useState(false);
  const [presence, setPresence] = useState({});
  const [messages, setMessages] = useState([]);
  const [copied, setCopied] = useState('');
  const [entrySeed, setEntrySeed] = useState(0);
  const [observed, setObserved] = useState([]);
  const [pending, setPending] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [buzzMessage, setBuzzMessage] = useState('');
  const playerName = getPlayerName() || 'Jugador';

  const room = state?.room;
  const question = state?.question;

  useEffect(() => {
    setReportOpen(false);
    setReportSent(false);
    setReportNote('');
    setBuzzMessage('');
  }, [question?.id]);

  useEffect(() => {
    const heartbeat = setInterval(() => {
      pingRoom(code, token).catch(() => {
        // La sala pudo cerrarse; el siguiente refresco lo resolverá.
      });
    }, 10000);

    return () => clearInterval(heartbeat);
  }, [code, token]);

  useEffect(() => {
    if (!confirmExit) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') setConfirmExit(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmExit]);

  const resultRef = useRef(null);
  const lastResultKey = useRef(null);
  const forcedDeadline = useRef(null);
  const channelRef = useRef(null);
  const readyRef = useRef(false);
  const claimTimer = useRef(null);
  const buzzTimer = useRef(null);
  const feedbackTimer = useRef(null);
  const pendingTimer = useRef(null);

  useEffect(() => () => {
    clearTimeout(claimTimer.current);
    clearTimeout(buzzTimer.current);
    clearTimeout(feedbackTimer.current);
    clearTimeout(pendingTimer.current);
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const next = await getRoomState(code);
        if (alive) setState(next);
      } catch (err) {
        if (alive) setError(err.message);
      }
    };

    load();

    const channel = supabase
      .channel(`room:${code}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`
      }, load)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}`
      }, load)
      .on('presence', { event: 'sync' }, () => {
        const next = {};
        Object.values(channel.presenceState()).flat().forEach((entry) => {
          if (entry.player_id) next[entry.player_id] = entry;
        });
        setPresence(next);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (!payload || payload.player_id === playerId) return;
        setMessages((current) => [...current, payload].slice(-6));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          channel.track({
            player_id: playerId,
            name: playerName,
            ready: readyRef.current
          });
        }
      });

    const timer = setInterval(() => setNow(Date.now()), 500);

    return () => {
      alive = false;
      clearInterval(timer);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [code, roomId, playerId, playerName]);

  const latestResult = useRef(null);
  latestResult.current = state?.room?.last_result;
  const resultKey = feedbackKey(latestResult.current);

  useEffect(() => {
    if (!resultKey || resultKey === lastResultKey.current) return;
    lastResultKey.current = resultKey;
    setFeedback(latestResult.current);
    setObserved((current) => (
      current.some((entry) => resultIdentity(entry) === resultIdentity(latestResult.current))
        ? current
        : [...current, latestResult.current]
    ));
    setEntrySeed(Math.floor(Math.random() * 3));
    clearTimeout(feedbackTimer.current);
    clearTimeout(pendingTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1100);
    pendingTimer.current = setTimeout(() => setPending(null), 1300);
  }, [resultKey]);

  const players = state?.players || [];
  const me = players.find((player) => player.id === playerId);
  const isHost = Boolean(me?.is_host);
  const deadline = room?.round_deadline ? new Date(room.round_deadline).getTime() : null;
  const remaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  useEffect(() => {
    const ready = isHost || readySelf;
    readyRef.current = ready;
    if (channelRef.current) {
      channelRef.current.track({ player_id: playerId, name: playerName, ready });
    }
  }, [isHost, readySelf, playerId, playerName]);

  useEffect(() => {
    if (!room || forcedDeadline.current === room.round_deadline) return;
    if (!timeoutDue(room, now)) return;
    forcedDeadline.current = room.round_deadline;
    forceTimeout(code, token).catch(() => {
      forcedDeadline.current = null;
    });
  }, [now, room, code, token]);

  const handleStart = async () => {
    setError('');
    try {
      await startRoom(code, token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBuzz = async () => {
    setError('');
    try {
      const response = await buzz(code, token);
      if (!response?.won) {
        setBuzzMessage('Te adelantaron');
        if (buzzTimer.current) clearTimeout(buzzTimer.current);
        buzzTimer.current = setTimeout(() => setBuzzMessage(''), 1200);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAnswer = async (option) => {
    if (pending) return;
    setPending(option);
    setError('');
    try {
      await answer(code, token, option);
    } catch (err) {
      setError(err.message);
      setPending(null);
    }
  };

  const handleExit = async () => {
    try {
      await leaveRoom(code, token);
    } catch {
      // La sala puede haberse limpiado ya.
    }
    onExit();
  };

  const requestExit = () => {
    if (state?.room?.status === 'playing') {
      setConfirmExit(true);
      return;
    }
    handleExit();
  };

  const handleClaimHost = async () => {
    setClaimError('');
    try {
      const response = await claimHost(code, token);
      if (response?.ok) {
        setState(await getRoomState(code));
        return;
      }
      setClaimError('Otro jugador se ha adelantado');
      if (claimTimer.current) clearTimeout(claimTimer.current);
      claimTimer.current = setTimeout(() => setClaimError(''), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const sendReport = async (reason) => {
    if (!question?.id) return;
    setError('');
    try {
      await reportQuestion(question.id, reason, reportNote, getClientId());
      setReportOpen(false);
      setReportNote('');
      setReportSent(true);
      setTimeout(() => setReportSent(false), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyValue = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('No se pudo copiar. Copia el código manualmente.');
    }
  };

  const copyCode = () => copyValue(room?.code || code, 'code');
  const copyLink = () => copyValue(`${window.location.origin}/sala/${room?.code || code}`, 'link');

  const toggleReady = () => setReadySelf((current) => !current);

  const sendChat = (text) => {
    const message = { player_id: playerId, name: playerName, text, at: Date.now() };
    setMessages((current) => [...current, message].slice(-6));
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: message });
  };

  const handleShare = async () => {
    if (!resultRef.current || sharing) return;
    setSharing(true);

    const text = shareText(room, players);
    try {
      const canvas = await html2canvas(resultRef.current, {
        scale: 2,
        backgroundColor: '#021013',
        useCORS: true,
        logging: false
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      const file = new File([blob], 'one-piece-quiz.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'El Casillero de Davy D. Jones', text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: 'El Casillero de Davy D. Jones', text, url: window.location.origin });
      } else {
        const link = document.createElement('a');
        link.download = 'one-piece-quiz.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('No se pudo compartir la imagen:', err);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Sin portapapeles disponible.
      }
    } finally {
      setSharing(false);
    }
  };

  if (!state) {
    return (
      <div className="op-page">
        <div className="op-card">
          <h1 className="op-title-sm">Cargando sala {code}...</h1>
          {error && <p className="op-error">{error}</p>}
          <button className="op-btn" onClick={handleExit}>Salir</button>
        </div>
      </div>
    );
  }

  const ranking = rankPlayers(players);
  const buzzedPlayer = players.find((player) => player.id === room.buzzed_by);
  const requiredPlayers = 2;
  const missingPlayers = Math.max(0, requiredPlayers - players.length);
  const readyFor = (player) => player.is_host
    || (player.id === playerId ? readySelf : Boolean(presence[player.id]?.ready));
  const allReady = players.length > 0 && players.every(readyFor);
  const canStart = missingPlayers === 0 && allReady;
  const hostState = hostAway(players, now);
  const canClaimHost = hostState.away && hostState.claimerId === playerId && !isHost;

  if (room.status === 'playing' && question) {
    const { left, right } = sideLayout(players, room.mode);
    const blocked = room.blocked_players || [];
    const iAmBlocked = blocked.includes(playerId);
    const level = DIFF_LEVEL[question.difficulty] || 1;
    const visibleFeedback = feedbackForRound(feedback, room.current_round);
    const showAnswer = visibleFeedback?.round === room.current_round;

    const turnText = room.phase === 'question'
      ? buzzMessage || 'Toca la carta para pedir el turno.'
      : room.phase === 'steal'
        ? iAmBlocked
          ? 'Ya fallaste esta ronda. Espera el robo del rival.'
          : room.mode === 'ffa4'
            ? 'Robo abierto: responde cualquiera que no haya fallado.'
            : 'El rival tiene el robo.'
        : `${buzzedPlayer?.name || 'Otro jugador'} está respondiendo...`;

    const renderChip = (player) => (
      <PlayerChip
        key={player.id}
        player={player}
        isMe={player.id === playerId}
        isBuzzed={player.id === room.buzzed_by}
        isBlocked={blocked.includes(player.id)}
      />
    );

    return (
      <div
        className={`quiz-page-container duel-shell ${DIFF_CLASS[question.difficulty] || ''}`}
        style={{ '--deck': DIFF_COLOR[question.difficulty] || 'var(--lum)' }}
      >
        <div className="quiz-sea" aria-hidden="true">
          <div className="quiz-sea__light"></div>
          <div className="quiz-sea__rays"><span></span><span></span><span></span></div>
          <div className="quiz-sea__currents"></div>
          <div className="quiz-sea__swell">
            <svg viewBox="0 0 2880 320" preserveAspectRatio="none"><path d={SEA_WAVE} /></svg>
            <svg viewBox="0 0 2880 320" preserveAspectRatio="none"><path d={SEA_WAVE} /></svg>
            <svg viewBox="0 0 2880 320" preserveAspectRatio="none"><path d={SEA_WAVE} /></svg>
          </div>
        </div>

        <div className="haki-particles" aria-hidden="true">
          {[...Array(12)].map((_, index) => <div key={index} className="particle"></div>)}
        </div>

        <button className="btn-exit-top" onClick={requestExit}>
          <CloseIcon /> ABANDONAR
        </button>

        <header className="duel-scoreboard">
          <div className="duel-side">
            {left.map(renderChip)}
          </div>

          <div className="duel-vs">
            <span className="duel-mode">{modeLabel(room.mode)}</span>
            <span className="duel-round">
              Ronda {room.current_round}<span> / {room.total_rounds}</span>
            </span>
            {remaining !== null && <span className="duel-clock">{remaining}s</span>}
          </div>

          <div className="duel-side duel-side--right">
            {right.map(renderChip)}
          </div>
        </header>

        {hostState.away && (
          <div className="host-away" role="status">
            <span className="host-away__text">El capitán no responde</span>
          </div>
        )}

        <div className="quiz-main-content">
          <div className="question-area">
            <div className="difficulty-tag-container">
              <div className="marea-row">
                <div
                  className="marea-tag"
                  style={{ '--diff-color': 'var(--deck, var(--lum))' }}
                  aria-label={`Marea ${question.difficulty}, nivel ${level} de 5`}
                >
                  <span className="marea-tag__label">Marea</span>
                  <span className="marea-tag__name">{question.difficulty}</span>
                  <MareaGauge level={level} />
                </div>

                <button
                  type="button"
                  className="report-toggle"
                  aria-label="Reportar pregunta"
                  aria-expanded={reportOpen}
                  onClick={() => setReportOpen((open) => !open)}
                >
                  <FlagIcon />
                </button>

                {reportSent && <span className="report-sent" role="status">Reporte enviado</span>}

                {reportOpen && (
                  <div className="report-menu" role="dialog" aria-label="Reportar pregunta">
                    <span className="report-menu__title">¿Qué falla?</span>
                    <button type="button" onClick={() => sendReport('respuesta')}>
                      Respuesta incorrecta
                    </button>
                    <button type="button" onClick={() => sendReport('dificultad')}>
                      Dificultad mal puesta
                    </button>
                    <button type="button" onClick={() => sendReport('otro')}>Otro</button>
                    <input
                      className="op-input report-menu__note"
                      maxLength={280}
                      placeholder="Nota (opcional)"
                      aria-label="Nota del reporte"
                      value={reportNote}
                      onChange={(event) => setReportNote(event.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div
              key={room.current_round}
              className={`duel-ask is-revealed ${entryClass(entrySeed)}${room.phase === 'question' ? ' duel-ask--live' : ''}`}
              {...(room.phase === 'question'
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-labelledby': 'duel-question',
                    'aria-describedby': 'duel-ask-hint',
                    onClick: handleBuzz,
                    onKeyDown: (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleBuzz();
                      }
                    }
                  }
                : {})}
            >
              <div className="duel-boss-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="16" cy="16" r="12.5" />
                  <circle cx="16" cy="16" r="9" strokeDasharray="1 4" />
                  <path d="m16 6.5 2.6 7.4 7.4 2.1-7.4 2.1L16 25.5l-2.6-7.4L6 16l7.4-2.1Z" fill="currentColor" stroke="none" />
                </svg>
              </div>

              <h2 className="question-text" id="duel-question" key={room.current_round}>
                {question.question_text}
              </h2>

              {room.phase === 'question' && (
                <span className="duel-ask__hint" id="duel-ask-hint">
                  Toca la carta para pedir el turno
                </span>
              )}
            </div>

            <div className="options-grid visible">
              {question.options.map((option, index) => {
                const canRespond = canAnswer(room, playerId);
                const mine = visibleFeedback?.player_id === playerId && pending === option
                  ? visibleFeedback.correct ? ' correct' : ' wrong'
                  : '';
                return (
                  <button
                    key={option}
                    className={`option-btn${mine}`}
                    disabled={!canRespond || Boolean(pending)}
                    aria-busy={pending === option}
                    onClick={() => handleAnswer(option)}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="option-text">{option}</span>
                  </button>
                );
              })}
            </div>

            {room.phase === 'answering' ? (
              <div
                className={`duel-turn duel-turn--turn${room.buzzed_by === playerId ? ' is-mine' : ''}`}
                aria-live="polite"
              >
                <span
                  className="duel-turn__avatar"
                  style={{ '--avatar-hue': avatarHue(buzzedPlayer?.name || '?') }}
                  aria-hidden="true"
                >
                  {initials(buzzedPlayer?.name || '?')}
                </span>
                {room.buzzed_by === playerId
                  ? 'Es tu turno'
                  : `${buzzedPlayer?.name || 'Otro jugador'} tiene el turno`}
              </div>
            ) : (
              <div className={`duel-turn${room.phase === 'steal' ? ' duel-turn--steal' : ''}`} aria-live="polite">
                {turnText}
              </div>
            )}

            {error && <p className="op-error" role="alert">{error}</p>}
          </div>
        </div>

        {visibleFeedback && room.phase !== 'question' && !canAnswer(room, playerId) && (room.phase !== 'steal' || visibleFeedback.player_id === playerId) && (
          <div className={`feedback-fullscreen-overlay ${visibleFeedback.correct ? 'success' : 'error'}`}>
            <div className="feedback-impact-content">
              {visibleFeedback.correct ? (
                <div className="success-mark">+1</div>
              ) : (
                <div className="error-mark">{visibleFeedback.timeout ? '⏱' : '−1'}</div>
              )}
              <h2 className="feedback-impact-text">
                {visibleFeedback.timeout
                  ? `Tiempo agotado${showAnswer && visibleFeedback.correct_answer ? `. Era: ${visibleFeedback.correct_answer}` : ''}`
                  : visibleFeedback.correct
                    ? `${visibleFeedback.player_name} acierta`
                    : `${visibleFeedback.player_name} falla${showAnswer && visibleFeedback.correct_answer ? `. Era: ${visibleFeedback.correct_answer}` : ''}`}
              </h2>
            </div>
          </div>
        )}

        {confirmExit && (
          <div className="exit-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-title">
            <div className="exit-dialog__panel">
              <h2 id="exit-title" className="exit-dialog__title">Abandonar la partida</h2>
              <p className="exit-dialog__text">
                La sala sigue sin ti; tu puesto queda libre. No podrás volver a esta ronda.
              </p>
              <div className="exit-dialog__actions">
                <button
                  type="button"
                  className="btn-pirate btn-outline"
                  autoFocus
                  onClick={() => setConfirmExit(false)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn-pirate" onClick={handleExit}>
                  Abandonar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (room.status === 'finished') {
    const winner = winnerOf(players, room.mode);
    const stats = duelStatsFor(observed);
    const statsComplete = stats.rounds >= room.total_rounds;
    const forfeit = room.last_result?.forfeit ? room.last_result : null;
    const statFor = (id) => stats.byPlayer[id] || { correct: 0, wrong: 0, best: 0 };
    const accuracy = (entry) => {
      const total = entry.correct + entry.wrong;
      return total ? Math.round((entry.correct / total) * 100) : 0;
    };

    return (
      <div className="quiz-page-container duel-shell">
        <div className="quiz-sea" aria-hidden="true">
          <div className="quiz-sea__light"></div>
          <div className="quiz-sea__rays"><span></span><span></span><span></span></div>
          <div className="quiz-sea__currents"></div>
          <div className="quiz-sea__swell">
            <svg viewBox="0 0 2880 320" preserveAspectRatio="none"><path d={SEA_WAVE} /></svg>
            <svg viewBox="0 0 2880 320" preserveAspectRatio="none"><path d={SEA_WAVE} /></svg>
            <svg viewBox="0 0 2880 320" preserveAspectRatio="none"><path d={SEA_WAVE} /></svg>
          </div>
        </div>

        <button className="btn-exit-top" onClick={requestExit}>
          <CloseIcon /> SALIR
        </button>

        <div className="quiz-main-content">
          <section className="duel-result bounce-in" ref={resultRef}>
            <div className="duel-winner">
              {winner.kind === 'player' && (
                <>
                  <span
                    className="duel-winner__avatar"
                    style={{ '--avatar-hue': avatarHue(winner.player.name) }}
                    aria-hidden="true"
                  >
                    {initials(winner.player.name)}
                  </span>
                  <h1 className="duel-winner__title">{winner.player.name}</h1>
                </>
              )}
              {winner.kind === 'tie' && (
                <h1 className="duel-winner__title">Empate en el casillero</h1>
              )}
              <p className="duel-winner__score">{winner.score} puntos</p>
              {forfeit && (
                <p className="duel-forfeit">
                  {forfeit.player_name} abandonó el casillero. Victoria por abandono.
                </p>
              )}
            </div>

            {statsComplete && (
              <div className="duel-stats">
                {ranking.map((player) => {
                  const entry = statFor(player.id);
                  return (
                    <div key={player.id} className="duel-stats__row">
                      <span className="duel-stats__name">{player.name}</span>
                      <span>{entry.correct} aciertos</span>
                      <span>{entry.wrong} fallos</span>
                      <span>{accuracy(entry)}% precisión</span>
                      <span>racha {entry.best}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <ol className="duel-podium">
              {ranking.map((player, index) => (
                <li
                  key={player.id}
                  className={`duel-podium__row${player.id === playerId ? ' is-me' : ''}`}
                >
                  <span className="duel-podium__rank">#{index + 1}</span>
                  <span
                    className="duel-player__avatar"
                    style={{ '--avatar-hue': avatarHue(player.name) }}
                    aria-hidden="true"
                  >
                    {initials(player.name)}
                  </span>
                  <span className="duel-podium__name">
                    {player.name}
                  </span>
                  <span className="duel-podium__score">{player.score}</span>
                </li>
              ))}
            </ol>

            <p className="duel-result__line">
              {forfeit
                ? 'El mar se queda con uno. El otro aún respira.'
                : winner.kind === 'tie'
                  ? 'El casillero no corona a nadie esta vez.'
                  : `El casillero se queda con ${winner.kind === 'player' ? winner.player.name : 'el equipo'} y ${winner.score} marea${winner.score === 1 ? '' : 's'}.`}
            </p>

            <div className="duel-result__actions">
              <button className="btn-pirate" onClick={handleShare} disabled={sharing}>
                {sharing ? 'Generando...' : 'Compartir resultado'}
              </button>
              <button className="btn-pirate btn-outline" onClick={requestExit}>
                Volver al inicio
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="op-page">
      <button className="op-back" onClick={requestExit}>← Salir</button>

      <div className={`op-room${room.status === 'waiting' ? ' op-room--waiting' : ''}`}>
        <header className="op-room-head">
          <div>
            <h1 className="op-code">{room.code}</h1>
          </div>
          <div className="op-room-meta">
            <span className="op-room-mode">{modeLabel(room.mode)}</span>
            {room.status !== 'waiting' && <span>Ronda {room.current_round} / {room.total_rounds}</span>}
            {remaining !== null && room.status === 'playing' && (
              <span className="op-countdown">{remaining}s</span>
            )}
          </div>
        </header>

        {error && <p className="op-error">{error}</p>}

        {room.status === 'waiting' && (
          <div className="room-waiting">
            <section className="op-card room-waiting__main">
              <div className="room-waiting__head">
                <div>
                  <p className="op-label">Código de sala</p>
                  <p className="room-waiting__code">{room.code}</p>
                </div>
                <div className="room-waiting__copy">
                  <button type="button" className="op-btn" onClick={copyCode}>
                    {copied === 'code' ? 'Código copiado' : 'Copiar código'}
                  </button>
                  <button type="button" className="op-btn op-btn--ghost" onClick={copyLink}>
                    {copied === 'link' ? 'Enlace copiado' : 'Copiar enlace'}
                  </button>
                </div>
              </div>

              <div className="room-waiting__players-head">
                <h2 className="op-title-sm">Tripulación</h2>
                <span className="room-count">{players.length} / {room.max_players}</span>
              </div>

              <ul className="op-player-list room-players">
                {players.map((player) => {
                  const ready = readyFor(player);
                  return (
                    <li key={player.id} className={player.id === playerId ? 'me' : ''}>
                      <span className="op-avatar" style={{ '--avatar-hue': avatarHue(player.name) }} aria-hidden="true">
                        {initials(player.name)}
                      </span>
                      <span className="op-player-name">
                        {player.name}
                        {player.is_host && (
                          <span className="op-host" aria-label="Anfitrión" title="Anfitrión">
                            <HostIcon />
                          </span>
                        )}
                      </span>
                      <span className="op-player-state">
                                                <span className={`op-ready${ready ? ' is-ready' : ''}`}>
                          {ready ? 'Listo' : 'Esperando'}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {hostState.away && (
                <div className="host-away" role="status">
                  <span className="host-away__text">El capitán no responde</span>
                  {canClaimHost && (
                    <button type="button" className="host-away__claim" onClick={handleClaimHost}>
                      Reclamar mando
                    </button>
                  )}
                  {claimError && <span className="host-away__note">{claimError}</span>}
                </div>
              )}

              {isHost ? (
                <button
                  type="button"
                  className="op-btn op-btn--primary"
                  disabled={!canStart}
                  onClick={handleStart}
                >
                  {missingPlayers > 0
                    ? `Faltan ${missingPlayers} jugador${missingPlayers === 1 ? '' : 'es'}`
                    : !allReady
                      ? 'Esperando a que todos estén listos'
                      : 'Iniciar partida'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`op-btn${readySelf ? ' op-btn--primary' : ''}`}
                  aria-pressed={readySelf}
                  onClick={toggleReady}
                >
                  {readySelf ? 'Estoy listo ✓' : 'Marcarme como listo'}
                </button>
              )}

              <p className="op-note">
                Comparte el código <strong>{room.code}</strong>. La partida empieza cuando todos estén listos.
              </p>
            </section>

            <aside className="room-waiting__side">
              <section className="op-card room-panel">
                <h3 className="op-title-sm">Cómo se juega</h3>
                <p className="room-panel__text">{MODE_RULES[room.mode]}</p>
                <p className="op-note">20 s para pulsar BUZZ · 15 s para responder.</p>
              </section>

              <section className="op-card room-panel">
                <h3 className="op-title-sm">Invita a tu tripulación</h3>
                <ol className="room-invite-steps">
                  <li>Comparte el código <strong>{room.code}</strong>.</li>
                  <li>Espera a que entren y marquen “Listo”.</li>
                  <li>Cuando estén todos, pulsa “Iniciar partida”.</li>
                </ol>
                <div className="op-actions">
                  <button type="button" className="op-btn" onClick={copyCode}>
                    {copied === 'code' ? 'Código copiado' : 'Copiar código'}
                  </button>
                  <button type="button" className="op-btn op-btn--ghost" onClick={copyLink}>
                    {copied === 'link' ? 'Enlace copiado' : 'Copiar enlace'}
                  </button>
                </div>
              </section>

              <section className="op-card room-panel room-chat">
                <h3 className="op-title-sm">Mensajes rápidos</h3>
                <div className="room-chat__log" aria-live="polite">
                  {messages.length ? messages.map((message, index) => (
                    <p key={`${message.at}-${index}`}>
                      <strong>{message.name}</strong> {message.text}
                    </p>
                  )) : (
                    <p className="op-note">Aún no hay mensajes.</p>
                  )}
                </div>
                <div className="room-chat__bar">
                  {QUICK_CHAT.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="op-btn op-btn--ghost"
                      onClick={() => sendChat(text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
