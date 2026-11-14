import React from 'react';
import './RouteLoader.css';

const HINTS = {
  Inicio: 'Volviendo a la cubierta',
  Quiz: 'Abriendo el casillero',
  Partida: 'Repartiendo las cartas',
  Sala: 'Buscando tripulación'
};

const BUBBLES = Array.from({ length: 9 }, (_, index) => index);

const Compass = () => (
  <svg className="route-loader__compass" viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <circle cx="60" cy="60" r="53" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="1" strokeDasharray="2 7" opacity="0.7" />
    <path d="M60 9v102M9 60h102" stroke="currentColor" strokeWidth="1" strokeDasharray="1 9" opacity="0.45" />
    <path d="m60 24 8 28 28 8-28 8-8 28-8-28-28-8 28-8Z" stroke="currentColor" strokeWidth="1.4"           fill="rgba(95, 230, 210, 0.16)" />
    <circle cx="60" cy="60" r="4" fill="currentColor" />
  </svg>
);

const RouteLoader = ({ destination = 'inicio', leaving = false }) => (
  <div
    className={`route-loader${leaving ? ' is-leaving' : ''}`}
    role="status"
    aria-live="polite"
    aria-label={`Cargando ${destination}`}
  >
    <div className="route-loader__bubbles" aria-hidden="true">
      {BUBBLES.map((bubble) => (
        <span key={bubble} className="route-loader__bubble" style={{ '--i': bubble }}></span>
      ))}
    </div>

    <div className="route-loader__core">
      <Compass />
      <p className="route-loader__label">
        Cargando <span>{destination}</span>
      </p>
      <p className="route-loader__hint">{HINTS[destination] || 'Ajustando las velas'}</p>
      <span className="route-loader__track" aria-hidden="true"><span></span></span>
    </div>
  </div>
);

export default RouteLoader;
