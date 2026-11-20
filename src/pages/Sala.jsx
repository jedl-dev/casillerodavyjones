import React, { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import '../ui.css';
import './Sala.css';
import { createRoom, joinRoom, quickMatch } from '../lib/quizApi';
import { getClientId } from '../lib/user';
import { getArcadeIdentity, getArcadePlayer, setArcadeIdentity, toIdentity } from '../lib/arcade';
import { getPlayerSession, rememberNext } from '../lib/playerAuth';
import { GAMES } from '../lib/games';

const MODE = {
  short: 'Duelo 1 vs 1',
  players: '2 jugadores',
  description: 'Mismas preguntas para los dos. El primero que toca la carta responde; si falla, la hereda el rival.'
};
const Sala = ({ navigate, onEnterRoom, activeRoom, onLeaveRoom, initialCode = '' }) => {
  const [code, setCode] = useState(() => initialCode.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState(getArcadeIdentity);

  const requestedGame = new URLSearchParams(window.location.search).get('game');
  const game = GAMES.find((item) => item.id === requestedGame) || GAMES[0];
  const gameKey = game?.id || 'quiz';
  const nextPath = initialCode
    ? `/sala/${initialCode.toUpperCase()}`
    : (requestedGame ? `/sala?game=${gameKey}` : '/sala');

  useEffect(() => {
    if (initialCode) setCode(initialCode.toUpperCase());
  }, [initialCode]);

  useEffect(() => {
    let alive = true;
    const sync = () => setIdentity(getArcadeIdentity());
    window.addEventListener('opq:identity', sync);
    window.addEventListener('storage', sync);

    getPlayerSession().then(async ({ data }) => {
      if (!alive) return;
      if (!data.session) {
        rememberNext(nextPath);
        navigate('/login');
        return;
      }
      if (getArcadeIdentity()?.token) return;

      try {
        const player = await getArcadePlayer();
        if (!alive) return;
        if (player?.exists) {
          setArcadeIdentity(toIdentity(player, getArcadeIdentity()));
        } else {
          rememberNext(nextPath);
          navigate('/login');
        }
      } catch {
        rememberNext(nextPath);
        navigate('/login');
      }
    }).catch(() => {
      if (!alive) return;
      rememberNext('/sala');
      navigate('/login');
    });

    return () => {
      alive = false;
      window.removeEventListener('opq:identity', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const run = async (action) => {
    if (!identity?.token) {
      rememberNext('/sala');
      navigate('/login');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (activeRoom) {
        // onLeaveRoom ya llama a leave_room y limpia la sesión; no duplicar la RPC.
        await onLeaveRoom();
      }
      onEnterRoom(await action(identity.token));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell current="sala" navigate={navigate} className="shell--center">
      <div className="sala">
        <div className="sala-head">
          <h1 className="sala-title">Sala</h1>
          <p className="sala-lede">
            Abre una sala y comparte el código. También puedes entrar con un código o
            buscar partida rápida.
          </p>

          {activeRoom && (
            <section className="sala-resume">
              <p className="op-label">Sala abierta</p>
              <h2 className="sala-resume__code">{activeRoom.code}</h2>
              <p className="sala-resume__text">
                Ya estás en una sala. Vuelve a ella o sal para empezar otra.
              </p>
              <div className="op-actions">
                <button
                  type="button"
                  className="op-btn op-btn--primary"
                  onClick={() => onEnterRoom(activeRoom)}
                >
                  Volver a la sala
                </button>
                <button type="button" className="op-btn op-btn--ghost" onClick={onLeaveRoom}>
                  Salir de la sala
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="sala-panel">
          <span className="op-label">Jugando como</span>
          <div className="sala-player">
            <strong>{identity?.username || 'Sin sesión'}</strong>
            <span className="sala-player__note">El nombre se cambia desde tu perfil.</span>
          </div>

          <span className="op-label">Juego y modo</span>
          <div className="sala-mode-fixed">
            <span className="sala-mode__players">{game?.name} · {MODE.players}</span>
            <span className="sala-mode__title">{MODE.short}</span>
            <span className="sala-mode__desc">{MODE.description}</span>
          </div>

          {error && <p className="op-error" role="alert">{error}</p>}

          <button
            className="op-btn op-btn--primary sala-create"
            disabled={busy}
            onClick={() => run((token) => createRoom(identity.username, '1v1', getClientId(), token, gameKey))}
          >
            {busy ? 'Preparando...' : 'Crear sala'}
          </button>

          <div className="sala-quick">
            <div className="sala-quick__copy">
              <span className="sala-quick__title">Partida rápida</span>
              <span className="sala-quick__desc">
                Te empareja con otro jugador en un duelo 1 vs 1. Si no hay nadie, abre sala.
              </span>
            </div>
            <button
              className="op-btn"
              disabled={busy}
              onClick={() => run((token) => quickMatch(identity.username, getClientId(), '1v1', token, gameKey))}
            >
              Buscar partida
            </button>
          </div>

          <div className="op-divider"><span>o entra con un código</span></div>

          <div className="op-inline">
            <input
              className="op-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
              placeholder="CÓDIGO"
              aria-label="Código de sala"
              maxLength={5}
              disabled={busy}
            />
            <button
              className="op-btn"
              disabled={busy || code.length < 5}
              onClick={() => run((token) => joinRoom(code.trim(), identity.username, getClientId(), token))}
            >
              Unirse
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default Sala;
