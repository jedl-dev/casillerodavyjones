import React from 'react';
import './GameMenu.css';

const GameMenu = ({ onNavigate }) => {
  return (
    <div className="menu-container">
      <h1 className="menu-title">GRAND LINE GAMES</h1>
      
      <div className="games-grid">
        {/* TARJETA DEL GRID (Juego 1) */}
        <div className="game-card highlight" onClick={() => onNavigate('grid-game')}>
          <div className="card-image-wrapper">
            <img 
              src="public/assets/juegos/pirategrid.jpg" 
              alt="Pirate Grid" 
              className="game-card-img"
            />
          </div>
          <div className="card-content">
            <h3>PIRATE GRID</h3>
            <p>Pon a prueba tu conocimiento sobre los rasgos y atributos de personajes de One Piece.</p>
            <span className="play-now-label">JUGAR AHORA &rarr;</span>
          </div>
        </div>

        {/* TARJETA DEL QUIZ (Juego 2 - ¡DESBLOQUEADO!) */}
        <div className="game-card highlight" onClick={() => onNavigate('wanted-quiz')}>
          <div className="card-image-wrapper">
            <img 
              src="/assets/juegos/quiz.jpg" 
              alt="Wanted Quiz" 
              className="game-card-img"
            />
          </div>
          <div className="card-content">
            <h3>WANTED QUIZ</h3>
            <p>Supera las 15 preguntas de dificultad ascendente y demuestra que sabes de ONE PIECE</p>
            <span className="play-now-label">EMPEZAR DESAFÍO &rarr;</span>
          </div>
        </div>

        {/* Espacio para futuros juegos (Bloqueados) */}
        <div className="game-card locked">
          <div className="card-image-wrapper">
             <div className="lock-overlay">🔒</div>
          </div>
          <div className="card-content">
            <h3>LOG POSE ADVENTURE</h3>
            <p>Próximamente...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameMenu;