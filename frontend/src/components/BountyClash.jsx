import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BountyClash.css';

const BountyClash = ({ onNavigate }) => {
  const [characterPool, setCharacterPool] = useState([]);
  const [leftChar, setLeftChar] = useState(null);
  const [rightChar, setRightChar] = useState(null);
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [recentIds, setRecentIds] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState('playing'); 
  const [showTutorial, setShowTutorial] = useState(true);
  const [feedbackClass, setFeedbackClass] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'https://gran-line-games-api.vercel.app/api/characters';

  const formatBounty = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  useEffect(() => {
    fetchAndFilterCharacters();
  }, []);

  const fetchAndFilterCharacters = async () => {
    try {
      const res = await axios.get(API_URL);
      const chars = res.data.data || res.data;

      const validChars = chars
        .map(c => {
          // AQUI ESTÁ LA MAGIA QUE LEE TU MODELO REAL:
          let calculatedValue = 0;
          if (c.crowns > 0) {
            calculatedValue = c.crowns * 1000000000;
          } else if (c.stars > 0) {
            calculatedValue = c.stars * 100000000;
          } else {
            calculatedValue = c.bounty || 0;
          }

          return { 
            ...c, 
            parsedBounty: calculatedValue
          };
        })
        // Filtramos a los que tienen un valor válido y que NO tengan el booleano hasNoBounty activado
        .filter(c => c.parsedBounty > 0 && c.hasNoBounty !== true);

      setCharacterPool(validChars);
      
      if (validChars.length >= 2) {
        initRound(validChars, 0);
      }
    } catch (err) {
      console.error("Error cargando personajes:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRandomChar = (pool, excludeList = []) => {
    let available = pool.filter(c => !excludeList.includes(c._id));
    if (available.length === 0) available = pool;
    return available[Math.floor(Math.random() * available.length)];
  };

  const initRound = (pool, currentScore) => {
    const char1 = getRandomChar(pool, []);
    const char2 = getRandomChar(pool, [char1._id]);
    
    setLeftChar(char1);
    setRightChar(char2);
    setRecentIds([char1._id, char2._id]);
    setScore(currentScore);
    setGameStatus('playing');
    setFeedbackClass('');
  };

  const nextRound = () => {
    const newRightChar = getRandomChar(characterPool, recentIds);
    setRecentIds(prev => {
      const newRecent = [...prev, newRightChar._id];
      const maxHistory = Math.min(8, Math.floor(characterPool.length / 2));
      if (newRecent.length > maxHistory) return newRecent.slice(newRecent.length - maxHistory);
      return newRecent;
    });

    setLeftChar(rightChar);
    setRightChar(newRightChar);
    setGameStatus('playing');
    setFeedbackClass('');
  };

  const handleGuess = (guessType) => {
    if (gameStatus !== 'playing') return;
    setGameStatus('revealing');

    const leftBounty = leftChar.parsedBounty;
    const rightBounty = rightChar.parsedBounty;

    let isCorrect = false;
    if (leftBounty === rightBounty) isCorrect = true; 
    else if (guessType === 'higher' && rightBounty > leftBounty) isCorrect = true;
    else if (guessType === 'lower' && rightBounty < leftBounty) isCorrect = true;

    if (isCorrect) {
      setFeedbackClass('correct-guess');
      const newScore = score + 1;
      setScore(newScore);
      if (newScore > highScore) setHighScore(newScore);
      setTimeout(() => nextRound(), 1800);
    } else {
      setFeedbackClass('wrong-guess');
      setTimeout(() => setGameStatus('lost'), 1800);
    }
  };

  // --- RENDERIZADO VISUAL CON ICONOS BASADO EN TU MODELO ---
  const renderBountyDisplay = (char, extraClass = '') => {
    if (!char) return null;

    if (char.crowns > 0) {
        const iconString = Array(char.crowns).fill('🜲').join(' ');
        return <h2 className={`clash-bounty cross-guild-icons ${extraClass}`}>{iconString}</h2>;
    }

    if (char.stars > 0) {
        const iconString = Array(char.stars).fill('★').join(' ');
        return <h2 className={`clash-bounty cross-guild-icons ${extraClass}`}>{iconString}</h2>;
    }

    return <h2 className={`clash-bounty ${extraClass}`}>฿ {formatBounty(char.bounty)}</h2>;
  };


  if (loading || !leftChar || !rightChar) return <div className="loading-parchment">Cargando Carteles...</div>;

  return (
    <div className="bounty-clash-wrapper fade-in-page">
      <div className="particles-background">
        {Array.from({ length: 15 }).map((_, i) => <div key={i} className="particle"></div>)}
      </div>

      {showTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal bounce-in">
            <h2>📜 BOUNTY CLASH</h2>
            <p>El juego definitivo de recompensas del Grand Line.</p>
            <ul className="tutorial-list">
              <li>Observa la recompensa del personaje a la <strong>izquierda</strong>.</li>
              <li>Adivina si el de la <strong>derecha</strong> vale <strong>MÁS</strong> o <strong>MENOS</strong>.</li>
              <li>¡Atento al Cross Guild! Las Estrellas (★) y Coronas (🜲) de la Marina también juegan.</li>
              <li>Un solo error y estás fuera.</li>
            </ul>
            <button className="btn-pirate" onClick={() => setShowTutorial(false)}>¡AL ABORDAJE!</button>
          </div>
        </div>
      )}

      <div className="clash-header">
        <button className="btn-icon exit" onClick={() => onNavigate('home')}>✕ SALIR</button>
        <div className="score-board">
          <div className="score-box">RACHA: <span>{score}</span></div>
          <div className="score-box high-score">RÉCORD: <span>{highScore}</span></div>
        </div>
      </div>

      <div className="clash-arena">
        
        {/* IZQUIERDA */}
        <div className="clash-side left-side" key={`left-${leftChar._id}`}>
          <div className="clash-card">
            <div className="clash-image-container">
              <img src={`/assets/${leftChar.imageFile}`} alt={leftChar.name} onError={(e) => e.target.src='/assets/shadow.jpg'} />
              <div className="clash-name-tag">{leftChar.name}</div>
            </div>
            <div className="clash-data-box">
              <p className="wanted-subtext">DEAD OR ALIVE</p>
              <p className="clash-label">RECOMPENSA</p>
              {renderBountyDisplay(leftChar)}
            </div>
          </div>
        </div>

        {/* CENTRO */}
        <div className="clash-center-divider">
          {gameStatus === 'lost' ? (
             <div className="result-hub fade-in">
               <h3 className="text-danger">¡CAZADO!</h3>
               <p>Racha final: {score}</p>
               <button className="btn-elegant" onClick={() => initRound(characterPool, 0)}>REINTENTAR</button>
             </div>
          ) : (
             <div className={`vs-badge ${feedbackClass}`}>
                {feedbackClass === 'correct-guess' ? '✓' : feedbackClass === 'wrong-guess' ? '✕' : 'VS'}
             </div>
          )}
        </div>

        {/* DERECHA */}
        <div className={`clash-side right-side ${feedbackClass}`} key={`right-${rightChar._id}`}>
          <div className="clash-card">
            <div className="clash-image-container">
              <img src={`/assets/${rightChar.imageFile}`} alt={rightChar.name} onError={(e) => e.target.src='/assets/shadow.jpg'} />
              <div className="clash-name-tag">{rightChar.name}</div>
            </div>
            
            <div className="clash-data-box">
              {gameStatus === 'playing' ? (
                <div className="clash-action-buttons fade-in">
                  <button className="btn-clash higher" onClick={() => handleGuess('higher')}>
                    <span className="arrow">▲</span> MAYOR
                  </button>
                  <button className="btn-clash lower" onClick={() => handleGuess('lower')}>
                    <span className="arrow">▼</span> MENOR
                  </button>
                </div>
              ) : (
                <div className="clash-revealed-container fade-in">
                  <p className="wanted-subtext">DEAD OR ALIVE</p>
                  <p className="clash-label">RECOMPENSA</p>
                  {renderBountyDisplay(rightChar, feedbackClass)}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BountyClash;