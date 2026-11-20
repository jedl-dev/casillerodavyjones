import React, { useEffect, useRef, useState } from 'react';
import Link from './Link';
import Avatar from './Avatar';
import CountryFlag from './CountryFlag';
import { claimArcadeName, clearArcadeIdentity, fetchPlayerStats, getArcadeIdentity, getArcadePlayer, setArcadeIdentity, toIdentity, updateArcadeProfile } from '../lib/arcade';
import { rememberNext, signOutPlayer } from '../lib/playerAuth';
import { formatBounty, validUsername } from '../lib/quizRoom';
import { COUNTRIES } from '../lib/countries';

import { avatarSlots, discoverAssets, frameSlots } from '../lib/assets';

const Icons = {
  juegos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 12 4.5-3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 20V12h4v8M10 20V6h4v14M16 20v-5h4v5" />
    </svg>
  ),
  salas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="9" cy="8.4" r="2.7" />
      <path d="M3.6 19c0-2.9 2.3-4.7 5.4-4.7s5.4 1.8 5.4 4.7" />
      <circle cx="17" cy="9.6" r="2.1" />
      <path d="M15.6 14.5c2.3.2 3.9 1.7 3.9 4.2" />
    </svg>
  )
};

const TABS = [
  { key: 'home', label: 'Juegos', to: '/home#juegos', icon: Icons.juegos },
  { key: 'ranking', label: 'Ranking', to: '/ranking', icon: Icons.ranking },
  { key: 'sala', label: 'Salas', to: '/sala', icon: Icons.salas }
];

const MenuMark = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    {open
      ? <path d="M6 6l12 12M18 6 6 18" />
      : <path d="M4 7h16M4 12h16M4 17h16" />}
  </svg>
);

const FlagMX = () => <CountryFlag code="MX" className="lang__flag" />;

const FlagGB = () => <CountryFlag code="GB" className="lang__flag" />;

