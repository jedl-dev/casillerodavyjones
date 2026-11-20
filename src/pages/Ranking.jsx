import React, { useEffect, useState } from 'react';
import Shell from '../components/Shell';
import Link from '../components/Link';
import '../ui.css';
import { fetchLeaderboard, fetchPlayerStats, getArcadeIdentity } from '../lib/arcade';
import { GAMES } from '../lib/games';
import Avatar from '../components/Avatar';
import { formatBounty } from '../lib/quizRoom';
import './Ranking.css';

const KIND_LABELS = { solo: 'Solo', duel: 'Duelos' };
const PERIOD_LABELS = { all: 'Histórico', week: 'Semana' };

const samePlayer = (row, name) => (
  Boolean(row && name) && row.username?.toLowerCase() === name.toLowerCase()
);

const Ranking = ({ navigate }) => {
  const [game, setGame] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('game');
    return GAMES.some((item) => item.id === requested) ? requested : (GAMES[0]?.id || 'quiz');
  });
  const [kind, setKind] = useState('solo');
  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState([]);
  const [identityName, setIdentityName] = useState(() => getArcadeIdentity()?.username || null);
  const [statsState, setStatsState] = useState({ name: null, game: null, data: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const me = identityName?.toLowerCase() || null;

  useEffect(() => {
    const sync = () => setIdentityName(getArcadeIdentity()?.username || null);
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('opq:identity', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('opq:identity', sync);
    };
  }, []);

  const chooseKind = (value) => {
    if (value === kind) return;
    setLoading(true);
    setError('');
    setRows([]);
    setKind(value);
  };

  const choosePeriod = (value) => {
    if (value === period) return;
    setLoading(true);
    setError('');
    setRows([]);
    setPeriod(value);
  };

  const chooseGame = (value) => {
    if (value === game) return;
    setLoading(true);
    setError('');
    setRows([]);
    setGame(value);
  };

  useEffect(() => {
    let alive = true;

    fetchLeaderboard(kind, period, game)
      .then((data) => {
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => {
        if (!alive) return;
        setRows([]);
        setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [kind, period, game]);

  useEffect(() => {
    if (!identityName) return undefined;

    let alive = true;
    fetchPlayerStats(identityName, game)
      .then((data) => {
        if (alive) setStatsState({ name: identityName, game, data });
      })
      .catch(() => {
        if (alive) setStatsState({ name: identityName, game, data: null });
      });

    return () => {
      alive = false;
    };
  }, [identityName, game]);

  const stats = statsState.name === identityName && statsState.game === game ? statsState.data : null;
  const mine = kind === 'duel' ? stats?.duelRow : stats?.soloRow;

  const scoreLabel = kind === 'duel' ? 'Victorias' : 'Puntos';
  const mineInList = mine && rows.some((row) => row.id === mine.id || samePlayer(row, mine.username));
  const soloPath = GAMES.find((item) => item.id === game)?.modes.find((mode) => mode.id === 'solo')?.to || '/quiz';

  const rowBody = (row, position, pinned = false) => (
    <li
      key={pinned ? 'tu-marca' : `${row.id}-${position}`}
      className={`ranking-row${me && samePlayer(row, me) ? ' is-me' : ''}${pinned ? ' is-pinned' : ''}`}
    >
      <span className="ranking-row__pos">{position}</span>
      <Avatar
        username={row.username}
        avatarKey={row.avatar_key}
        frameKey={row.frame_key}
        size="sm"
      />
      <span className="ranking-row__name">
        {row.username}
        {pinned && <span className="ranking-row__tag">Tu marca</span>}
      </span>
      <span className="ranking-row__score">
        {kind === 'duel' ? row.wins : formatBounty(row.score)}
        <small>{scoreLabel}</small>
      </span>
    </li>
  );

  return (
    <Shell current="ranking" navigate={navigate} className="shell--center">
      <section className="ranking">
        <header className="ranking-head">
          <h1 className="ranking-title">El tablón del casillero</h1>
          <p className="ranking-lede">
            Las marcas que el fondo del mar no se ha llevado.
          </p>
        </header>

        <div className="ranking-controls" role="group" aria-label="Tipo de ranking">
          {GAMES.length > 1 && GAMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ranking-tab${game === item.id ? ' is-current' : ''}`}
              aria-pressed={game === item.id}
              onClick={() => chooseGame(item.id)}
            >
              {item.name}
            </button>
          ))}

          {GAMES.length > 1 && <span className="ranking-sep" aria-hidden="true"></span>}

          {Object.keys(KIND_LABELS).map((key) => (
            <button
              key={key}
              type="button"
              className={`ranking-tab${kind === key ? ' is-current' : ''}`}
              aria-pressed={kind === key}
              onClick={() => chooseKind(key)}
            >
              {KIND_LABELS[key]}
            </button>
          ))}

          <span className="ranking-sep" aria-hidden="true"></span>

          {Object.keys(PERIOD_LABELS).map((key) => (
            <button
              key={key}
              type="button"
              className={`ranking-tab${period === key ? ' is-current' : ''}`}
              aria-pressed={period === key}
              onClick={() => choosePeriod(key)}
            >
              {PERIOD_LABELS[key]}
            </button>
          ))}
        </div>

        {error && <p className="op-error" role="alert">{error}</p>}

        {loading ? (
          <p className="ranking-empty">Buceando en el tablón...</p>
        ) : error ? null : rows.length === 0 ? (
          <div className="ranking-empty">
            <p>Todavía no hay marcas en esta tabla.</p>
            <Link className="btn-pirate btn-outline" to={soloPath} navigate={navigate}>
              Ser el primero
            </Link>
          </div>
        ) : (
          <ol className="ranking-list">
            {rows.map((row, index) => rowBody(row, index + 1))}
            {mine && !mineInList && rowBody(mine, mine.rank ?? '—', true)}
          </ol>
        )}

        <p className="ranking-note">
          {kind === 'duel'
            ? 'Solo cuentan los duelos entre dos nombres.'
            : 'Cada nombre aparece con su mejor marca. La semana empieza el lunes.'}
        </p>
      </section>
    </Shell>
  );
};

export default Ranking;
