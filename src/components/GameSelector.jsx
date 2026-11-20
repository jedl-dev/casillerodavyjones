import React, { useState } from 'react';
import Link from './Link';
import { GAMES } from '../lib/games';
import './GameSelector.css';

const GameSelector = ({ navigate, id = 'juegos', value, onChange }) => {
  const [internal, setInternal] = useState(GAMES[0]?.id);
  const selected = value ?? internal;
  const select = onChange || setInternal;
  const game = GAMES.find((item) => item.id === selected) || GAMES[0];

  if (!game) return null;

  return (
    <section className="games" id={id} aria-labelledby="games-title">
      <header className="games__head">
        <h2 id="games-title">Juegos</h2>
        <p className="games__hint">Elige juego y modo.</p>
      </header>

      <div className="games__body">
        <div className="games__list" role="tablist" aria-label="Juegos disponibles">
          {GAMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`game-tab-${item.id}`}
              aria-controls="games-modes"
              aria-selected={item.id === game.id}
              className={`games__game${item.id === game.id ? ' is-selected' : ''}`}
              onClick={() => select(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div
          className="games__modes"
          id="games-modes"
          role="tabpanel"
          aria-labelledby={`game-tab-${game.id}`}
        >
          {game.modes.map((mode) => (
            <Link key={mode.id} className="games__mode" to={mode.to} navigate={navigate}>
              <span>
                <span className="games__mode-name">{mode.name}</span>
                <span className="games__mode-detail">{mode.detail}</span>
              </span>
              <span className="games__mode-go" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GameSelector;
