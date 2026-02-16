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
  const [showOverlay, setShowOverlay] = useState(false); // NUEVO: Para ocultar el cartel final

  // Inputs
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  
  // Feedback
  const [message, setMessage] = useState("Cargando base de datos...");
  const [messageType, setMessageType] = useState("info");

  // 1. Cargar Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/characters');
        const chars = res.data.data;
        setAllCharacters(chars);
        if (chars.length > 0) generateValidGrid(chars);
        else {
          setLoading(false);
          setMessage("Base de datos vacía.");
          setMessageType("error");
        }
      } catch (err) {
        setLoading(false);
        setMessage("Error de conexión.");
      }
    };
    fetchData();
  }, []); 

  // 2. Helper de Validación
  const checkCriteria = (char, criteriaKey) => {
    if (!char || !criteriaKey) return false;
    const validator = CRITERIA_DEFINITIONS[criteriaKey];
    return validator ? validator(char) : false;
  };

  // 3. Generar Grid
  const generateValidGrid = useCallback((characters) => {
    setLoading(true);
    setGridState({});
    setGameOver(false);
    setGameWon(false);
    setShowOverlay(false);
    setMessage("¡Completa el Grid!");
    setMessageType("info");
    
    // Filtro inteligente y generación (código resumido igual al anterior)
    const allCriteriaKeys = Object.keys(CRITERIA_DEFINITIONS);
    const validKeys = allCriteriaKeys.filter(key => characters.some(char => CRITERIA_DEFINITIONS[key](char)));

    if (validKeys.length < 6) {
      setLoading(false);
      setMessage("Faltan datos para jugar.");
      return;
    }

    setTimeout(() => {
      let attempts = 0;
      let success = false;
      let sRows = [], sCols = [];

      while (attempts < 5000 && !success) {
        attempts++;
        const shuffled = [...validKeys].sort(() => 0.5 - Math.random());
        sRows = shuffled.slice(0, 3);
        sCols = shuffled.slice(3, 6);

        let isValid = true;
        for (let r of sRows) {
          for (let c of sCols) {
            if (!characters.some(char => CRITERIA_DEFINITIONS[r](char) && CRITERIA_DEFINITIONS[c](char))) {
              isValid = false; break;
            }
          }
          if (!isValid) break;
        }
        if (isValid) success = true;
      }

      setLoading(false);
      if (success) {
        setGridHeaders({ rows: sRows, cols: sCols });
      } else {
        generateValidGrid(characters); // Reintentar
      }
    }, 50); 
  }, []);

  // --- NUEVO: FUNCIÓN PARA RESOLVER EL GRID ---
  const solveGrid = () => {
    const solvedState = { ...gridState }; // Copiamos lo que el usuario ya llenó
    
    // Recorremos todas las celdas (3x3)
    gridHeaders.rows.forEach((rKey, rIndex) => {
      gridHeaders.cols.forEach((cKey, cIndex) => {
        const cellKey = `${rIndex}-${cIndex}`;
        
        // Si la celda está vacía...
        if (!solvedState[cellKey]) {
          // Buscamos el PRIMER personaje que cumpla ambas condiciones
          const match = allCharacters.find(char => 
            checkCriteria(char, rKey) && checkCriteria(char, cKey)
          );
          
          if (match) {
            // Lo agregamos con una marca especial "isRevealed"
            solvedState[cellKey] = { ...match, isRevealed: true };
          }
        }
      });
    });

    setGridState(solvedState);
  };

  // --- MANEJADORES ---
  const handleSearch = (e) => {
    if (gameOver || gameWon) return;
    const term = e.target.value;
    setSearchTerm(term);
    if (selectedChar) setSelectedChar(null);
    if (term.length > 1) {
      const matches = allCharacters.filter(c => 
        c.name.toLowerCase().includes(term.toLowerCase()) || 
        (c.epithet && c.epithet.toLowerCase().includes(term.toLowerCase()))
      );
      setSuggestions(matches.slice(0, 5));
    } else { setSuggestions([]); }
  };

  const selectCharacter = (char) => {
    const isUsed = Object.values(gridState).some(u => u._id === char._id);
    if (isUsed) {
      setMessage(`⚠️ ${char.name} ya está usado.`);
      setMessageType("error");
      setSearchTerm("");
      setSuggestions([]);
      return;
    }
    setSelectedChar(char);
    setSearchTerm(char.name);
    setSuggestions([]);
    setMessage(`Has elegido a ${char.name}.`);
    setMessageType("info");
  };

  const handleCellClick = (rowIndex, colIndex) => {
    if (gameOver || gameWon) return;
    if (gridState[`${rowIndex}-${colIndex}`]) return;

    if (!selectedChar) {
      setMessage("⚠️ Selecciona personaje.");
      setMessageType("error");
      return;
    }
    const rKey = gridHeaders.rows[rowIndex];
    const cKey = gridHeaders.cols[colIndex];

    if (checkCriteria(selectedChar, rKey) && checkCriteria(selectedChar, cKey)) {
      const newState = { ...gridState, [`${rowIndex}-${colIndex}`]: selectedChar };
      setGridState(newState);
      setSearchTerm("");
      setSelectedChar(null);

      if (Object.keys(newState).length === 9) {
        setGameWon(true);
        setShowOverlay(true);
        setMessage("🏆 ¡GRID COMPLETADO!");
        setMessageType("success");
      } else {
        setMessage("¡CORRECTO!");
        setMessageType("success");
      }
    } else {
      setMessage(`❌ ${selectedChar.name} no coincide.`);
      setMessageType("error");
    }
  };

  // Modificado: Rendirse ahora revela solución
  const handleSurrender = () => {
    if (window.confirm("¿Rendirse? Se mostrará la solución.")) {
      solveGrid(); // 1. Llenamos los huecos
      setGameOver(true);
      setShowOverlay(true); // 2. Mostramos el cartel
      setMessage("SOLUCIÓN REVELADA.");
      setMessageType("info");
      setSearchTerm("");
      setSelectedChar(null);
    }
  };

  if (loading) return <div className="grid-loading"><h1>GENERANDO...</h1></div>;

  return (
    <div className="grid-game-container">
      <div className="header-actions">
        <h1 className="game-title">PIRATE GRID</h1>
        
        {/* Si el juego terminó y el overlay está oculto, mostramos botón de Nuevo Juego aquí arriba */}
        {(gameOver || gameWon) && !showOverlay ? (
           <button className="btn-restart" onClick={() => generateValidGrid(allCharacters)}>
             🔄 NUEVO TABLERO
           </button>
        ) : (
           !gameOver && !gameWon && (
            <button className="btn-surrender" onClick={handleSurrender}>🏳️ RENDIRSE</button>
           )
        )}
      </div>

      <div className={`game-message ${messageType}`}>{message}</div>

      {/* OVERLAY FIN DE JUEGO (Ahora se puede ocultar) */}
      {showOverlay && (gameOver || gameWon) && (
        <div className={`endgame-overlay ${gameWon ? 'win' : 'lose'}`}>
          <h2>{gameWon ? '¡VICTORIA!' : 'DERROTA'}</h2>
          <p>{gameWon ? 'Has conquistado el Nuevo Mundo.' : 'Aquí tienes la solución:'}</p>
          
          <div className="endgame-buttons">
            {/* Botón para ver el mapa resuelto */}
            <button className="btn-home" onClick={() => setShowOverlay(false)}>
              👁️ VER TABLERO
            </button>
            
            <button className="btn-restart" onClick={() => generateValidGrid(allCharacters)}>
              🔄 NUEVO TABLERO
            </button>
            
            {onNavigate && (
               <button className="btn-home" onClick={() => onNavigate('home')}>🏠 MENÚ</button>
            )}
          </div>
        </div>
      )}

      {/* TABLERO */}
      {gridHeaders.rows.length > 0 && (
        <div className={`game-board ${gameOver && showOverlay ? 'disabled' : ''}`}>
          <div className="grid-header grid-header-corner"><span>☠️</span></div>
          {gridHeaders.cols.map((col, i) => <div key={`col-${i}`} className="grid-header col-header"><span>{col}</span></div>)}
          
          {gridHeaders.rows.map((row, rIndex) => (
            <React.Fragment key={`row-${rIndex}`}>
              <div className="grid-header row-header"><span>{row}</span></div>
              
              {gridHeaders.cols.map((col, cIndex) => {
                const cellKey = `${rIndex}-${cIndex}`;
                const charInCell = gridState[cellKey];
                const isHint = !gameOver && !gameWon && selectedChar && !charInCell &&
                               checkCriteria(selectedChar, row) && checkCriteria(selectedChar, col);
                
                // Si fue revelado por el sistema, usamos clase especial
                const isRevealed = charInCell?.isRevealed;

                return (
                  <div 
                    key={cellKey} 
                    className={`grid-cell ${charInCell ? 'filled' : ''} ${isHint ? 'hint-active' : ''} ${isRevealed ? 'revealed-cell' : ''}`}
                    onClick={() => handleCellClick(rIndex, cIndex)}
                  >
                    {charInCell ? (
                      <>
                        <img 
                          src={`/assets/${charInCell.imageFile}`} 
                          alt={charInCell.name} 
                          className="cell-image"
                          onError={(e) => e.currentTarget.src = '/assets/shadow.jpg'}
                        />
                        {/* Etiqueta para saber que fue revelado */}
                        {isRevealed && <div className="revealed-badge">SOLUCIÓN</div>}
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
      )}

      {/* INPUT */}
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
              {suggestions.map(char => (
                <li key={char._id} onClick={() => selectCharacter(char)}>
                  <img src={`/assets/${char.imageFile}`} alt="icon" style={{width:30, height:30, borderRadius:'50%', objectFit:'cover', marginRight:10}} onError={(e) => e.currentTarget.src = '/assets/shadow.jpg'}/>
                  {char.name}
                  {Object.values(gridState).some(u => u._id === char._id) && <span style={{marginLeft:'auto', fontSize:'0.8rem', color:'#e74c3c'}}>(USADO)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GridGame;