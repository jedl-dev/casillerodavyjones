import React, { useState } from 'react';
import './Navbar.css';

const Navbar = ({ onNavigate, currentView }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleNav = (target) => {
    onNavigate(target);
    setIsOpen(false); // Cierra el menú al navegar
  };

  return (
    <>
      {/* Botón de Hamburguesa (Trigger) */}
      <button className={`menu-toggle ${isOpen ? 'open' : ''}`} onClick={toggleMenu}>
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
      </button>

      {/* Overlay para cerrar al hacer clic fuera */}
      {isOpen && <div className="sidebar-overlay" onClick={toggleMenu}></div>}

      {/* Barra Lateral */}
      <nav className={`sidebar-nav ${isOpen ? 'active' : ''}`}>
        <div className="sidebar-logo" onClick={() => handleNav('home')}>
          <img 
            src="/assets/logos/logoNAV.png" 
            alt="Grand Line Games Logo" 
            className="sidebar-logo-img" 
          />
        </div>

        <div className="sidebar-links">
          <button 
            className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => handleNav('home')}
          >
            🏠 Menú Principal
          </button>
          {/*
          <button 
            className={`sidebar-item ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => handleNav('admin')}
          >
            ⚙️ Personajes
          </button> 
          
          <button 
            className={`sidebar-item ${currentView === 'quiz-admin' ? 'active' : ''}`}
            onClick={() => handleNav('quiz-admin')}
          >
            📝 Preguntas
          </button> */}

          <button 
            className={`sidebar-item ${currentView === 'changelog' ? 'active' : ''}`}
            onClick={() => handleNav('changelog')}
          > 
            📜 Notas del Parche
          </button>
        </div>

        <div className="sidebar-footer">
          <p>The Pirate Archive © 2026</p>
        </div>
      </nav>
    </>
  );
};

export default Navbar;