import React from 'react';
import './Shell.css';
import Navbar from './Navbar';
import Link from './Link';
import SeaBackground from './SeaBackground';

const FOOTER_LINKS = [
  { label: 'Inicio', to: '/home' },
  { label: 'Quiz', to: '/quiz' },
  { label: 'Sala', to: '/sala' }
];

const SOCIALS = ['X', 'Instagram', 'TikTok', 'Discord'];

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

        <div className="shell-legal__social" aria-label="Redes sociales, próximamente">
          <span className="shell-legal__social-label">Redes</span>
          {SOCIALS.map((social) => (
            <span key={social} className="shell-legal__social-slot">{social}</span>
          ))}
        </div>
      </div>

      <div className="shell-legal__base">
        <span>El Casillero de Davy D. Jones · 2026</span>
        <span>Sin cuenta, sin descargas.</span>
      </div>
    </footer>
  </div>
);

export default Shell;
