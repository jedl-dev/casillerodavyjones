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
          Menú Principal
        </button>
        {/*
        <button 
          className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => onNavigate('admin')}
        >
          ⚙️ PERSONAJES
        </button>
        
        
        <button 
          className={`nav-item ${currentView === 'quiz-admin' ? 'active' : ''}`}
          onClick={() => onNavigate('quiz-admin')}
        >
          📝 PREGUNTAS
        </button>*/}
      </div>
    </nav>
  );
};

export default Navbar;