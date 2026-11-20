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
  const [attempt, setAttempt] = useState(0);

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

    fetchLeaderboard(kind, period, game, 50)
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
  }, [kind, period, game, attempt]);

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
  const scoreOf = (row) => (kind === 'duel' ? row.wins : row.score);
  const topScore = rows.length ? scoreOf(rows[0]) : 0;
  const average = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + scoreOf(row), 0) / rows.length)
    : 0;

  const myIndex = me ? rows.findIndex((row) => samePlayer(row, me)) : -1;
  const myRow = myIndex >= 0 ? rows[myIndex] : (period === 'all' ? mine : null);
  const myRank = myIndex >= 0 ? myIndex + 1 : (period === 'all' ? mine?.rank : null);
  const rivalRow = myIndex > 0 ? rows[myIndex - 1] : null;
  const gap = rivalRow && myRow ? scoreOf(rivalRow) - scoreOf(myRow) : null;

  const soloPath = GAMES.find((item) => item.id === game)?.modes.find((mode) => mode.id === 'solo')?.to || '/quiz';
  const emptyArt = '/assets/referencias/referencia.webp';

  const rowBody = (row, position, pinned = false) => (
    <li
      key={pinned ? 'tu-marca' : `${row.id}-${position}`}
      className={`ranking-row${me && samePlayer(row, me) ? ' is-me' : ''}${pinned ? ' is-pinned' : ''}`}
      style={{ '--fill': `${topScore ? Math.max(6, Math.round((scoreOf(row) / topScore) * 100)) : 0}%` }}
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

  const podium = rows.slice(0, 3);

  return (
    <Shell current="ranking" navigate={navigate}>
      <section className="ranking">
        <header className="ranking-head">
          <div className="ranking-head__copy">
            <h1 className="ranking-title">El tablón del casillero</h1>
            <p className="ranking-lede">
              Las marcas que el fondo del mar no se ha llevado.
            </p>
          </div>

          <dl className="ranking-figures">
            <div>
              <dt>Nombres</dt>
              <dd>{loading ? '—' : rows.length}</dd>
            </div>
            <div>
              <dt>{kind === 'duel' ? 'Más victorias' : 'Marca récord'}</dt>
              <dd>
                {loading || !rows.length
                  ? '—'
                  : (kind === 'duel' ? topScore : formatBounty(topScore))}
              </dd>
            </div>
            <div>
              <dt>Media</dt>
              <dd>
                {loading || !rows.length
                  ? '—'
                  : (kind === 'duel' ? average : formatBounty(average))}
              </dd>
            </div>
          </dl>
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

        {error && !loading ? (
          <div className="ranking-empty" role="alert">
            <p>No se pudo abrir el tablón. {error}</p>
            <button
              type="button"
              className="ranking-cta"
              onClick={() => {
                setLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              Volver a intentar
            </button>
          </div>
        ) : loading ? (
          <div className="ranking-skeleton" role="status" aria-live="polite">
            <span className="ranking-sr">Buceando en el tablón...</span>
            <div className="ranking-podium is-loading" aria-hidden="true">
              {[0, 1, 2].map((key) => <div key={key} className="ranking-podium__slot is-skeleton" />)}
            </div>
            <ul className="ranking-list" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((key) => <li key={key} className="ranking-row is-skeleton" />)}
            </ul>
          </div>
        ) : rows.length === 0 ? (
          <div className="ranking-empty">
            <figure className="ranking-empty__art">
              <img src={emptyArt} alt="" loading="lazy" decoding="async" />
            </figure>
            <div className="ranking-empty__copy">
              <p>Todavía no hay marcas en esta tabla.</p>
              <span>La primera marca del casillero está a un descenso.</span>
              <Link className="ranking-cta" to={soloPath} navigate={navigate}>
                Ser el primero
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ol className={`ranking-podium${podium.length === 3 ? ' is-full' : ` is-count-${podium.length}`}`} aria-label="Podio">
              {podium.map((row, index) => (
                <li
                  key={row.id || row.username}
                  className={`ranking-podium__slot is-p${index + 1}${me && samePlayer(row, me) ? ' is-me' : ''}`}
                >
                  <span className="ranking-podium__pos">{index + 1}</span>
                  <Avatar
                    username={row.username}
                    avatarKey={row.avatar_key}
                    frameKey={row.frame_key}
                    size="lg"
                  />
                  <span className="ranking-podium__name">{row.username}</span>
                  <span className="ranking-podium__score">
                    {kind === 'duel' ? row.wins : formatBounty(row.score)}
                    <small>{scoreLabel}</small>
                  </span>
                </li>
              ))}
            </ol>

            {myRow && (
              <aside className={`ranking-mine${myIndex < 0 ? ' is-outside' : ''}`} aria-label="Tu posición">
                <span className="ranking-mine__rank">
                  {myRank ? `#${myRank}` : '—'}
                </span>
                <div className="ranking-mine__copy">
                  <strong>{myIndex >= 0 ? 'Tu posición' : 'Tu marca histórica'}</strong>
                  <span>
                    {myIndex < 0
                      ? (period === 'all'
                        ? `Puesto ${myRank ?? '—'} en el histórico; tu marca queda fuera de esta página.`
                        : `Puesto ${myRank ?? '—'} en el histórico; esta tabla es de la semana.`)
                      : gap == null
                        ? 'Encabeza esta tabla. No la sueltes.'
                        : gap > 0
                          ? `A ${kind === 'duel' ? gap : formatBounty(gap)} del puesto ${myRank - 1}.`
                          : 'Empatas con el puesto de arriba.'}
                  </span>
                </div>
                <span className="ranking-mine__score">
                  {kind === 'duel' ? myRow.wins : formatBounty(myRow.score)}
                  <small>{scoreLabel}</small>
                </span>
              </aside>
            )}

            {rows.length > 3 ? (
              <ol className="ranking-list">
                {rows.slice(3).map((row, index) => rowBody(row, index + 4))}
              </ol>
            ) : (
              <div className="ranking-empty ranking-empty--invite">
                <figure className="ranking-empty__art">
                  <img src={emptyArt} alt="" loading="lazy" decoding="async" />
                </figure>
                <div className="ranking-empty__copy">
                  <p>El tablón está casi vacío.</p>
                  <span>Las próximas marcas cambian la tabla.</span>
                  <Link className="ranking-cta" to={soloPath} navigate={navigate}>
                    Jugar ahora
                  </Link>
                </div>
              </div>
            )}
          </>
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
