import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './GridGame.css';

const GridGame = ({ onNavigate }) => {
  const [gridHeaders, setGridHeaders] = useState({ rows: [], cols: [] });
  const [gridState, setGridState] = useState({});
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [hints, setHints] = useState({}); 
  const [message, setMessage] = useState("");

  const API_URL = 'http://localhost:5000/api/grid-game';

  const fetchNewGame = async () => {
    setLoading(true); setGridState({}); setGameOver(false); setGameWon(false);
    setShowOverlay(false); setShowConfirmModal(false); setSuggestions([]); 
    setSearchTerm(""); setSelectedChar(null); setHints({});
    try {
      const res = await axios.get(`${API_URL}/new`);
      if (res.data.success) setGridHeaders({ rows: res.data.rows, cols: res.data.cols });
    } catch (err) { console.error(err); }
    finally { setTimeout(() => setLoading(false), 600); }
  };

  useEffect(() => { fetchNewGame(); }, []);

  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (gameOver || gameWon || term.length <= 2) { setSuggestions([]); return; }
    try {
      const res = await axios.get(`${API_URL}/search`, { params: { q: term } });
      setSuggestions(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) { console.error(err); }
  };

  const selectCharacter = async (char) => {
    if (Object.values(gridState).some(u => u._id === char._id)) return;
    setSelectedChar(char);
    setSearchTerm(char.name);
    setSuggestions([]);
    try {
      const res = await axios.post(`${API_URL}/check-hints`, {
        characterId: char._id,
        rows: gridHeaders.rows,
        cols: gridHeaders.cols
      });
      if (res.data.success) setHints(res.data.hints);
    } catch (err) { console.error(err); }
  };

  const handleCellClick = async (rIdx, cIdx) => {
    if (gameOver || gameWon || gridState[`${rIdx}-${cIdx}`] || !selectedChar) return;
    try {
      const res = await axios.post(`${API_URL}/validate`, {
        characterId: selectedChar._id, rowCategory: gridHeaders.rows[rIdx], colCategory: gridHeaders.cols[cIdx]
      });
      if (res.data.correct) {
        const newState = { ...gridState, [`${rIdx}-${cIdx}`]: selectedChar };
        setGridState(newState); setSelectedChar(null); setSearchTerm(""); setHints({});
        if (Object.keys(newState).length === 9) { 
          setGameWon(true); 
          setTimeout(() => setShowOverlay(true), 600); 
        }
      } else {
        setMessage(`❌ ${selectedChar.name} no encaja`);
        setTimeout(() => setMessage(""), 2500);
      }
    } catch (err) { console.error(err); }
  };

  const confirmSurrender = async () => {
    setShowConfirmModal(false);
    try {
      const res = await axios.post(`${API_URL}/solve`, { rows: gridHeaders.rows, cols: gridHeaders.cols });
      if (res.data.success) {
        setGridState(prev => ({ ...res.data.solution, ...prev }));
        setGameOver(true); setShowOverlay(true);
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="grid-loading-screen">
      <div className="anchor-spinner">⚓</div>
      <h2>GENERANDO GRID...</h2>
    </div>
  );

  return (
    <div className="grid-game-wrapper fade-in-page">
      <div className="game-header">
        <h1 className="title-pirate">PIRATE GRID</h1>
        <div className="header-actions">
          {(gameOver || gameWon) && (
            <button className="btn-pirate btn-small" onClick={fetchNewGame}>🔄 NUEVO</button>
          )}
        </div>
      </div>

      {message && <div className="floating-error-msg">{message}</div>}

      {showConfirmModal && (
        <div className="game-overlay">
          <div className="overlay-card bounce-in">
            <h2 className="lose-title">¿Rendrise?</h2>
            <p>Se revelará una solución , pero no podras jugar el mismo grid.</p>
            <div className="overlay-btn-group-row">
              <button className="btn-pirate btn-confirm" onClick={confirmSurrender}>SÍ, RENDIRSE</button>
              <button className="btn-pirate btn-cancel" onClick={() => setShowConfirmModal(false)}>NO, SEGUIR</button>
            </div>
          </div>
        </div>
      )}

      {showOverlay && (
        <div className="game-overlay">
          <div className="overlay-card bounce-in">
            <h2 className={gameWon ? 'win-title' : 'lose-title'}>
              {gameWon ? '¡REY DE LOS PIRATAS!' : 'FIN DEL JUEGO'}
            </h2>
            <div className="overlay-btn-group">
              <button className="btn-pirate" onClick={() => setShowOverlay(false)}>VER TABLERO </button>
              <button className="btn-pirate" onClick={fetchNewGame}>NUEVA PARTIDA</button>
              {onNavigate && <button className="btn-pirate btn-exit" onClick={() => onNavigate('home')}>SALIR</button>}
            </div>
          </div>
        </div>
      )}

      <div className={`grid-board ${(gameOver && showOverlay) || showConfirmModal ? 'blurred' : ''}`}>
        <div className="header-cell corner entrance-anim" style={{ animationDelay: '0s' }}>☠️</div>
        {gridHeaders.cols.map((col, i) => (
          <div key={i} className="header-cell col-header entrance-anim" style={{ animationDelay: `${(i+1)*0.1}s` }}>{col}</div>
        ))}
        {gridHeaders.rows.map((row, rIdx) => (
          <React.Fragment key={rIdx}>
            <div className="header-cell row-header entrance-anim" style={{ animationDelay: `${(rIdx+1)*0.15}s` }}>{row}</div>
            {gridHeaders.cols.map((col, cIdx) => {
              const char = gridState[`${rIdx}-${cIdx}`];
              const isHint = hints[`${rIdx}-${cIdx}`];
              return (
                <div 
                  key={cIdx} 
                  className={`grid-cell entrance-anim ${char ? 'filled pop-in' : 'empty'} ${isHint ? 'highlight-hint' : ''}`}
                  style={{ animationDelay: `${(rIdx + cIdx + 2) * 0.1}s` }}
                  onClick={() => handleCellClick(rIdx, cIdx)}
                >
                  {char ? (
                    <div className="char-card">
                      <img src={`/assets/${char.imageFile}`} alt={char.name} onError={(e) => e.target.src = '/assets/shadow.jpg'} />
                      <div className="char-name-tag">{char.name}</div>
                    </div>
                  ) : <span className="plus-sign">+</span>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="controls-area">
        <div className="search-group-horizontal">
          <div className="search-input-wrapper">
            <input 
              type="text" 
              className="pirate-input"
              placeholder="Busca un personaje..." 
              value={searchTerm} 
              onChange={handleSearch} 
              disabled={gameOver} 
            />
            {suggestions.length > 0 && (
              <ul className="suggestions-dropdown">
                {suggestions.map(c => (
                  <li key={c._id} onClick={() => selectCharacter(c)}>
                    <img src={`/assets/${c.imageFile}`} alt="" onError={(e) => e.target.src = '/assets/shadow.jpg'} />
                    <span>{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!gameOver && !gameWon && (
            <button className="btn-surrender-main" onClick={() => setShowConfirmModal(true)} title="Rendirse">🏳️</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GridGame;