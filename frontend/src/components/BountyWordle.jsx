import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BountyWordle.css';

const BountyWordle = ({ onNavigate }) => {
  const [characters, setCharacters] = useState([]);
  const [targetChar, setTargetChar] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showTutorial, setShowTutorial] = useState(true);
  const [hints, setHints] = useState([]);
  const [pendingHints, setPendingHints] = useState([]); // Bolsa de pistas mezcladas
  
  const [guesses, setGuesses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing'); 

  const API_URL = 'https://gran-line-games-api.vercel.app/api/characters';

  useEffect(() => {
    const initGame = async () => {
      try {
        const res = await axios.get(API_URL);
        const chars = res.data.data || res.data;
        setCharacters(chars);
        
        const randomTarget = chars[Math.floor(Math.random() * chars.length)];
        setTargetChar(randomTarget);
        
        // --- 1. CREACIÓN DE BOLSAS DE PISTAS (POR FASES) ---
        
        // Fase 1: Pistas Básicas (Aparecerán en los primeros 30 intentos)
        const basicHints = [
          `🗺️ Facción: ${randomTarget.mainFaction || 'Desconocida'}`,
          `📍 Origen: ${randomTarget.origin || 'Desconocido'}`,
          `🌀 Fruta: ${randomTarget.devilFruit?.hasFruit ? randomTarget.devilFruit.class : 'Ninguna'}`,
          `👤 Estado: ${randomTarget.status === 'Alive' ? 'Vivo' : 'Fallecido/Desconocido'}`,
          `⚔️ Rol: ${randomTarget.roles?.length > 0 ? randomTarget.roles.join(', ') : 'Ninguno en especial'}`,
          `⚡ Haki: ${randomTarget.hakiAbilities?.length > 0 ? randomTarget.hakiAbilities.join(', ') : 'No domina Haki'}`
        ];

        // Fase 2: Pistas Finales/Reveladoras (Aparecerán de los 35 a los 50 intentos)
        const finalHints = [
          `🧬 Raza: ${randomTarget.races?.length > 0 ? randomTarget.races.join(', ') : 'Humano (probablemente)'}`,
          `🏴‍☠️ Tripulación: ${randomTarget.crews?.length > 0 ? randomTarget.crews.join(', ') : 'Ninguna/Solitario'}`,
          `👑 Título: ${randomTarget.titles?.length > 0 ? randomTarget.titles.join(', ') : 'Ninguno conocido'}`,
          `🥋 Estilo de Pelea: ${randomTarget.fightingStyles?.length > 0 ? randomTarget.fightingStyles.join(', ') : 'Combate básico'}`
        ];
        
        // Mezclamos cada fase por separado
        const shuffledBasic = basicHints.sort(() => 0.5 - Math.random());
        const shuffledFinal = finalHints.sort(() => 0.5 - Math.random());

        // Unimos las bolsas: Primero las básicas mezcladas, luego las finales mezcladas
        setPendingHints([...shuffledBasic, ...shuffledFinal]);

        setLoading(false);
      } catch (err) {
        console.error("Error al conectar con la base de datos:", err);
      }
    };
    initGame();
  }, []);

  // --- ALGORITMO DE AFINIDAD (-100 a 100) ---
  const calculateAffinity = (guess, target) => {
    if (guess._id === target._id) return 100;
    let score = 0;
    score += guess.mainFaction === target.mainFaction ? 20 : -20;
    score += guess.status === target.status ? 10 : -10;
    score += guess.origin === target.origin ? 15 : -15;

    const gFruit = guess.devilFruit?.hasFruit;
    const tFruit = target.devilFruit?.hasFruit;
    if (!gFruit && !tFruit) score += 25; 
    else if (gFruit !== tFruit) score -= 25; 
    else if (guess.devilFruit?.class === target.devilFruit?.class) score += 15; 
    else score -= 15; 

    const gHaki = guess.hakiAbilities || [];
    const tHaki = target.hakiAbilities || [];
    if (gHaki.length === 0 && tHaki.length === 0) score += 15;
    else if (gHaki.length === 0 || tHaki.length === 0) score -= 15;
    else {
      const intersect = gHaki.filter(h => tHaki.includes(h));
      if (intersect.length === Math.max(gHaki.length, tHaki.length)) score += 15;
      else if (intersect.length > 0) score += 5; 
      else score -= 15;
    }

    const gArr = [...(guess.crews||[]), ...(guess.roles||[]), ...(guess.fightingStyles||[])];
    const tArr = [...(target.crews||[]), ...(target.roles||[]), ...(target.fightingStyles||[])];
    if (gArr.length === 0 && tArr.length === 0) score += 15;
    else if (gArr.length === 0 || tArr.length === 0) score -= 15;
    else {
      const intersectArr = gArr.filter(x => tArr.includes(x));
      if (intersectArr.length > 0) score += 15;
      else score -= 15;
    }

    return Math.max(-100, Math.min(100, score));
  };

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.length > 1) {
      const filtered = characters.filter(c => 
        c.name.toLowerCase().includes(term.toLowerCase()) && 
        !guesses.some(g => g.character._id === c._id) 
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  // --- 2. DESPACHADOR DE PISTAS ---
  const generateHint = (attemptCount) => {
    // Solo soltar pista si es múltiplo de 5
    if (attemptCount % 5 !== 0) return;

    if (pendingHints.length > 0) {
      // Saca la primera pista de la bolsa
      const nextHint = pendingHints[0];
      setHints(prev => [...prev, nextHint]);
      setPendingHints(prev => prev.slice(1)); 
    } else {
      // Pista absoluta final: La letra inicial (Intento 55+)
      const finalHint = `🅰️ Inicial del nombre: "${targetChar.name.charAt(0).toUpperCase()}"`;
      if (!hints.includes(finalHint)) {
        setHints(prev => [...prev, finalHint]);
      }
    }
  };

  const submitGuess = (char) => {
    const score = calculateAffinity(char, targetChar);
    const newGuesses = [{ character: char, score }, ...guesses]; 
    
    setGuesses(newGuesses);
    setSearchTerm('');
    setSuggestions([]);

    if (char._id === targetChar._id) {
      setGameStatus('won');
    } else {
      generateHint(newGuesses.length);
    }
  };

  const surrenderGame = () => {
    if(window.confirm('¿Seguro que quieres izar la bandera blanca?')) {
      setGameStatus('surrendered');
    }
  };

  const getBarColor = (score) => {
    if (score === 100) return '#27ae60'; 
    if (score >= 50) return '#f1c40f'; 
    if (score >= 0) return '#e67e22'; 
    if (score >= -50) return '#e74c3c'; 
    return '#8b0000'; 
  };

  if (loading || !targetChar) return <div className="loading-parchment">Sintonizando Den Den Mushi...</div>;

  return (
    <div className="affinity-game-wrapper">
      
      {showTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal bounce-in">
            <h2>📜 ¿CÓMO JUGAR NAKAMA GUESS?</h2>
            <p>Descubre al personaje oculto analizando tu nivel de afinidad.</p>
            <ul className="tutorial-list">
              <li>Escribe un nombre y el <strong>Medidor</strong> te dirá qué tan parecido es tu intento al objetivo (-100 a 100).</li>
              <li><span style={{color: '#27ae60', fontWeight: 'bold'}}>Verde (+50 a 100)</span>: ¡Vas por muy buen camino!</li>
              <li><span style={{color: '#8b0000', fontWeight: 'bold'}}>Rojo (-100 a 0)</span>: Estás muy lejos. Cambia de estrategia.</li>
              <li>Recibirás una <strong>pista aleatoria cada 5 intentos</strong>. ¡No te rindas!</li>
            </ul>
            <button className="btn-pirate" onClick={() => setShowTutorial(false)}>¡ENTENDIDO!</button>
          </div>
        </div>
      )}

      <div className="affinity-header">
        <button className="btn-icon exit" onClick={() => onNavigate('home')}>✕ SALIR</button>
      </div>

      <div className="affinity-main-box">
        <div className="game-hud">
          <div className="guesses-left">
            <span className="hud-number">{guesses.length}</span>
            <span className="hud-text">INTENTOS</span>
          </div>
          <button className="btn-icon surrender-flag" onClick={surrenderGame} disabled={gameStatus !== 'playing'}>
            🏳️ RENDIRSE
          </button>
        </div>

        {hints.length > 0 && (
          <div className="hints-container pop-in">
            <p className="hints-title">Archivos desencriptados:</p>
            <div className="hints-wrapper">
              {hints.map((hint, idx) => (
                <span key={idx} className="hint-badge">{hint}</span>
              ))}
            </div>
          </div>
        )}

        {gameStatus === 'playing' ? (
          <div className="affinity-search-area">
            <input 
              type="text" 
              placeholder="Introduce un personaje..." 
              value={searchTerm}
              onChange={handleSearch}
              className="affinity-input"
            />
            {suggestions.length > 0 && (
              <ul className="affinity-suggestions pop-in">
                {suggestions.map(s => (
                  <li key={s._id} onClick={() => submitGuess(s)}>
                    <img src={`/assets/${s.imageFile}`} alt="" onError={(e) => e.target.src='/assets/shadow.jpg'}/>
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className={`affinity-result-banner ${gameStatus} bounce-in`}>
            <h2>{gameStatus === 'won' ? '¡OBJETIVO LOCALIZADO!' : 'TE HAS RENDIDO'}</h2>
            <div className="result-char">
              <img src={`/assets/${targetChar.imageFile}`} alt={targetChar.name} onError={(e) => e.target.src='/assets/shadow.jpg'}/>
              <div>
                <h3>{targetChar.name}</h3>
                <p>{targetChar.epithet ? `"${targetChar.epithet}"` : targetChar.mainFaction}</p>
              </div>
            </div>
            
            {gameStatus === 'won' ? (
              <p className="final-score-text">Lo descubriste en <strong>{guesses.length}</strong> intentos.</p>
            ) : (
              <p className="final-score-text">Izaste la bandera blanca tras <strong>{guesses.length}</strong> intentos fallidos.</p>
            )}

            <button className="btn-pirate" onClick={() => window.location.reload()}>NUEVO OBJETIVO</button>
          </div>
        )}

        <div className="affinity-list">
          {guesses.map((g, index) => {
            const fillPercentage = Math.max(5, ((g.score + 100) / 200) * 100);
            const barColor = getBarColor(g.score);

            return (
              <div key={index} className="affinity-row slide-in">
                <div className="char-avatar">
                  <img src={`/assets/${g.character.imageFile}`} alt={g.character.name} onError={(e) => e.target.src='/assets/shadow.jpg'}/>
                </div>
                
                <div className="bar-container">
                  <div className="bar-track">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${fillPercentage}%`, backgroundColor: barColor }}
                    ></div>
                    <div className="bar-content">
                      <span className="score-number">{g.score > 0 ? `+${g.score}` : g.score}</span>
                      <span className="guess-name">{g.character.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BountyWordle;