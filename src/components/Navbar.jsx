import React, { useEffect, useState } from 'react';
import Link from './Link';

const TABS = [
  { key: 'home', label: 'Inicio', to: '/home' },
  { key: 'quiz', label: 'Quiz', to: '/quiz' },
  { key: 'sala', label: 'Sala', to: '/sala' }
];

const AnchorMark = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M12 5v16" />
    <circle cx="12" cy="3.4" r="1.9" />
    <path d="M7 8.5h10" />
    <path d="M5 14.5c.4 3.2 3.3 5.5 7 5.5s6.6-2.3 7-5.5" />
    <path d="m4.6 12.8.4 1.9 1.9-.3M19.4 12.8l-.4 1.9-1.9-.3" />
  </svg>
);

const MenuMark = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    {open
      ? <path d="M6 6l12 12M18 6 6 18" />
      : <path d="M4 7h16M4 12h16M4 17h16" />}
  </svg>
);

const Navbar = ({ current, navigate }) => {
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === current;

  const close = () => setOpenOn(null);
  const toggle = () => setOpenOn((value) => (value === current ? null : current));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpenOn(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('nav-locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('nav-locked');
    };
  }, [open]);

  return (
    <>
      <button
        className="nav-toggle"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
      >
        <MenuMark open={open} />
      </button>

      <div className={`nav-backdrop${open ? ' is-open' : ''}`} onClick={close} aria-hidden="true" />

      <header className={`nav${open ? ' is-open' : ''}`} id="site-nav">
        <Link className="nav-brand" to="/home" navigate={navigate} onClick={close} aria-label="El Casillero de Davy D. Jones, ir al inicio">
          <img className="nav-logo" src="/assets/logos/logobase.png" alt="" aria-hidden="true" />
          <span className="nav-name">
            El Casillero
            <span className="nav-name-sub">de Davy D. Jones</span>
          </span>
        </Link>

        <nav className="nav-tabs" aria-label="Navegación principal">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              className={`nav-tab${current === tab.key ? ' is-current' : ''}`}
              to={tab.to}
              navigate={navigate}
              onClick={close}
              aria-current={current === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <AnchorMark className="nav-rail-mark" />
        <span className="nav-rail-label" aria-hidden="true">Cubierta</span>
      </header>
    </>
  );
};

export default Navbar;
