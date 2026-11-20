import React from 'react';
import './Shell.css';
import Navbar from './Navbar';
import Link from './Link';
import SeaBackground from './SeaBackground';

const FOOTER_LINKS = [
  { label: 'Juegos', to: '/home#juegos' },
  { label: 'Ranking', to: '/ranking' },
  { label: 'Salas', to: '/sala' }
];

const Shell = ({ current, navigate, className = '', children }) => (
  <div className={`shell ${className}`.trim()}>
    <SeaBackground />
    <Navbar current={current} navigate={navigate} />
    <main className="shell-main">{children}</main>
    <footer className="shell-legal">
      <div className="shell-legal__top">
        <Link className="shell-legal__brand" to="/home" navigate={navigate}>
          <img src="/assets/logos/logobase.png" alt="" aria-hidden="true" />
          <span>
            El Casillero
            <span className="shell-legal__brand-sub">de Davy D. Jones</span>
          </span>
        </Link>

        <nav className="shell-legal__nav" aria-label="Enlaces del pie">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.to} to={link.to} navigate={navigate}>{link.label}</Link>
          ))}
        </nav>
      </div>

      <div className="shell-legal__base">
        <span>© 2026</span>
        <span>Proyecto de fans · Necesitas cuenta para jugar</span>
      </div>
    </footer>
  </div>
);

export default Shell;
