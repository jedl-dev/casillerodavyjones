import React from 'react';
import './GameMenu.css';

const GameMenu = ({ onNavigate }) => {
  const particles = Array.from({ length: 15 });

  const gameList = [
    { id: 'grid-game', title: 'PIRATE GRID', img: 'assets/juegos/pirategrid.JPG', desc: 'Conecta rasgos y atributos para completar el tablero.', label: 'INICIAR DESAFÍO', highlight: true },
    { id: 'wanted-quiz', title: 'WANTED QUIZ', img: 'assets/juegos/quiz.jpg', desc: '15 preguntas de dificultad ascendente. ¿Llegarás al final?', label: 'INICIAR DESAFÍO', highlight: true },
    { id: 'bounty-clash', title: 'BOUNTY CLASH', img: '/assets/juegos/bounty.jpg', desc: 'Duelo de recompensas. ¿Quién tiene recompensa mayor o menor?', label: 'INICIAR DESAFÍO', new: true },
    { id: 'bounty-dle', title: 'NAKAMA GUESS', img: '/assets/juegos/guess.jpg', desc: 'Adivina el pirata misterioso segun la afinidad con otros', label: 'INICIAR DESAFÍO', highlight: false },
    { id: 'name-wordle', title: 'RIO NAME', img: '/assets/juegos/rio.jpg', desc: 'Descifra el nombre oculto antes de que se agoten los intentos.', label: 'INICIAR DESAFÍO', highlight: false },
    { id: 'impostor-game', title: 'IMPOSTOR', img: '/assets/juegos/impostor.jpg', desc: 'Identifica al infiltrado que no pertenece al grupo.', label: 'INICIAR DESAFÍO', highlight: false },
  ];

  return (
    <div className="menu-container">
      <div className="particles-background">
        {particles.map((_, i) => <div key={i} className="particle"></div>)}
      </div>
       {/* Banner de Noticias estilo Periódico News Coo */}
          <div className="news-coo-banner" onClick={() => onNavigate('changelog')}>
            <span className="news-tag">EXTRA!</span>
            <p>Nuevas actualizaciones en el archivo. Ver notas del parche v1.4.0</p>
          </div>
          
      <div className="menu-content-wrapper">
        <header className="menu-header-area">
          <img src="/assets/logos/logoNAV.png" alt="Logo" className="menu-logo-img" />
          
         
        </header>
        
        <div className="games-grid">
          {gameList.map((game) => (
            <div 
              key={game.id} 
              className={`game-card ${game.new ? 'card-new' : ''}`} 
              onClick={() => onNavigate(game.id)}
            >
              <div className="card-image-wrapper">
                {game.new && <div className="wax-seal-badge">NUEVO</div>}
                <img src={game.img} alt={game.title} className="game-card-img" />
                <div className="card-overlay-glint"></div>
              </div>
              <div className="card-content">
                <h3>{game.title}</h3>
                <p>{game.desc}</p>
                <div className="card-footer">
                  <span className="play-btn-text">{game.label}</span>
                  <span className="arrow-icon">→</span>
                </div>
              </div>
            </div>
          ))}

          {/* Card Bloqueada */}
          <div className="game-card locked">
            <div className="card-image-wrapper">
              <div className="lock-icon-v2">🔒</div>
              <img src="/assets/juegos/mystery.jpg" alt="Misterio" className="game-card-img grayscale" />
            </div>
            <div className="card-content">
              <h3>???</h3>
              <p>Los archivos están protegidos por Haki de Observación.</p>
              <span className="locked-status">PRÓXIMAMENTE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameMenu;