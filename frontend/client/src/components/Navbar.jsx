import React from 'react';
import './Navbar.css';

const Navbar = ({ onNavigate, currentView }) => {
  return (
    <nav className="main-navbar">
      <div className="nav-logo" onClick={() => onNavigate('home')}>
        ☠️ GRAND LINE GAMES
      </div>
      
      <div className="nav-links">
        <button 
          className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => onNavigate('home')}
        >
          Juegos
        </button>
        
        {/* El Registro ahora es una herramienta del Nav */}
        <button 
          className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => onNavigate('admin')}
        >
          ⚙️ Admin / Registro
        </button>
      </div>
    </nav>
  );
};

export default Navbar;