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
    <li className={`board-row${mine ? ' is-me' : ''}${pinned ? ' is-pinned' : ''}`}>
      <span className="board-row__pos">{position}</span>
      <Avatar
        username={row.username}
        avatarKey={row.avatar_key}
        frameKey={row.frame_key}
        size="sm"
      />
      <span className="board-row__name">
        {row.username}
        {pinned && <span className="board-row__tag">Tu marca</span>}
      </span>
      <span className="board-row__score">
        {kind === 'duel' ? row.wins : formatBounty(row.score)}
      </span>
    </li>
  );
};

const BoardColumn = ({ label, rows, status, kind, me, mine }) => {
  const top = rows.slice(0, 3);
  const inTop = mine && top.some((row) => (
    row.id === mine.id || samePlayer(row, mine.username)
  ));

  let body;
  if (status === 'loading') {
    body = <p className="board-col__note">Buscando marcas...</p>;
  } else if (status === 'error') {
    body = <p className="board-col__note">No se pudo cargar.</p>;
  } else if (!top.length) {
    body = <p className="board-col__note">Sin marcas todavía.</p>;
  } else {
    body = (
      <ol className="board-list">
        {top.map((row, index) => (
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
    <div className="board-col">
      <h3 className="board-col__label">{label}</h3>
      {body}
    </div>
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

  const bothError = soloStatus === 'error' && duelStatus === 'error';
  const bothEmpty = soloStatus === 'ready'
    && duelStatus === 'ready'
    && !solo.length
    && !duels.length;

  return (
    <Shell current="home" navigate={navigate} className="shell--home">
      <div className="home">
        <section className="home__hero" aria-labelledby="home-title">
          <div className="home__copy">
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
          </div>

          <figure className="home__poster">
            <img
              src="/assets/referencias/referencia.webp"
              alt="Davy D. Jones sonríe con el pulgar arriba frente a su casillero abierto"
              width="1024"
              height="576"
              decoding="async"
            />
          </figure>
        </section>

        <GameSelector navigate={navigate} value={gameId} onChange={chooseGame} />

        <section className="home__board" aria-labelledby="board-title">
          <header className="home__board-head">
            <h2 id="board-title">El tablón</h2>
            <Link className="home__board-all" to={`/ranking?game=${gameId}`} navigate={navigate}>Ver completo</Link>
          </header>

          {bothError ? (
            <p className="home__board-empty">No se pudo cargar el tablón. Vuelve a intentarlo.</p>
          ) : bothEmpty ? (
            <p className="home__board-empty">
              Todavía no hay marcas en el casillero.{' '}
              <Link to={soloPath} navigate={navigate}>Sé el primero</Link>.
            </p>
          ) : (
            <div className="home__board-cols">
              <BoardColumn
                label="Solo"
                rows={solo}
                status={soloStatus}
                kind="solo"
                me={me}
                mine={stats?.soloRow}
              />
              <BoardColumn
                label="Duelos"
                rows={duels}
                status={duelStatus}
                kind="duel"
                me={me}
                mine={stats?.duelRow}
              />
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
};

export default GameMenu;
