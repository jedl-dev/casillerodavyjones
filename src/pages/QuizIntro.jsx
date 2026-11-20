import React, { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import Link from '../components/Link';
import Avatar from '../components/Avatar';
import '../ui.css';
import { getArcadeIdentity } from '../lib/arcade';
import { getPlayerSession, rememberNext } from '../lib/playerAuth';
import './QuizIntro.css';

const QuizIntro = ({ navigate }) => {
  const [identity, setIdentity] = useState(getArcadeIdentity);

  useEffect(() => {
    const sync = () => setIdentity(getArcadeIdentity());
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('opq:identity', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('opq:identity', sync);
    };
  }, []);

  useEffect(() => {
    const toLogin = () => {
      rememberNext('/quiz');
      navigate('/login');
    };
    getPlayerSession().then(({ data }) => {
      if (!data.session || !getArcadeIdentity()?.token) toLogin();
    }).catch(toLogin);
  }, []);

  const start = (event) => {
    event.preventDefault();
    if (!identity?.token) {
      rememberNext('/quiz');
      navigate('/login');
      return;
    }
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
            El fondo no perdona a los que dudan. Tu nombre ya está en el tablón.
          </p>

          <p className="briefing-facts">
            <span>20 preguntas</span>
            <span className="briefing-facts__lives">
              3 vidas
              <span className="briefing-pips" aria-hidden="true"><i /><i /><i /></span>
            </span>
            <span>Dificultad creciente</span>
          </p>

          <p className="briefing-warning">Si fallas tres veces, te quedas abajo.</p>
        </div>

        <form className="briefing-panel" onSubmit={start}>
          <div className="briefing-player">
            {identity && (
              <Avatar
                username={identity.username}
                avatarKey={identity.avatar_key}
                frameKey={identity.frame_key}
                size="md"
              />
            )}
            <div className="briefing-player__copy">
              <span className="op-label">Jugando como</span>
              <strong className="briefing-player__name">{identity?.username || '...'}</strong>
              <span className="briefing-player__note">
                Tu cuenta guarda marcas y racha. El nombre se cambia desde tu perfil.
              </span>
            </div>
          </div>

          <button className="btn-foam briefing-submit" type="submit" disabled={!identity?.token}>
            Empezar el descenso
          </button>
          <Link className="briefing-switch" to="/sala" navigate={navigate}>
            Retar a un rival (1 vs 1)
          </Link>
        </form>
      </section>
    </Shell>
  );
};

export default QuizIntro;