const Navbar = ({ current, navigate }) => {
  const [drawer, setDrawer] = useState(false);
  const [lang, setLang] = useState(false);
  const [identity, setIdentity] = useState(getArcadeIdentity);
  const [panel, setPanel] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('inicial');
  const [draftFrame, setDraftFrame] = useState('inicial');
  const [draftCountry, setDraftCountry] = useState('');
  const [stats, setStats] = useState(null);
  const [statsState, setStatsState] = useState('idle');
  const [countrySynced, setCountrySynced] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [frames, setFrames] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => setDrawer(false);
  const goLogin = () => {
    const current = window.location.pathname === '/' ? '/home' : window.location.pathname;
    rememberNext(current);
    close();
  };
  const railRef = useRef(null);
  const toggleRef = useRef(null);
  const accountRef = useRef(null);
  const langRef = useRef(null);
  const panelRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!drawer && !panel && !menu && !lang) return undefined;
    const onKey = (event) => {
      if (event.key === 'Tab' && drawer && railRef.current) {
        const items = [...railRef.current.querySelectorAll('a, button')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (panel) setPanel(false);
      else if (menu) setMenu(false);
      else if (lang) setLang(false);
      else setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    if (drawer || panel) document.body.classList.add('nav-locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('nav-locked');
    };
  }, [drawer, panel, menu, lang]);

  // El cajón móvil se lleva el foco y lo devuelve al botón al cerrarse.
  useEffect(() => {
    if (!drawer) return undefined;
    const toggle = toggleRef.current;
    railRef.current?.querySelector('.rail__tab')?.focus();
    return () => toggle?.focus();
  }, [drawer]);

  // El panel de perfil también es un diálogo: foco dentro y trampa de Tab.
  useEffect(() => {
    if (!panel) return undefined;
    const node = panelRef.current;
    const trigger = profileRef.current;
    node?.querySelector('.nav-panel__close')?.focus();

    const onKey = (event) => {
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [panel]);

  // Los menús se cierran al tocar fuera, no solo con Escape.
  useEffect(() => {
    if (!menu && !lang) return undefined;
    const onDown = (event) => {
      if (menu && accountRef.current && !accountRef.current.contains(event.target)) setMenu(false);
      if (lang && langRef.current && !langRef.current.contains(event.target)) setLang(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu, lang]);

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

  const openPanel = async () => {
    setMenu(false);
    if (!identity?.token) {
      navigate('/quiz');
      return;
    }
    close();
    setError('');
    setStats(null);
    setStatsState('loading');
    setCountrySynced(false);
    setDraftName(identity.username || '');
    setDraftAvatar(identity.avatar_key || 'inicial');
    setDraftFrame(identity.frame_key || 'inicial');
    setDraftCountry(identity.country || '');
    setPanel(true);

    let statsName = identity.username;

    try {
      const player = await getArcadePlayer();
      if (player?.exists) {
        const next = toIdentity(player, identity);
        setArcadeIdentity(next);
        setIdentity(next);
        setDraftName(next.username || '');
        setDraftAvatar(next.avatar_key || 'inicial');
        setDraftFrame(next.frame_key || 'inicial');
        setDraftCountry(next.country || '');
        setCountrySynced(Object.prototype.hasOwnProperty.call(player, 'country'));
        statsName = next.username;
      }
    } catch {
      // Sin conexión: se mantiene la identidad local.
    }

    fetchPlayerStats(statsName)
      .then((data) => {
        setStats(data);
        setStatsState('ready');
      })
      .catch(() => setStatsState('error'));

    const [availableAvatars, availableFrames] = await Promise.all([
      discoverAssets('avatars', avatarSlots),
      discoverAssets('frames', frameSlots)
    ]);
    setAvatars(availableAvatars);
    setFrames(availableFrames);
  };

  const logout = async () => {
    setMenu(false);
    try {
      await signOutPlayer();
    } finally {
      clearArcadeIdentity();
      setIdentity(null);
      setPanel(false);
      navigate('/login');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const name = draftName.trim();
      if (name && name !== identity.username) {
        if (!validUsername(name)) {
          setError('Usa de 3 a 16 letras, números o guion bajo.');
          return;
        }
        await claimArcadeName(name);
      }
      await updateArcadeProfile(
        identity.token,
        draftAvatar,
        draftFrame,
        draftCountry || null,
        countrySynced
      );
      setIdentity(getArcadeIdentity());
      setPanel(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        className="nav-toggle"
        type="button"
        ref={toggleRef}
        onClick={() => setDrawer((value) => !value)}
        aria-expanded={drawer}
        aria-controls="site-rail"
        aria-label={drawer ? 'Cerrar menú' : 'Abrir menú'}
      >
        <MenuMark open={drawer} />
      </button>

      <div className={`nav-backdrop${drawer ? ' is-open' : ''}`} onClick={close} aria-hidden="true" />

      <header className="topbar">
        <Link className="topbar__brand" to="/home" navigate={navigate} onClick={close} aria-label="El Casillero de Davy D. Jones, ir al inicio">
          <img className="topbar__logo" src="/assets/logos/logobase.png" alt="" aria-hidden="true" />
          <span className="topbar__name">
            El Casillero
            <span className="topbar__name-sub">de Davy D. Jones</span>
          </span>
        </Link>

        <div className="topbar__account" ref={accountRef}>
          <div className="lang" ref={langRef}>
            <button
              type="button"
              className="lang__btn"
              onClick={() => setLang((value) => !value)}
              aria-haspopup="listbox"
              aria-expanded={lang}
              aria-label="Idioma: español"
            >
              <FlagMX />
              <span>ES</span>
            </button>

            {lang && (
              <div className="lang__menu" role="listbox" aria-label="Idioma">
                <button type="button" role="option" aria-selected="true" className="lang__opt is-current">
                  <FlagMX />
                  <span>Español</span>
                </button>
                <button type="button" role="option" aria-selected="false" className="lang__opt" disabled>
                  <FlagGB />
                  <span>English · próximamente</span>
                </button>
              </div>
            )}
          </div>

          {identity?.username ? (
            <>
              <button
                type="button"
                className="nav-profile"
                ref={profileRef}
                onClick={() => setMenu((value) => !value)}
                aria-expanded={menu}
                aria-haspopup="menu"
              >
                <Avatar
                  username={identity.username}
                  avatarKey={identity.avatar_key}
                  frameKey={identity.frame_key}
                  size="sm"
                />
                <span className="nav-profile__name">{identity.username}</span>
              </button>

              {menu && (
                <div className="nav-menu" role="menu">
                  <button type="button" role="menuitem" onClick={openPanel}>Mi perfil</button>
                  <Link role="menuitem" to="/ranking" navigate={navigate} onClick={() => setMenu(false)}>
                    Ranking
                  </Link>
                  <button type="button" role="menuitem" onClick={logout}>Cerrar sesión</button>
                </div>
              )}
            </>
          ) : (
            <>
              <Link className="nav-login" to="/login" navigate={navigate} onClick={goLogin}>
                Entrar
              </Link>
              <Link className="nav-signup" to="/login?mode=register" navigate={navigate} onClick={goLogin}>
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </header>

      <nav className={`rail${drawer ? ' is-open' : ''}`} id="site-rail" ref={railRef} aria-label="Navegación principal">
        <div className="rail__tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              className={`rail__tab${current === tab.key ? ' is-current' : ''}`}
              to={tab.to}
              navigate={navigate}
              onClick={close}
              aria-current={current === tab.key ? 'page' : undefined}
            >
              <span className="rail__icon" aria-hidden="true">{tab.icon}</span>
              <span className="rail__txt">{tab.label}</span>
            </Link>
          ))}
        </div>

        {!identity?.username && (
          <Link className="rail__signup" to="/login?mode=register" navigate={navigate} onClick={goLogin}>
            Crear cuenta
          </Link>
        )}
      </nav>

      {panel && identity && (
        <div className="nav-panel" role="dialog" aria-modal="true" aria-labelledby="nav-panel-title">
          <div className="nav-panel__card" ref={panelRef}>
            <header className="nav-panel__head">
              <div className="nav-panel__identity">
                <Avatar
                  username={identity.username}
                  avatarKey={draftAvatar}
                  frameKey={draftFrame}
                  size="lg"
                />
                <div>
                  <h2 id="nav-panel-title">
                    {identity.username}
                    {draftCountry && (
                      <CountryFlag code={draftCountry} className="nav-panel__flag-inline" />
                    )}
                  </h2>
                  <p>Tu perfil guarda marcas, racha, avatar y nombre.</p>
                </div>
              </div>
              <button type="button" className="nav-panel__close" onClick={() => setPanel(false)} aria-label="Cerrar">
                ×
              </button>
            </header>

            <section className="nav-panel__group" aria-labelledby="panel-stats">
              <h3 id="panel-stats">Tus partidas</h3>
              {statsState === 'loading' && (
                <p className="nav-panel__note">Buscando tus marcas...</p>
              )}
              {statsState === 'error' && (
                <p className="nav-panel__note">No se pudieron cargar tus marcas.</p>
              )}
              {statsState === 'ready' && (
                <dl className="nav-panel__stats">
                  <div>
                    <dt>Mejor marca</dt>
                    <dd>
                      {stats?.bestSolo != null ? formatBounty(stats.bestSolo) : 'Sin marca'}
                      <small>Quiz en solitario</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Duelos ganados</dt>
                    <dd>
                      {stats?.duelWins ?? 0}
                      <small>Quiz 1 vs 1</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Racha actual</dt>
                    <dd>
                      {identity.day_streak || 0}
                      <small>días seguidos</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Récord de racha</dt>
                    <dd>
                      {identity.best_day_streak || 0}
                      <small>días</small>
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="nav-panel__group" aria-labelledby="panel-name">
              <h3 id="panel-name">Nombre</h3>
              <input
                className="op-input"
                value={draftName}
                maxLength={16}
                onChange={(event) => setDraftName(event.target.value)}
                disabled={saving}
                placeholder="Ej. Mugiwara"
                autoComplete="nickname"
              />
              <p className="nav-panel__note">Cambiarlo conserva tus marcas y tu racha.</p>
            </section>

            <section className="nav-panel__group" aria-labelledby="panel-country">
              <h3 id="panel-country">Bandera</h3>
              <div className="nav-panel__flag">
                <span className="nav-panel__flag-preview" aria-hidden="true">
                  {draftCountry
                    ? <CountryFlag code={draftCountry} className="nav-panel__flag-icon" />
                    : '—'}
                </span>
                <select
                  className="op-input"
                  value={draftCountry}
                  onChange={(event) => setDraftCountry(event.target.value)}
                  aria-label="País de la bandera"
                  disabled={saving}
                >
                  <option value="">Sin bandera</option>
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name} · {country.code}
                    </option>
                  ))}
                </select>
              </div>
              {!countrySynced && (
                <p className="nav-panel__note">La bandera se guarda en este dispositivo.</p>
              )}
            </section>

            <section className="nav-panel__group" aria-labelledby="panel-avatar">
              <h3 id="panel-avatar">Avatar</h3>
              {avatars.length ? (
                <div className="nav-panel__grid">
                  {['inicial', ...avatars].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`nav-panel__tile${draftAvatar === key ? ' is-selected' : ''}`}
                      onClick={() => setDraftAvatar(key)}
                      aria-pressed={draftAvatar === key}
                    >
                      <Avatar username={identity.username} avatarKey={key} size="lg" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="nav-panel__note">
                  La galería llega pronto. Sube las imágenes a <code>/assets/avatars</code>.
                </p>
              )}
            </section>

            <section className="nav-panel__group" aria-labelledby="panel-frame">
              <h3 id="panel-frame">Marco</h3>
              {frames.length ? (
                <div className="nav-panel__grid">
                  {['inicial', ...frames].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`nav-panel__tile${draftFrame === key ? ' is-selected' : ''}`}
                      onClick={() => setDraftFrame(key)}
                      aria-pressed={draftFrame === key}
                    >
                      <Avatar username={identity.username} avatarKey={draftAvatar} frameKey={key} size="lg" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="nav-panel__note">
                  Los marcos llegan pronto. Sube las imágenes a <code>/assets/frames</code>.
                </p>
              )}
            </section>

            {error && <p className="op-error" role="alert">{error}</p>}

            <footer className="nav-panel__actions">
              <button type="button" className="op-btn nav-panel__logout" onClick={logout}>
                Cerrar sesión
              </button>
              <button type="button" className="op-btn" onClick={() => setPanel(false)}>
                Cancelar
              </button>
              <button type="button" className="op-btn op-btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
