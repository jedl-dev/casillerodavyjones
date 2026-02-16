import React from 'react';
import './GameMenu.css';

const GameMenu = ({ onNavigate }) => {
  return (
    <div className="menu-container">
      <h1 className="menu-title">GRAND LINE GAMES</h1>
      
      <div className="games-grid">
        {/* TARJETA DEL GRID */}
        <div className="game-card highlight" onClick={() => onNavigate('grid-game')}>
          <div className="card-image-wrapper">
            {/* Asegúrate de tener una imagen o usa este placeholder oscuro */}
            <div style={{width:'100%', height:'100%', background:'#0f1216', display:'flex', alignItems:'center', justifyContent:'center'}}>
               <span style={{fontSize:'3rem'}}>3x3</span>
            </div>
          </div>
          <div className="card-content">
            <h3>PIRATE GRID</h3>
            <p>Pon a prueba tu conocimiento. ¿Quién cumple ambas condiciones?</p>
            <span style={{color:'#00d2be', fontSize:'0.8rem', fontWeight:'bold'}}>JUGAR AHORA &rarr;</span>
          </div>
        </div>

        {/* Tarjetas Bloqueadas (Futuros juegos) */}
        <div className="game-card locked">
          <div className="card-image-wrapper"><div className="lock-overlay">🔒</div></div>
          <div className="card-content"><h3>WANTED QUIZ</h3><p>Próximamente...</p></div>
        </div>
      </div>
    </div>
  );
};

export default GameMenu;