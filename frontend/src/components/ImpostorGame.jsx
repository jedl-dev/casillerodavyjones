import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ImpostorGame.css';

const ImpostorGame = ({ onNavigate }) => {
  const [allCharacters, setAllCharacters] = useState([]);
  const [roundData, setRoundData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing', 'won', 'lost'
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(true);
  const [message, setMessage] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || 'https://gran-line-games-api.vercel.app/api/characters';

  // --- Algoritmo de Barajado (Fisher-Yates) ---
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const res = await axios.get(API_URL);
      const chars = res.data.data || res.data;
      setAllCharacters(chars);
      generateRound(chars);
    } catch (err) {
      console.error("Error al cargar personajes:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- GENERADOR DE CATEGORÍAS DINÁMICAS Y CANTIDAD VARIABLE ---
  const generateRound = (chars) => {
    setGameStatus('playing');
    setSelectedIds([]);
    setMessage("");

    // 1. Definir número de impostores aleatorio (1, 2 o 3)
    const targetImpostors = Math.floor(Math.random() * 3) + 1; 
    const targetTrues = 10 - targetImpostors; 

    // 2. Catálogo expandido de categorías
    const traits = [
      { label: "Usuario de Fruta Logia", filter: c => c.devilFruit?.class === 'Logia' },
      { label: "Usuario de Fruta Paramecia", filter: c => c.devilFruit?.class === 'Paramecia' },
      { label: "Usuario de Fruta Zoan", filter: c => c.devilFruit?.class === 'Zoan' },
      { label: "Posee Haki del Rey", filter: c => c.hakiAbilities?.includes("Haoshoku") },
      { label: "Posee Haki de Armadura", filter: c => c.hakiAbilities?.includes("Busoshoku") },
      { label: "Posee Haki de Observación", filter: c => c.hakiAbilities?.includes("Kenbunshoku") },
      { label: "Miembro de la Marina", filter: c => c.mainFaction === 'Marines' },
      { label: "Piratas de Sombrero de Paja", filter: c => c.crews?.includes("Straw Hat Pirates") },
      { label: "Piratas de Barbablanca", filter: c => c.crews?.includes("Whitebeard Pirates") },
      { label: "Shichibukai (Señor de la Guerra)", filter: c => c.titles?.includes("Warlord of the Sea") || c.roles?.includes("Warlord") },
      { label: "La Peor Generación", filter: c => c.groups?.includes("Worst Generation") || c.roles?.includes("Supernova") },
      { label: "Originario del East Blue", filter: c => c.origin === 'East Blue' },
      { label: "Originario del North Blue", filter: c => c.origin === 'North Blue' },
      { label: "Originario del South Blue", filter: c => c.origin === 'South Blue' },
      { label: "Originario dell West Blue", filter: c => c.origin === 'West Blue' },
      { label: "Originario del Grand Line", filter: c => c.origin === 'Grand Line' },
      { label: "Espadachín", filter: c => c.fightingStyles?.includes("Swordsmanship") || c.roles?.includes("Swordsman") }
    ];

    const shuffledTraits = shuffleArray(traits);
    let selectedTrait = null;
    let trueChars = [];
    let impostorChars = [];
    let actualImpostorCount = targetImpostors;
    let actualTrueCount = targetTrues;

    // 3. Plan A: Buscar una categoría que soporte nuestra cantidad generada
    for (const trait of shuffledTraits) {
      const matches = chars.filter(trait.filter);
      const mismatches = chars.filter(c => !trait.filter(c));

      if (matches.length >= actualTrueCount && mismatches.length >= actualImpostorCount) {
        selectedTrait = trait;
        trueChars = shuffleArray(matches).slice(0, actualTrueCount);
        impostorChars = shuffleArray(mismatches).slice(0, actualImpostorCount);
        break;
      }
    }

    // 4. Plan B (Respaldo Seguro): Si la base de datos no da abasto para el Plan A
    if (!selectedTrait) {
      for (const trait of shuffledTraits) {
         const matches = chars.filter(trait.filter);
         const mismatches = chars.filter(c => !trait.filter(c));
         
         if (mismatches.length >= 1 && matches.length >= (10 - mismatches.length)) {
            selectedTrait = trait;
            actualImpostorCount = Math.min(mismatches.length, 3); 
            actualTrueCount = 10 - actualImpostorCount;
            
            trueChars = shuffleArray(matches).slice(0, actualTrueCount);
            impostorChars = shuffleArray(mismatches).slice(0, actualImpostorCount);
            break;
         }
      }
    }

    if (!selectedTrait) {
      setMessage("Error crítico: Tu base de datos no tiene suficientes personajes para llenar el tablero.");
      return;
    }

    const allRoundChars = shuffleArray([...trueChars, ...impostorChars]);
    
    setRoundData({
      categoryLabel: selectedTrait.label,
      chars: allRoundChars,
      impostorIds: impostorChars.map(c => c._id),
      trueCount: actualTrueCount,
      impostorCount: actualImpostorCount
    });
  };

  // --- MANEJO DE SELECCIÓN (Modificado para no revelar la cantidad real) ---
  const toggleSelection = (id) => {
    if (gameStatus !== 'playing') return;

    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      } else {
        if (prev.length >= 3) { // El máximo posible de impostores es 3
          setMessage(`Solo puedes seleccionar hasta 3 sospechosos.`);
          setTimeout(() => setMessage(""), 2000);
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // --- EVALUACIÓN DEL JUEGO ---
  const submitGuess = () => {
    if (selectedIds.length === 0) {
      setMessage(`Debes seleccionar al menos 1 personaje.`);
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    // Deben haber seleccionado exactamente a los impostores (ni más, ni menos)
    const isCorrect = selectedIds.length === roundData.impostorIds.length && 
                      selectedIds.every(id => roundData.impostorIds.includes(id));

    setGameStatus(isCorrect ? 'won' : 'lost');
  };

  if (loading) return <div className="loading-parchment">Cargando Carteles de Recompensa...</div>;

  return (
    <div className="impostor-game-wrapper fade-in-page">
      
      <div className="particles-background">
        {Array.from({ length: 15 }).map((_, i) => <div key={i} className="particle"></div>)}
      </div>

      {showTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal bounce-in">
            <h2>📜 ¿CÓMO JUGAR IMPOSTOR?</h2>
            <p>Descubre quiénes están mintiendo en su currículum pirata.</p>
            <ul className="tutorial-list">
              <li>Lee la <strong>Categoría Superior</strong>.</li>
              <li>La mayoría de los personajes cumplen con esa categoría, pero <strong>hay entre 1 y 3 IMPOSTORES ocultos</strong>.</li>
              <li>¡El número exacto de impostores es un misterio!</li>
              <li>Selecciona a los sospechosos que creas que <strong>NO</strong> pertenecen a la categoría (máximo 3).</li>
              <li>Cuando estés seguro de tu selección total, presiona <strong>REVELAR</strong>.</li>
            </ul>
            <button className="btn-pirate" onClick={() => setShowTutorial(false)}>¡COMENZAR LA CAZA!</button>
          </div>
        </div>
      )}

      <div className="affinity-header" style={{ position: 'relative', zIndex: 2, width: '100%' }}>
        <button className="btn-icon exit" onClick={() => onNavigate('home')}>✕ SALIR</button>
      </div>

      <div className="impostor-main-content" style={{ position: 'relative', zIndex: 2 }}>
        
        {message && <div className="floating-error-msg pop-in">{message}</div>}

        {/* 1. SECCIÓN SUPERIOR: CATEGORÍA (Modificada para ocultar el número exacto) */}
        <div className="impostor-top-panel">
          <p className="category-subtitle">La categoría es:</p>
          <div className="category-tag">
            <h2>{roundData?.categoryLabel}</h2>
          </div>
          <p className="impostor-instruction">
            Encuentra a los <strong style={{color: '#ff4757'}}>IMPOSTORES </strong>
          </p>
        </div>

        {/* 2. SECCIÓN MEDIA: GRID DE PERSONAJES */}
        <div className="impostor-grid-container">
          {roundData?.chars.map((char, index) => {
            const isSelected = selectedIds.includes(char._id);
            const isActualImpostor = roundData.impostorIds.includes(char._id);
            
            let statusClass = "";
            if (gameStatus !== 'playing') {
              if (isActualImpostor) statusClass = "revealed-impostor"; 
              else if (isSelected && !isActualImpostor) statusClass = "wrong-choice"; 
              else statusClass = "revealed-true"; 
            }

            return (
              <div 
                key={char._id} 
                className={`impostor-card pop-in ${isSelected ? 'selected' : ''} ${statusClass}`}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => toggleSelection(char._id)}
              >
                <div className="card-avatar-wrapper">
                  <img src={`/assets/${char.imageFile}`} alt={char.name} onError={(e) => e.target.src='/assets/shadow.jpg'} />
                </div>
                <div className="card-name-tag">{char.name}</div>
              </div>
            );
          })}
        </div>

        {/* 3. SECCIÓN INFERIOR: BOTONES DE ACCIÓN */}
        <div className="impostor-bottom-panel">
          {gameStatus === 'playing' ? (
            <button 
              className={`btn-impostor-submit ${selectedIds.length > 0 ? 'ready' : ''}`} 
              onClick={submitGuess}
              disabled={selectedIds.length === 0}
            >
              Revelar {selectedIds.length > 0 ? `(${selectedIds.length} selec.)` : ''}
            </button>
          ) : (
            <div className={`result-hub pop-in ${gameStatus}`}>
              <h3 className={gameStatus === 'won' ? 'text-success' : 'text-danger'}>
                {gameStatus === 'won' 
                  ? `¡VICTORIA! Eran exactamente ${roundData?.impostorCount} impostor(es).` 
                  : `¡DERROTA! Había ${roundData?.impostorCount} impostor(es).`}
              </h3>
              <button className="btn-pirate" onClick={() => generateRound(allCharacters)}>NUEVA RONDA</button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default ImpostorGame;