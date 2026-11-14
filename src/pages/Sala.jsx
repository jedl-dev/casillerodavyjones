import React, { useState } from 'react';
import Shell from '../components/Shell';
import '../ui.css';
import './Sala.css';
import { createRoom, joinRoom, leaveRoom, quickMatch } from '../lib/quizApi';
import { getClientId, getPlayerName, setPlayerName, validName } from '../lib/user';

const MODE = {
  short: 'Duelo 1 vs 1',
  players: '2 jugadores',
  description: 'Mismas preguntas para los dos. El primero que toca la carta responde; si falla, la hereda el rival.'
};
const Sala = ({ navigate, onEnterRoom, activeRoom, onLeaveRoom }) => {
  const [name, setName] = useState(getPlayerName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ensureName = () => {
    if (!validName(name)) {
      setError('Escribe un nombre de 1 a 16 caracteres.');
      return false;
    }
    setPlayerName(name);
    setError('');
    return true;
  };

  const run = async (action) => {
    if (!ensureName()) return;
    setBusy(true);
    setError('');
    try {
      if (activeRoom) {
        try {
          await leaveRoom(activeRoom.code, activeRoom.token);
        } catch {
          // La sala anterior pudo caducar; no bloquea la nueva.
        }
        onLeaveRoom();
      }
      onEnterRoom(await action());
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
          <label className="op-label" htmlFor="player-name">
            Tu nombre
            <span className="op-label-note">
              (para tu high score y para compartir el resultado; es temporal)
            </span>
          </label>
          <input
            id="player-name"
            className="op-input"
            value={name}
            maxLength={16}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Mugiwara"
            autoComplete="nickname"
          />

          <span className="op-label">Modo</span>
          <div className="sala-mode-fixed">
            <span className="sala-mode__players">{MODE.players}</span>
            <span className="sala-mode__title">{MODE.short}</span>
            <span className="sala-mode__desc">{MODE.description}</span>
          </div>

          {error && <p className="op-error" role="alert">{error}</p>}

          <button
            className="op-btn op-btn--primary sala-create"
            disabled={busy}
            onClick={() => run(() => createRoom(name, '1v1', getClientId()))}
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
              onClick={() => run(() => quickMatch(name, getClientId(), '1v1'))}
            >
              Buscar partida
            </button>
          </div>

          <div className="op-divider"><span>o entra con un código</span></div>

          <div className="op-inline">
            <input
              className="op-input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              aria-label="Código de sala"
              maxLength={5}
              disabled={busy}
            />
            <button
              className="op-btn"
              disabled={busy || code.trim().length < 4}
              onClick={() => run(() => joinRoom(code.trim(), name, getClientId()))}
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
