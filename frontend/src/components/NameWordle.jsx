import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './NameWordle.css';

const NameWordle = ({ onNavigate }) => {
  const [targetName, setTargetName] = useState("");
  const [targetChar, setTargetChar] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState("playing"); 
  const [loading, setLoading] = useState(true);

  // --- ESTADO DEL TUTORIAL ---
  const [showTutorial, setShowTutorial] = useState(true);

  const MAX_GUESSES = 6;
  const API_URL = import.meta.env.VITE_API_URL || 'https://gran-line-games-api.vercel.app/api/characters';

  // Teclado QWERTY
  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
  ];

  // Array para generar las partículas dinámicas
  const particles = Array.from({ length: 15 });

  useEffect(() => {
    initGame();
  }, []);

  const initGame = async () => {
    setLoading(true);
    setGameStatus("playing");
    setGuesses([]);
    setCurrentGuess("");
    try {
      const res = await axios.get(API_URL);
      const chars = res.data.data || res.data;
      
      const processedChars = chars.map(c => {
        // Dividimos por espacios o guiones para manejar nombres largos
        const nameParts = c.name.split(/[\s-]+/);
        
        // Filtramos solo las partes que tengan de 4 a 7 letras para la responsividad
        const validParts = nameParts.filter(part => part.length >= 4 && part.length <= 7);

        if (validParts.length > 0) {
          // Elegimos una parte al azar (ej: "Luffy" en vez de "Monkey")
          const selectedPart = validParts[Math.floor(Math.random() * validParts.length)];
          return { 
            ...c, 
            playableName: selectedPart.toUpperCase(),
            fullName: c.name // Guardamos el nombre completo original
          };
        }
        return null;
      }).filter(c => c !== null);

      const randomTarget = processedChars[Math.floor(Math.random() * processedChars.length)];
      setTargetChar(randomTarget);
      setTargetName(randomTarget.playableName);
    } catch (err) {
      console.error("Error cargando personajes:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- MANEJO DE TECLAS ---
  const handleKeyPress = (key) => {
    if (gameStatus !== "playing" || showTutorial) return;

    if (key === 'ENTER') {
      if (currentGuess.length !== targetName.length) return;
      submitGuess();
    } else if (key === 'DEL') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else {
      if (currentGuess.length < targetName.length) {
        setCurrentGuess(prev => prev + key);
      }
    }
  };

  const submitGuess = () => {
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess("");

    if (currentGuess === targetName) {
      setGameStatus("won");
    } else if (newGuesses.length >= MAX_GUESSES) {
      setGameStatus("lost");
    }
  };

  const getLetterStatus = (guess, index) => {
    const letter = guess[index];
    if (targetName[index] === letter) return 'correct';
    if (targetName.includes(letter)) return 'partial';
    return 'wrong';
  };

  const getKeyStatus = (key) => {
    let status = 'unused';
    guesses.forEach(guess => {
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === key) {
          if (targetName[i] === key) status = 'correct';
          else if (status !== 'correct' && targetName.includes(key)) status = 'partial';
          else if (status === 'unused') status = 'wrong';
        }
      }
    });
    return status;
  };

  // Soporte para teclado físico
  useEffect(() => {
    const handlePhysicalKeyDown = (e) => {
      if (gameStatus !== 'playing' || showTutorial) return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER') handleKeyPress('ENTER');
      else if (key === 'BACKSPACE') handleKeyPress('DEL');
      else if (/^[A-Z]$/.test(key)) handleKeyPress(key);
    };

    window.addEventListener('keydown', handlePhysicalKeyDown);
    return () => window.removeEventListener('keydown', handlePhysicalKeyDown);
  }, [currentGuess, gameStatus, targetName, showTutorial]);

  if (loading || !targetChar) return <div className="loading-parchment">Traduciendo Poneglyphs...</div>;

  const emptyRows = Math.max(0, MAX_GUESSES - guesses.length - (gameStatus === "playing" ? 1 : 0));

  return (
    <div className="wordle-letters-wrapper fade-in-page">
      
      {/* --- CAPA DE PARTÍCULAS --- */}
      <div className="particles-background">
        {particles.map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
      </div>

      {/* --- MODAL DE TUTORIAL --- */}
      {showTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal bounce-in">
            <h2>📜 ¿CÓMO JUGAR RIO NAME?</h2>
            <p>Descifra el nombre del personaje oculto en 6 intentos.</p>
            <ul className="tutorial-list">
              <li>La palabra tiene exactamente <strong>{targetName.length} letras</strong>. Puede ser el nombre o apellido del pirata.</li>
              <li>Escribe tu intento y presiona <strong>ENTER</strong>.</li>
              <li><span style={{color: '#27ae60', fontWeight: 'bold'}}>Verde</span>: La letra está en la posición correcta.</li>
              <li><span style={{color: '#f1c40f', fontWeight: 'bold'}}>Amarillo</span>: La letra existe, pero va en otra posición.</li>
              <li><span style={{color: '#7f8c8d', fontWeight: 'bold'}}>Gris</span>: La letra no pertenece al nombre.</li>
            </ul>
            <button className="btn-pirate" onClick={() => setShowTutorial(false)}>¡DESCIFRAR!</button>
          </div>
        </div>
      )}

      <div className="affinity-header" style={{ position: 'relative', zIndex: 2 }}>
        <button className="btn-icon exit" onClick={() => onNavigate('home')}>✕ SALIR</button>
      </div>

      <div className="wordle-main-box" style={{ position: 'relative', zIndex: 2 }}>
        <h1 className="title-pirate text-center">RIO NAME</h1>
        <p className="subtitle-center">Adivina la palabra de {targetName.length} letras</p>

        <div className="board-grid">
          {guesses.map((guess, rowIdx) => (
            <div key={rowIdx} className="board-row">
              {guess.split('').map((letter, colIdx) => (
                <div 
                  key={colIdx} 
                  className={`board-cell filled flip ${getLetterStatus(guess, colIdx)}`}
                  style={{ animationDelay: `${colIdx * 0.1}s` }}
                >
                  {letter}
                </div>
              ))}
            </div>
          ))}

          {gameStatus === "playing" && (
            <div className="board-row current">
              {Array.from({ length: targetName.length }).map((_, colIdx) => (
                <div key={colIdx} className={`board-cell ${currentGuess[colIdx] ? 'pop-in border-active' : ''}`}>
                  {currentGuess[colIdx] || ''}
                </div>
              ))}
            </div>
          )}

          {Array.from({ length: emptyRows }).map((_, rowIdx) => (
            <div key={`empty-${rowIdx}`} className="board-row">
              {Array.from({ length: targetName.length }).map((_, colIdx) => (
                <div key={colIdx} className="board-cell empty"></div>
              ))}
            </div>
          ))}
        </div>

        {gameStatus !== "playing" && (
          <div className={`result-banner bounce-in ${gameStatus}`}>
            <h2>{gameStatus === 'won' ? '¡LO HAS DESCIFRADO!' : '¡Mala Suerte!'}</h2>
            <div className="result-char-info">
               <img src={`/assets/${targetChar.imageFile}`} alt={targetChar.fullName} onError={(e) => e.target.src='/assets/shadow.jpg'}/>
               <h3>{targetChar.fullName}</h3>
               <p className="target-word-reveal">Palabra oculta: <strong>{targetName}</strong></p>
            </div>
            <button className="btn-pirate" onClick={initGame}>NUEVA PALABRA</button>
          </div>
        )}

        <div className="keyboard-container">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="keyboard-row">
              {row.map(key => {
                const statusClass = getKeyStatus(key);
                return (
                  <button 
                    key={key} 
                    className={`key-btn ${statusClass} ${key === 'ENTER' || key === 'DEL' ? 'key-large' : ''}`}
                    onClick={() => handleKeyPress(key)}
                  >
                    {key === 'DEL' ? '⌫' : key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default NameWordle;