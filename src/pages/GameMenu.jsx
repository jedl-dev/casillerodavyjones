import React from 'react';
import Shell from '../components/Shell';
import Link from '../components/Link';
import './GameMenu.css';

const Arrow = () => (
  <svg viewBox="0 0 32 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M0 8h29" />
    <path d="M22 1.5 29.5 8 22 14.5" />
  </svg>
);

const GameMenu = ({ navigate }) => (
  <Shell current="home" navigate={navigate} className="shell--home">
    <div className="locker-home">
      <div className="locker-cave" aria-hidden="true">
        <span className="locker-cave__shaft"></span>
        <span className="locker-cave__haze"></span>
      </div>

      <header className="locker-hero">
        <div className="locker-object">
          <img
            className="locker-logo"
            src="/assets/logos/logobase.png"
            alt="El Casillero de Davy D. Jones"
          />
        </div>

        <div className="locker-copy">
          <h1 className="locker-title">
            Has caído en el casillero
            <span className="locker-title__name">de Davy D. Jones.</span>
          </h1>
          <p className="locker-lede">
            El casillero no devuelve a los que dudan. Baja solo y aguanta la marea,
            o siéntate frente a otro pirata con las mismas ganas de salir.
          </p>

          <div className="locker-doors" aria-label="Elige cómo entrar">
            <Link className="locker-door locker-door--solo" to="/quiz" navigate={navigate}>
              <span className="locker-door__beam" aria-hidden="true"></span>
              <span className="locker-door__tag">Quiz ? 1 jugador</span>
              <span className="locker-door__name">Descender solo</span>
              <span className="locker-door__meta">15 preguntas · 3 vidas</span>
              <span className="locker-door__arrow" aria-hidden="true"><Arrow /></span>
            </Link>

            <Link className="locker-door locker-door--duel" to="/sala" navigate={navigate}>
              <span className="locker-door__beam" aria-hidden="true"></span>
              <span className="locker-door__tag">Quiz ? Duelo 1 vs 1</span>
              <span className="locker-door__name">Retar a un rival</span>
              <span className="locker-door__meta">Mismas preguntas · turno heredado</span>
              <span className="locker-door__arrow" aria-hidden="true"><Arrow /></span>
            </Link>
          </div>
        </div>
      </header>

      <section className="locker-shelf" aria-labelledby="shelf-title">
        <div className="locker-shelf__head">
          <h2 id="shelf-title">Lo que guarda el casillero</h2>
          <span className="locker-shelf__count">1 abierto · 1 sellado</span>
        </div>

        <div className="locker-shelf__items">
          <article className="locker-plaque">
            <div className="locker-plaque__head">
              <h3>Quiz del casillero</h3>
              <span className="locker-plaque__state">Abierto</span>
            </div>
            <p>La marea sube con cada acierto. Un fallo te devuelve una casilla atrás y te cuesta una vida.</p>
          </article>

          <article className="locker-chest" aria-labelledby="chest-title">
            <span className="locker-chest__stamp" aria-hidden="true">Sellado</span>
            <h3 id="chest-title">Siguiente reto</h3>
            <p>Davy D. Jones todavía no ha abierto esta puerta. Cuando lo haga, se sabrá aquí abajo.</p>
          </article>
        </div>
      </section>
    </div>
  </Shell>
);

export default GameMenu;
