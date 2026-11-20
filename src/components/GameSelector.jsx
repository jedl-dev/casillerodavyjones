import React, { useState } from 'react';
import Link from './Link';
import { GAMES } from '../lib/games';
import { useGameArt } from '../lib/gameArt';
import './GameSelector.css';

const GameSelector = ({ navigate, id = 'juegos', value, onChange }) => {
  const [internal, setInternal] = useState(GAMES[0]?.id);
  const selected = value ?? internal;
  const select = onChange || setInternal;
  const game = GAMES.find((item) => item.id === selected) || GAMES[0];
  const art = useGameArt(game?.modes.map((mode) => mode.art).filter(Boolean));

  if (!game) return null;

  return (
    <section className="games" id={id} aria-labelledby="games-title">
      <header className="games__head">
        <div className="games__intro">
          <h2 id="games-title">Juegos</h2>
          <p className="games__hint">
            {GAMES.length > 1 ? 'Elige juego y modo.' : `${game.name} · elige modo.`}
          </p>
        </div>

        {GAMES.length > 1 && (
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
        )}
      </header>

      <div
        className="games__modes"
        id="games-modes"
        role="tabpanel"
        aria-label={GAMES.length > 1 ? undefined : `Modos de ${game.name}`}
        aria-labelledby={GAMES.length > 1 ? `game-tab-${game.id}` : undefined}
      >
        {game.modes.map((mode) => (
          <Link key={mode.id} className="games__mode" to={mode.to} navigate={navigate}>
            <span className="games__mode-art">
              {art[mode.art] ? (
                <img src={art[mode.art]} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="games__mode-art-fallback" aria-hidden="true" />
              )}
              <span className="games__mode-shine" aria-hidden="true" />
              <span className="games__mode-go" aria-hidden="true">→</span>
            </span>

            <span className="games__mode-body">
              <span className="games__mode-meta">{mode.meta}</span>
              <span className="games__mode-name">{mode.name}</span>
              <span className="games__mode-detail">{mode.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default GameSelector;
