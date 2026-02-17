import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './GridGame.css';
import { CRITERIA_DEFINITIONS } from '../gridCriteria';

const GridGame = ({ onNavigate }) => {
  const [allCharacters, setAllCharacters] = useState([]);
  const [gridHeaders, setGridHeaders] = useState({ rows: [], cols: [] });
  const [gridState, setGridState] = useState({});
  const [loading, setLoading] = useState(true);

  // Estados de Juego
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Inputs
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  
  // Feedback
  const [message, setMessage] = useState("Cargando base de datos...");
  const [messageType, setMessageType] = useState("info");

  // --- 1. CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/characters');
        setAllCharacters(res.data.data);
        if (res.data.data.length > 0) generateValidGrid(res.data.data);
      } catch (err) {
        setLoading(false);
        setMessage("Error de conexión.");
      }
    };
    fetchData();
  }, []); 

  // --- 2. VALIDACIÓN ---
  const checkCriteria = (char, criteriaKey) => {
    if (!char || !criteriaKey) return false;
    const validator = CRITERIA_DEFINITIONS[criteriaKey];
    return validator ? validator(char) : false;
  };

  // --- 3. GENERADOR DE GRID ---
  const generateValidGrid = useCallback((characters) => {
    setLoading(true);
    setGridState({});
    setGameOver(false);
    setGameWon(false);
    setShowOverlay(false);
    setMessage("¡Completa el Grid!");
    setMessageType("info");
    setSearchTerm("");
    setSelectedChar(null);
    
    const allCriteriaKeys = Object.keys(CRITERIA_DEFINITIONS);
    const validKeys = allCriteriaKeys.filter(key => characters.some(char => CRITERIA_DEFINITIONS[key](char)));

    setTimeout(() => {
      let success = false;
      let sRows = [], sCols = [];
      
      // Intentamos generar un grid válido
      for (let i = 0; i < 5000; i++) {
        const shuffled = [...validKeys].sort(() => 0.5 - Math.random());
        sRows = shuffled.slice(0, 3);
        sCols = shuffled.slice(3, 6);
        
        // Verificamos que cada celda tenga solución
        let isValid = sRows.every(r => sCols.every(c => characters.some(char => checkCriteria(char, r) && checkCriteria(char, c))));
        
        if (isValid) { success = true; break; }
      }
      
      setLoading(false);
      if (success) setGridHeaders({ rows: sRows, cols: sCols });
      else generateValidGrid(characters); // Reintentar si falló
    }, 50); 
  }, []);

  // --- 4. SOLUCIONADOR (RENDIRSE) ---
  const solveGrid = () => {
    const solvedState = { ...gridState };
    gridHeaders.rows.forEach((rKey, rIdx) => {
      gridHeaders.cols.forEach((cKey, cIdx) => {
        const cellKey = `${rIdx}-${cIdx}`;
        if (!solvedState[cellKey]) {
          // Buscamos un personaje que cumpla y que NO esté ya en el tablero
          const match = allCharacters.find(char => 
            checkCriteria(char, rKey) && checkCriteria(char, cKey) && 
            !Object.values(solvedState).some(u => u._id === char._id)
          );
          if (match) solvedState[cellKey] = { ...match, isRevealed: true };
        }
      });
    });
    setGridState(solvedState);
  };

  // --- 5. MANEJADORES DE INPUT ---
  const handleSearch = (e) => {
    if (gameOver || gameWon) return;
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length > 1) {
      const matches = allCharacters.filter(c => 
        c.name.toLowerCase().includes(term.toLowerCase()) || 
        (c.epithet && c.epithet.toLowerCase().includes(term.toLowerCase()))
      );
      setSuggestions(matches.slice(0, 5)); // Limitamos a 5 sugerencias
    } else { setSuggestions([]); }
  };

  const selectCharacter = (char) => {
    // Si ya está usado, mostramos error
    if (Object.values(gridState).some(u => u._id === char._id)) {
      setMessage(`⚠️ ${char.name} ya está en el tablero.`);
      setMessageType("error");
      setSuggestions([]); // Limpiamos sugerencias pero dejamos el nombre para que vea cuál era
      return;
    }
    setSelectedChar(char);
    setSearchTerm(char.name);
    setSuggestions([]);
    setMessage(`Seleccionado: ${char.name}`);
    setMessageType("info");
  };

  const handleCellClick = (rIdx, cIdx) => {
    if (gameOver || gameWon || gridState[`${rIdx}-${cIdx}`]) return;
    
    if (!selectedChar) {
      setMessage("⚠️ Busca y selecciona un personaje primero.");
      setMessageType("error");
      return;
    }

    const rowCriteria = gridHeaders.rows[rIdx];
    const colCriteria = gridHeaders.cols[cIdx];

    if (checkCriteria(selectedChar, rowCriteria) && checkCriteria(selectedChar, colCriteria)) {
      const newState = { ...gridState, [`${rIdx}-${cIdx}`]: selectedChar };
      setGridState(newState);
      setSelectedChar(null);
      setSearchTerm("");
      
      if (Object.keys(newState).length === 9) {
        setGameWon(true);
        setShowOverlay(true);
        setMessage("🏆 ¡HAS CONQUISTADO EL GRID!");
        setMessageType("success");
      } else {
        setMessage("✅ ¡Correcto!");
        setMessageType("success");
      }
    } else {
      setMessage(`❌ ${selectedChar.name} no cumple los requisitos.`);
      setMessageType("error");
    }
  };

  if (loading) return <div className="grid-loading"><h1>Generando Grid...</h1></div>;

  return (
    <div className="grid-game-container">
      <div className="header-actions">
        <h1 className="game-title">PIRATE GRID</h1>
        {!gameOver && !gameWon && (
          <button className="btn-surrender" onClick={() => { if(window.confirm("¿Rendirse?")) { solveGrid(); setGameOver(true); setShowOverlay(true); } }}>🏳️ RENDIRSE</button>
        )}
        {(gameOver || gameWon) && !showOverlay && (
          <button className="btn-restart" onClick={() => generateValidGrid(allCharacters)}>🔄 NUEVO JUEGO</button>
        )}
      </div>

      <div className={`game-message ${messageType}`}>{message}</div>

      {/* OVERLAY DE VICTORIA/DERROTA */}
      {showOverlay && (
        <div className={`endgame-overlay ${gameWon ? 'win' : 'lose'}`}>
          <h2>{gameWon ? '¡VICTORIA!' : 'TABLERO COMPLETADO'}</h2>
          <div className="endgame-buttons">
            <button className="btn-home" onClick={() => setShowOverlay(false)}>👁️ VER MAPA</button>
            <button className="btn-restart" onClick={() => generateValidGrid(allCharacters)}>🔄 REINTENTAR</button>
            {onNavigate && <button className="btn-home" onClick={() => onNavigate('home')}>🏠 MENÚ</button>}
          </div>
        </div>
      )}

      {/* TABLERO DE JUEGO */}
      <div className={`game-board ${gameOver && showOverlay ? 'disabled' : ''}`}>
        <div className="grid-header grid-header-corner"><span>☠️</span></div>
        {gridHeaders.cols.map((col, i) => <div key={i} className="grid-header col-header"><span>{col}</span></div>)}
        
        {gridHeaders.rows.map((row, rIdx) => (
          <React.Fragment key={rIdx}>
            <div className="grid-header row-header"><span>{row}</span></div>
            {gridHeaders.cols.map((col, cIdx) => {
              const char = gridState[`${rIdx}-${cIdx}`];
              // Lógica para que la celda brille si es una opción válida (Pista)
              const isHint = !gameOver && !gameWon && selectedChar && !char && checkCriteria(selectedChar, row) && checkCriteria(selectedChar, col);
              
              return (
                <div 
                  key={cIdx} 
                  className={`grid-cell ${char ? 'filled' : ''} ${isHint ? 'hint-active' : ''} ${char?.isRevealed ? 'revealed-cell' : ''}`} 
                  onClick={() => handleCellClick(rIdx, cIdx)}
                >
                  {char ? (
                    <>
                      <img 
                        src={`/assets/${char.imageFile}`} 
                        alt={char.name} 
                        className="cell-image" 
                        onError={(e) => e.target.src='/assets/shadow.jpg'} 
                      />
                      {char.isRevealed && <div className="revealed-badge">SOLUCIÓN</div>}
                    </>
                  ) : (
                    <span className="cell-placeholder">{isHint ? '✨' : '+'}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* INPUT / BUSCADOR */}
      <div className="game-controls">
        <div className="search-wrapper">
          <input 
            type="text" 
            className="pirate-input" 
            placeholder={gameOver || gameWon ? "Fin del Juego" : "Busca un pirata..."} 
            value={searchTerm} 
            onChange={handleSearch} 
            disabled={gameOver || gameWon} 
          />
          
          {suggestions.length > 0 && (
            <ul className="suggestions-list">
              {suggestions.map(c => {
                 const isUsed = Object.values(gridState).some(u => u._id === c._id);
                 return (
                  <li key={c._id} onClick={() => selectCharacter(c)}>
                    {/* IMAGEN DEL PERSONAJE EN LA SUGERENCIA */}
                    <img 
                      src={`/assets/${c.imageFile}`} 
                      alt="" 
                      className="suggestion-icon"
                      onError={(e) => e.currentTarget.src = '/assets/shadow.jpg'}
                    />
                    {c.name}
                    {/* ETIQUETA SI YA ESTÁ USADO */}
                    {isUsed && <span className="used-tag">(USADO)</span>}
                  </li>
                 );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GridGame;