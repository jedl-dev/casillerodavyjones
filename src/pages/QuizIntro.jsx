import React, { useState } from 'react';
import Shell from '../components/Shell';
import Link from '../components/Link';
import '../ui.css';
import { getPlayerName, setPlayerName, validName } from '../lib/user';
import './QuizIntro.css';

const QuizIntro = ({ navigate }) => {
  const [name, setName] = useState(getPlayerName());
  const [error, setError] = useState('');

  const start = (event) => {
    event.preventDefault();
    if (!validName(name)) {
      setError('Escribe un nombre de 1 a 16 caracteres.');
      return;
    }
    setPlayerName(name);
    navigate('/quiz/jugar');
  };

  return (
    <Shell current="quiz" navigate={navigate} className="shell--center">
      <section className="briefing" aria-labelledby="briefing-title">
        <div className="briefing-copy">
          <h1 className="briefing-title" id="briefing-title">
            Quiz del <span>casillero.</span>
          </h1>

          <p className="briefing-lede">
            El fondo no perdona a los que dudan. Escribe tu nombre y empieza el descenso.
          </p>

          <p className="briefing-facts">
            <span>15 preguntas</span>
            <span className="briefing-facts__lives">
              3 vidas
              <span className="briefing-pips" aria-hidden="true"><i /><i /><i /></span>
            </span>
            <span>Dificultad creciente</span>
          </p>

          <p className="briefing-warning">Si fallas tres veces, te quedas abajo.</p>
        </div>

        <form className="briefing-panel" onSubmit={start}>
          <label className="op-label" htmlFor="solo-name">
            Tu nombre
            <span className="op-label-note">(solo para tu resultado; no hay cuenta)</span>
          </label>
          <input
            id="solo-name"
            className="op-input"
            value={name}
            maxLength={16}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Mugiwara"
            autoComplete="nickname"
          />
          {error && <p className="op-error" role="alert">{error}</p>}
          <button className="btn-foam briefing-submit" type="submit">
            Empezar el descenso
          </button>
          <Link className="briefing-switch" to="/sala" navigate={navigate}>
            Jugar con tripulación
          </Link>
        </form>
      </section>
    </Shell>
  );
};

export default QuizIntro;
