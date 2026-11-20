import React, { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import Link from '../components/Link';
import Avatar from '../components/Avatar';
import GameSelector from '../components/GameSelector';
import { fetchLeaderboard, fetchPlayerStats, getArcadeIdentity } from '../lib/arcade';
import { formatBounty } from '../lib/quizRoom';
import { GAMES } from '../lib/games';
import './GameMenu.css';

const samePlayer = (row, name) => (
  Boolean(row && name) && row.username?.toLowerCase() === name.toLowerCase()
);

const BoardRow = ({ row, position, kind, me, pinned = false }) => {
  const mine = samePlayer(row, me);

  return (
    <li className={`home-board__row${mine ? ' is-me' : ''}${pinned ? ' is-pinned' : ''}`}>
      <span className="home-board__pos">{position}</span>
      <Avatar
        username={row.username}
        avatarKey={row.avatar_key}
        frameKey={row.frame_key}
        size="sm"
      />
      <span className="home-board__name">
        {row.username}
        {pinned && <span className="home-board__tag">Tu marca</span>}
      </span>
      <span className="home-board__score">
        {kind === 'duel' ? row.wins : formatBounty(row.score)}
      </span>
    </li>
  );
};

const BoardPanel = ({ solo, duels, soloStatus, duelStatus, stats, me, gameId, soloPath, duelPath, navigate }) => {
  const [kind, setKind] = useState('solo');
  const rows = kind === 'solo' ? solo : duels;
  const status = kind === 'solo' ? soloStatus : duelStatus;
  const mine = kind === 'solo' ? stats?.soloRow : stats?.duelRow;
  const modePath = kind === 'duel' ? duelPath : soloPath;
  const inTop = Boolean(mine) && rows.some((row) => row.id === mine.id || samePlayer(row, mine.username));

  let body;
  if (status === 'loading') {
    body = (
      <ul className="home-board__list" aria-hidden="true">
        {[0, 1, 2].map((key) => <li key={key} className="home-board__row is-skeleton" />)}
      </ul>
    );
  } else if (status === 'error') {
    body = <p className="home-board__note">No se pudo cargar. Vuelve a intentarlo.</p>;
  } else if (!rows.length) {
    body = (
      <p className="home-board__note">
        Sin marcas todavía.{' '}
        <Link to={modePath} navigate={navigate}>Sé el primero</Link>.
      </p>
    );
  } else {
    body = (
      <ol className="home-board__list">
        {rows.map((row, index) => (
          <BoardRow
            key={`${row.id || row.username}-${index}`}
            row={row}
            position={index + 1}
            kind={kind}
            me={me}
          />
        ))}
        {!inTop && mine && (
          <BoardRow
            key="tu-marca"
            row={mine}
            position={mine.rank ?? '—'}
            kind={kind}
            me={me}
            pinned
          />
        )}
      </ol>
    );
  }

  return (
    <aside className="home-board" aria-labelledby="board-title">
      <header className="home-board__head">
        <h2 id="board-title">El tablón</h2>
        <Link className="home-board__all" to={`/ranking?game=${gameId}`} navigate={navigate}>
          Ver completo
        </Link>
      </header>

      <div className="home-board__switch" role="group" aria-label="Tabla del tablón">
        {[
          { key: 'solo', label: 'Solo' },
          { key: 'duel', label: 'Duelos' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`home-board__tab${kind === tab.key ? ' is-current' : ''}`}
            aria-pressed={kind === tab.key}
            onClick={() => setKind(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="home-board__body" aria-live="polite" aria-busy={status === 'loading'}>
        {body}
      </div>

      {status === 'ready' && rows.length > 0 && rows.length < 3 && (
        <p className="home-board__push">
          <Link to={modePath} navigate={navigate}>
            {inTop ? 'Defiende tu marca' : `Baja y ocupa el puesto ${rows.length + 1}`}
          </Link>
        </p>
      )}

      <p className="home-board__foot">
        {kind === 'duel'
          ? 'Duelos entre dos nombres.'
          : 'Cada nombre con su mejor marca.'}
      </p>
    </aside>
  );
};

const GameMenu = ({ navigate }) => {
  const [solo, setSolo] = useState([]);
  const [duels, setDuels] = useState([]);
  const [soloStatus, setSoloStatus] = useState('loading');
  const [duelStatus, setDuelStatus] = useState('loading');
  const [statsState, setStatsState] = useState({ name: null, game: null, status: 'idle', data: null });
  const [identity, setIdentity] = useState(getArcadeIdentity);
  const [gameId, setGameId] = useState(GAMES[0]?.id || 'quiz');

  const game = GAMES.find((item) => item.id === gameId) || GAMES[0];
  const displayName = identity?.username || null;
  const me = displayName?.toLowerCase() || null;
  const statsCurrent = statsState.name === displayName && statsState.game === gameId ? statsState : null;
  const stats = statsCurrent?.data || null;
  const statsStatus = !displayName ? 'idle' : (statsCurrent?.status || 'loading');
  const mySolo = stats?.soloRow || null;
  const soloPath = game?.modes.find((mode) => mode.id === 'solo')?.to || '/quiz';
  const duelPath = game?.modes.find((mode) => mode.id === 'duel')?.to || '/sala?game=quiz';

  const chooseGame = (id) => {
    if (id === gameId) return;
    setSolo([]);
    setDuels([]);
    setSoloStatus('loading');
    setDuelStatus('loading');
    setGameId(id);
  };

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
    let alive = true;

    fetchLeaderboard('solo', 'all', gameId, 3)
      .then((rows) => {
        if (!alive) return;
        setSolo(Array.isArray(rows) ? rows : []);
        setSoloStatus('ready');
      })
      .catch(() => {
        if (alive) setSoloStatus('error');
      });

    fetchLeaderboard('duel', 'all', gameId, 3)
      .then((rows) => {
        if (!alive) return;
        setDuels(Array.isArray(rows) ? rows : []);
        setDuelStatus('ready');
      })
      .catch(() => {
        if (alive) setDuelStatus('error');
      });

    return () => {
      alive = false;
    };
  }, [gameId]);

  useEffect(() => {
    if (!displayName) return undefined;

    let alive = true;

    fetchPlayerStats(displayName, gameId)
      .then((data) => {
        if (!alive) return;
        setStatsState({ name: displayName, game: gameId, status: 'ready', data });
      })
      .catch(() => {
        if (alive) setStatsState({ name: displayName, game: gameId, status: 'error', data: null });
      });

    return () => {
      alive = false;
    };
  }, [displayName, gameId]);

  return (
    <Shell current="home" navigate={navigate} className="shell--home">
      <div className="home">
        <section className="home__copy" aria-labelledby="home-title">
          <h1 className="home__title" id="home-title">
            Has caído en el casillero
            <span className="home__title-name">de Davy D. Jones.</span>
          </h1>

          <p className="home__lede">
            El casillero no devuelve a los que dudan. Baja solo y aguanta la marea,
            o siéntate frente a otro pirata con las mismas ganas de salir.
          </p>

          {!identity?.username && (
            <div className="home__actions">
              <Link className="home__cta" to="/login?mode=register" navigate={navigate}>
                Abrir mi casillero
              </Link>
              <Link className="home__link" to="/login" navigate={navigate}>Ya tengo cuenta</Link>
            </div>
          )}

          <p className="home__status">
            {statsStatus === 'loading'
              ? 'Cargando tu marca...'
              : statsStatus === 'error'
                ? 'No se pudo cargar tu marca.'
                : mySolo?.score
                  ? `Tu mejor marca en ${game?.short || 'el quiz'} en solitario · ${formatBounty(mySolo.score)}`
                  : identity?.username
                    ? 'Sin marca todavía.'
                    : 'Necesitas cuenta para bajar.'}
          </p>
        </section>

        <div className="home__stage">
          <GameSelector navigate={navigate} value={gameId} onChange={chooseGame} />

          <BoardPanel
            solo={solo}
            duels={duels}
            soloStatus={soloStatus}
            duelStatus={duelStatus}
            stats={stats}
            me={me}
            gameId={gameId}
            soloPath={soloPath}
            duelPath={duelPath}
            navigate={navigate}
          />
        </div>

        {identity?.username && (
          <p className="home__footline">
            {mySolo?.score
              ? <>Vuelve al abismo: <Link to={soloPath} navigate={navigate}>bajar solo</Link> o <Link to={duelPath} navigate={navigate}>retar a alguien</Link>.</>
              : <>Todavía no tienes marca. <Link to={soloPath} navigate={navigate}>Baja y deja una</Link>.</>}
          </p>
        )}
      </div>
    </Shell>
  );
};

export default GameMenu;
