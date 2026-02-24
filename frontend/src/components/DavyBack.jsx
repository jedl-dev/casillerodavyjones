import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './DavyBack.css';

// ==========================================
// 1. DICCIONARIO DE PODER
// ==========================================
const POWER_VALUES = {
  "Capitán": 100, "Vicecapitán": 50, "Comandante de División": 80, "Capitan Titanico": 80,
  "Combatiente": 50, "Espadachin": 30, "Francotirador": 30, "Interrogador": 25,
  "Navegante": 15, "Cocinero": 20, "Médico": 15, "Carpintero": 15, "Timonel": 15,
  "Científico": 15, "Arqueólogo / Erudito": 10, "Infiltrado / Espía": 20, "Músico": 10,
  "Rey de los Piratas": 1000, "Almirante de Flota": 1200, "Almirante": 900, "Gorosei": 800, "Yonko": 800,
  "Caballeros Sagrados": 850, "Guerrero del Mar (Shichibukai)": 500, "Vicealmirante": 500,
  "Gigante Ancestral": 1500, "Gigante": 260, "Bucanero": 300, "Lunarian": 300, "Oni": 300, "Gyojin": 90, "Enano (Tontatta)": 80,
  "Zoan Mitológica": 500, "Logia": 200, "Paramecia Especial": 150, "Zoan Prehistorica": 120, "Paramecia": 100, "Zoan": 100,
  "Haki del Conquistador (Avanzado)": 600, "Haki de Armamento (Avanzado)": 300, "Haki de Observación (Avanzado)": 250
};

const DAVY_EVENTS = [
  { id: 'donut_race', name: 'Donut Race', type: 'skill', requiredCrew: 3, criticalRoles: ['Navegante', 'Timonel', 'Gyojin', 'Tritón/Sirena'], nerfTags: ['Usuario de Fruta del Diablo'], nerfMsg: '¡SE HUNDE!' },
  { id: 'treasure_hunt', name: 'Infiltración', type: 'stealth', requiredCrew: 1, criticalRoles: ['Infiltrado / Espía', 'Francotirador', 'Enano (Tontatta)'], nerfTags: ['Gigante', 'Gigante Ancestral', 'Bucanero', 'Oni'], nerfMsg: 'AVISTADO' },
  { id: 'groggy_ring', name: 'Groggy Ring', type: 'combat', requiredCrew: 2, criticalRoles: ['Combatiente', 'Luchador', 'Gigante'], nerfTags: ['Aprendiz', 'Mascota'], nerfMsg: 'DÉBIL' },
  { id: 'cooking_duel', name: 'Duelo de Cocina', type: 'skill', requiredCrew: 1, criticalRoles: ['Cocinero'], nerfTags: ['Espadachin', 'Combatiente'], nerfMsg: 'TORPE' },
  { id: 'medical_crisis', name: 'Virus de Caesar', type: 'skill', requiredCrew: 1, criticalRoles: ['Médico', 'Científico'], nerfTags: ['Mascota', 'Aprendiz'], nerfMsg: 'INFECTADO' },
  { id: 'ancient_puzzle', name: 'El Enigma', type: 'stealth', requiredCrew: 1, criticalRoles: ['Arqueólogo / Erudito', 'Cronista'], nerfTags: ['Combatiente', 'Luchador'], nerfMsg: 'IGNORANTE' },
  { id: 'final_duel', name: 'Duelo Final 1vs1', type: 'combat', requiredCrew: 1, criticalRoles: ['Capitán', 'Yonko', 'Rey de los Piratas'], nerfTags: ['Aprendiz'], nerfMsg: 'SIN AUTORIDAD' }
];

// ==========================================
// EL FACTOR GRAND LINE (SORPRESAS ALEATORIAS)
// ==========================================
const GRAND_LINE_FACTORS = [
  { name: "CLIMA PERFECTO", desc: "No hubo interferencias. Prevalece la táctica pura.", pMult: 1.0, eMult: 1.0, color: "#8b949e" },
  { name: "CLIMA PERFECTO", desc: "No hubo interferencias. Prevalece la táctica pura.", pMult: 1.0, eMult: 1.0, color: "#8b949e" }, 
  { name: "RAYO NORO NORO", desc: "¡Foxy hizo trampa! Tu equipo se vuelve extremadamente lento.", pMult: 0.5, eMult: 1.0, color: "#f85149" },
  { name: "SABOTAJE RIVAL", desc: "El enemigo saboteó tus herramientas antes de empezar.", pMult: 0.7, eMult: 1.1, color: "#f85149" },
  { name: "KNOCK UP STREAM", desc: "Una corriente brutal afecta a ambos bandos por igual.", pMult: 0.6, eMult: 0.6, color: "#f2cc60" },
  { name: "VOLUNTAD HEREDADA", desc: "¡Tus nakamas superan sus propios límites por el Capitán!", pMult: 1.5, eMult: 1.0, color: "#4db6ac" },
  { name: "MILAGRO DE D.", desc: "Golpe de suerte masivo que altera la realidad.", pMult: 2.0, eMult: 0.8, color: "#f2cc60" },
  { name: "ARROGANCIA ENEMIGA", desc: "El rival se confió y cometió un error garrafal.", pMult: 1.0, eMult: 0.5, color: "#4db6ac" }
];

const DavyBack = ({ onNavigate }) => {
  const [allCharacters, setAllCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [gameState, setGameState] = useState('TUTORIAL'); 
  const [playerCrew, setPlayerCrew] = useState([]);
  const [masterEnemyCrew, setMasterEnemyCrew] = useState([]); 
  const [round, setRound] = useState(0);
  const [gameEvents, setGameEvents] = useState([]); 
  const [currentEvent, setCurrentEvent] = useState(null);
  
  // Faltaban estas declaraciones que causaban errores
  const [initialDraftPool, setInitialDraftPool] = useState([]);
  const [selectedFighters, setSelectedFighters] = useState([]);
  const [enemyParticipants, setEnemyParticipants] = useState([]);
  
  const [clashData, setClashData] = useState(null);
  const [lostCharacter, setLostCharacter] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/characters')
      .then(res => { setAllCharacters(res.data.data); setLoading(false); })
      .catch(err => console.error(err));
  }, []);

  const calculatePower = (char, event, opposingTeam = []) => {
    if (!char || !event) return { power: 0, isSynergized: false, msg: '' };
    
    const tags = [...(char.roles||[]), ...(char.titles||[]), ...(char.races||[]), ...(char.hakiAbilities||[]), char.devilFruit?.class].filter(Boolean);
    const isSynergized = event.criticalRoles.some(r => tags.includes(r));
    const isNerfed = event.nerfTags.some(t => tags.includes(t)) || (event.id === 'donut_race' && char.devilFruit?.hasFruit);

    let combatPower = 10;
    tags.forEach(t => { if(POWER_VALUES[t]) combatPower += POWER_VALUES[t]; });

    if (isNerfed) return { power: 5, isSynergized: false, msg: event.nerfMsg };

    let score = 0;
    if (event.type === 'combat') {
      const enemyHasLogia = opposingTeam.some(c => c?.devilFruit?.class === 'Logia');
      if (enemyHasLogia && !tags.some(t => t.includes('Armamento')) && char.devilFruit?.class !== 'Logia') {
        return { power: Math.floor(combatPower * 0.1), isSynergized: false, msg: 'INTOCABLE' };
      }
      score = isSynergized ? Math.floor(combatPower * 1.5) : combatPower;
    } else {
      if (isSynergized) score = 500 + Math.floor(combatPower * 0.2); 
      else score = 20 + Math.floor(combatPower * 0.1); 
    }

    return { 
      power: Math.max(1, score), 
      isSynergized, 
      msg: !isSynergized && event.type !== 'combat' ? 'INEXPERTO' : '' 
    };
  };

  const startTournament = () => {
    const normal = DAVY_EVENTS.filter(e => e.id !== 'final_duel').sort(() => 0.5 - Math.random());
    const fullEvents = [...normal, DAVY_EVENTS.find(e => e.id === 'final_duel')];
    setGameEvents(fullEvents);

    let tempAll = [...allCharacters].sort(() => 0.5 - Math.random());
    const rolesNeeded = [...new Set(fullEvents.flatMap(e => e.criticalRoles))];
    
    const extractPool = (count) => {
      let pool = [];
      rolesNeeded.forEach(role => {
        const idx = tempAll.findIndex(c => (c.roles || []).includes(role) || (c.races || []).includes(role));
        if (idx !== -1 && pool.length < count) {
          pool.push(tempAll[idx]);
          tempAll.splice(idx, 1);
        }
      });
      while (pool.length < count && tempAll.length > 0) pool.push(tempAll.shift());
      return pool;
    };

    const initialEnemyCrew = extractPool(10);
    const initialPlayerCrew = extractPool(10);

    setMasterEnemyCrew(initialEnemyCrew);
    setPlayerCrew(initialPlayerCrew);
    setRound(0);
    setupRound(0, initialPlayerCrew, initialEnemyCrew, fullEvents);
  };

  const setupRound = (idx, pCrew, eCrew, eventsList = gameEvents) => {
    if (idx >= eventsList.length) return setGameState('VICTORY_SCREEN');
    const ev = eventsList[idx];
    if (pCrew.length < ev.requiredCrew) return setGameState('GAMEOVER');

    setCurrentEvent(ev);
    setSelectedFighters([]);
    const smartEnemy = [...eCrew].sort((a, b) => calculatePower(b, ev, []).power - calculatePower(a, ev, []).power);
    setEnemyParticipants(smartEnemy.slice(0, ev.requiredCrew));
    setGameState('PLAYING');
  };

  const toggleSelection = (char, max) => {
    if (selectedFighters.find(c => c._id === char._id)) setSelectedFighters(selectedFighters.filter(c => c._id !== char._id));
    else if (selectedFighters.length < max) setSelectedFighters([...selectedFighters, char]);
  };

  const playerBaseScore = useMemo(() => {
    if (!currentEvent || selectedFighters.length === 0) return 0;
    return selectedFighters.reduce((sum, c) => sum + calculatePower(c, currentEvent, enemyParticipants).power, 0);
  }, [selectedFighters, enemyParticipants, currentEvent]);

  const enemyBaseScore = useMemo(() => {
    if (!currentEvent || enemyParticipants.length === 0) return 0;
    return enemyParticipants.reduce((sum, c) => sum + calculatePower(c, currentEvent, selectedFighters).power, 0);
  }, [selectedFighters, enemyParticipants, currentEvent]);

  // ==========================================
  // RESOLUCIÓN INMERSIVA (CLASH)
  // ==========================================
  const resolveBattle = () => {
    const randomFactor = GRAND_LINE_FACTORS[Math.floor(Math.random() * GRAND_LINE_FACTORS.length)];
    
    const pFinal = Math.floor(playerBaseScore * randomFactor.pMult);
    const eFinal = Math.floor(enemyBaseScore * randomFactor.eMult);
    const isWin = pFinal >= eFinal;

    setClashData({
      pBase: playerBaseScore,
      eBase: enemyBaseScore,
      factor: randomFactor,
      pFinal,
      eFinal,
      isWin
    });

    setGameState('CLASH');
  };

  const executeClashOutcome = () => {
    // FIX: El estado correcto de victoria es DRAFTING, no STEAL.
    if (clashData.isWin) {
      setGameState('DRAFTING');
    } else {
      const stolen = playerCrew[Math.floor(Math.random() * playerCrew.length)];
      setLostCharacter(stolen);
      setGameState('PENALTY');
    }
  };

  const handleWinSteal = (char) => {
    const nE = masterEnemyCrew.filter(x => x._id !== char._id);
    const nP = [...playerCrew, char];
    setMasterEnemyCrew(nE); setPlayerCrew(nP);
    const nextIdx = round + 1; setRound(nextIdx); 
    setupRound(nextIdx, nP, nE);
  };

  const handleLossPenalty = () => {
    const nP = playerCrew.filter(x => x._id !== lostCharacter._id);
    const nE = [...masterEnemyCrew, lostCharacter];
    setPlayerCrew(nP); setMasterEnemyCrew(nE);
    setLostCharacter(null);
    const nextIdx = round + 1; setRound(nextIdx); 
    setupRound(nextIdx, nP, nE);
  };

  const CompactCard = ({ char, onClick, isSelected, isEnemy, hideBadges }) => {
    const { power, isSynergized, msg } = calculatePower(char, currentEvent, isEnemy ? selectedFighters : enemyParticipants);
    const isNerfed = msg !== '' && msg !== 'INEXPERTO';

    return (
      <div className={`dbk-card ${isSelected ? (isEnemy ? 'dbk-selected-enemy' : 'dbk-selected-ally') : ''}`} onClick={onClick}>
        <div className="dbk-card-img-wrapper">
          <img src={`/assets/${char.imageFile}`} alt={char.name} style={{ filter: isNerfed ? 'grayscale(1) brightness(0.5)' : 'none' }} />
          {!hideBadges && (
            <>
              <div className="dbk-card-pwr" style={{color: isNerfed ? '#f85149' : '#fff'}}>{power}</div>
              {msg && <div className="dbk-badge-penalty">{msg}</div>}
              {isSynergized && !msg && <div className="dbk-badge-expert">EXPERTO</div>}
            </>
          )}
        </div>
        <div className="dbk-card-info">
          <span className="dbk-name">{char.name}</span>
          <span className="dbk-role">{char.roles?.[0] || 'S/N'}</span>
        </div>
      </div>
    );
  };

  if (loading) return <div className="dbk-loading">Cargando Grand Line...</div>;

  return (
    <div className="dbk-app-wrapper">
      <header className="dbk-top-nav">
        <h1>DAVY BACK: PUZLE TÁCTICO</h1>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {['PLAYING', 'CLASH'].includes(gameState) && <span style={{ color: '#f2cc60', fontWeight: 'bold', fontSize: '1.2rem' }}>RONDA {round + 1} / {gameEvents.length}</span>}
          <button className="dbk-btn-text" onClick={() => onNavigate('home')}>✕ ABANDONAR</button>
        </div>
      </header>

      {gameState === 'TUTORIAL' && (
        <div className="dbk-center-panel">
          <h2>TÁCTICA Y DESTINO (10 vs 10)</h2>
          <div className="dbk-text-block">
            <p><strong>1. El Poder Base:</strong> Arma tu equipo guiándote por los expertos. Superar la puntuación base del enemigo es crucial.</p>
            <p><strong>2. El Factor Grand Line:</strong> Al resolver, el destino intervendrá. Foxy puede hacer trampa, el clima puede cambiar, o puede ocurrir un milagro.</p>
            <p><strong>3. Riesgo y Recompensa:</strong> Armar un equipo con ventaja masiva te asegura ganar incluso con mala suerte. Una pelea reñida dependerá de los dados.</p>
          </div>
          <button className="dbk-btn-primary" onClick={startTournament}>ZARPAR A LA ARENA</button>
        </div>
      )}

      {gameState === 'PLAYING' && currentEvent && (
        <div className="dbk-horizontal-board">
          <div className="dbk-zone player-zone">
            <h3 className="dbk-zone-title">TU FLOTA ({playerCrew.length})</h3>
            <div className="dbk-card-wrap">
              {playerCrew.filter(c => !selectedFighters.find(p => p._id === c._id)).map(char => (
                <CompactCard key={char._id} char={char} onClick={() => toggleSelection(char, currentEvent.requiredCrew)} />
              ))}
            </div>
          </div>

          <div className="dbk-arena-core">
            <div className="dbk-event-hub" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <h2 style={{fontSize: '2.5rem', margin: 0}}>{currentEvent.name}</h2>
              <p style={{color: '#8b949e', margin: '10px 0'}}>{currentEvent.desc}</p>
              <div className="dbk-critical-req">Expertos Recomendados: {currentEvent.criticalRoles.join(' / ')}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center', width: '40%' }}>
                <h3 style={{ color: '#4db6ac', fontSize: '2.5rem', margin: '0 0 15px 0' }}>{playerBaseScore}</h3>
                <div className="dbk-card-wrap" style={{ justifyContent: 'center' }}>
                  {selectedFighters.map(char => <CompactCard key={char._id} char={char} onClick={() => toggleSelection(char, currentEvent.requiredCrew)} isSelected />)}
                  {Array.from({ length: currentEvent.requiredCrew - selectedFighters.length }).map((_, i) => <div key={i} className="dbk-empty-slot">Vacío</div>)}
                </div>
              </div>

              <div style={{ fontSize: '3rem', color: '#30363d', fontWeight: 'bold' }}>VS</div>

              <div style={{ textAlign: 'center', width: '40%' }}>
                <h3 style={{ color: '#f85149', fontSize: '2.5rem', margin: '0 0 15px 0' }}>{enemyBaseScore}</h3>
                <div className="dbk-card-wrap" style={{ justifyContent: 'center' }}>
                  {enemyParticipants.map(char => <CompactCard key={char._id} char={char} isEnemy />)}
                </div>
              </div>
            </div>

            <button 
              className="dbk-btn-primary" 
              disabled={selectedFighters.length !== currentEvent.requiredCrew} 
              onClick={resolveBattle}
              style={{ alignSelf: 'center', padding: '15px 60px', marginTop: '20px' }}
            >
              {selectedFighters.length !== currentEvent.requiredCrew ? `FALTAN ${currentEvent.requiredCrew - selectedFighters.length} PIRATAS` : "RESOLVER CHOQUE"}
            </button>
          </div>

          <div className="dbk-zone enemy-zone">
            <h3 className="dbk-zone-title">FLOTA RIVAL ({masterEnemyCrew.length})</h3>
            <div className="dbk-card-wrap">
              {masterEnemyCrew.filter(c => !enemyParticipants.find(p => p._id === c._id)).map(char => <CompactCard key={char._id} char={char} isEnemy hideBadges />)}
            </div>
          </div>
        </div>
      )}

      {/* --- PANTALLA ÉPICA DE CHOQUE --- */}
      {gameState === 'CLASH' && clashData && (
        <div className="dbk-center-panel" style={{ maxWidth: '850px', border: `2px solid ${clashData.factor.color}`, boxShadow: `0 0 40px ${clashData.factor.color}40` }}>
          <h2 style={{ fontSize: '1.2rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '4px' }}>El Destino Decide</h2>
          
          <div className="clash-factor-box reveal-1" style={{ border: `1px solid ${clashData.factor.color}` }}>
            <h1 style={{ color: clashData.factor.color, margin: '0 0 10px 0', fontSize: '2.8rem', textShadow: `0 0 15px ${clashData.factor.color}` }}>{clashData.factor.name}</h1>
            <p style={{ fontSize: '1.2rem', margin: 0, color: '#c9d1d9' }}>{clashData.factor.desc}</p>
          </div>

          <div className="reveal-2" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '40px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8b949e', fontSize: '1.2rem' }}>Poder Base: {clashData.pBase}</div>
              <div style={{ color: '#4db6ac', fontSize: '1.2rem', margin: '5px 0' }}>Multiplicador: x{clashData.factor.pMult}</div>
              <div style={{ fontSize: '4rem', color: '#4db6ac', fontWeight: '900', textShadow: '0 0 20px #4db6ac' }}>{clashData.pFinal}</div>
            </div>
            
            <div style={{ fontSize: '2.5rem', color: '#8b949e', fontWeight: 'bold' }}>VS</div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#8b949e', fontSize: '1.2rem' }}>Poder Base: {clashData.eBase}</div>
              <div style={{ color: '#f85149', fontSize: '1.2rem', margin: '5px 0' }}>Multiplicador: x{clashData.factor.eMult}</div>
              <div style={{ fontSize: '4rem', color: '#f85149', fontWeight: '900', textShadow: '0 0 20px #f85149' }}>{clashData.eFinal}</div>
            </div>
          </div>

          <div className="reveal-3">
            <h2 style={{ color: clashData.isWin ? '#3fb950' : '#f85149', fontSize: '2.5rem', margin: '0 0 30px 0', letterSpacing: '2px' }}>
              {clashData.isWin ? "¡PRUEBA SUPERADA!" : "¡TU EQUIPO FUE APLASTADO!"}
            </h2>
          </div>

          <div className="reveal-4">
            <button className="dbk-btn-primary" onClick={executeClashOutcome}>
              {clashData.isWin ? "RECLAMAR BOTÍN" : "SUFRIR LAS CONSECUENCIAS"}
            </button>
          </div>
        </div>
      )}

      {gameState === 'DRAFTING' && (
        <div className="dbk-center-panel success-panel">
          <h2 style={{ color: '#3fb950', fontSize: '2.5rem' }}>¡VICTORIA!</h2>
          <p style={{fontSize: '1.2rem'}}>Superaste al enemigo. Elige a quién robar de su barco:</p>
          <div className="dbk-card-grid" style={{marginTop: '20px'}}>
            {masterEnemyCrew.map(char => (
              <div key={char._id} onClick={() => handleWinSteal(char)}>
                <CompactCard char={char} isSelected hideBadges />
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState === 'PENALTY' && lostCharacter && (
        <div className="dbk-center-panel danger-panel">
          <h2 style={{ color: '#f85149', fontSize: '2.5rem' }}>¡DERROTA!</h2>
          <p style={{fontSize: '1.2rem'}}>Foxy se lleva a <strong>{lostCharacter.name}</strong> a su tripulación.</p>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0' }}><CompactCard char={lostCharacter} hideBadges /></div>
          <button className="dbk-btn-primary" onClick={handleLossPenalty}>CONTINUAR</button>
        </div>
      )}

      {gameState === 'VICTORY_SCREEN' && (
        <div className="dbk-center-panel success-panel" style={{ maxWidth: '1000px' }}>
          <h1 style={{ color: '#f2cc60', fontSize: '3.5rem', textShadow: '0 0 20px #f2cc60' }}>¡HAS VENCIDO A FOXY!</h1>
          <p style={{ fontSize: '1.5rem', color: '#c9d1d9' }}>Sobreviviste al Grand Line y humillaste a los Piratas de Foxy.</p>
          <h2 style={{ color: '#4db6ac', margin: '20px 0' }}>Poder Final de tu Flota: {playerCrew.reduce((acc, c) => acc + calculatePower(c, DAVY_EVENTS[0]).power, 0)}</h2>
          <div className="dbk-card-grid" style={{ margin: '40px 0' }}>
            {playerCrew.map(c => <CompactCard key={c._id} char={c} hideBadges />)}
          </div>
          <button className="dbk-btn-primary" onClick={() => window.location.reload()}>JUGAR NUEVO TORNEO</button>
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div className="dbk-center-panel danger-panel">
          <h2 style={{ fontSize: '3.5rem', color: '#f85149', textShadow: '0 0 20px #f85149' }}>DESCALIFICADO</h2>
          <p style={{fontSize: '1.5rem'}}>Te quedaste sin piratas suficientes para la siguiente prueba. Has perdido tu bandera y tu orgullo.</p>
          <button className="dbk-btn-primary" style={{marginTop: '30px'}} onClick={() => window.location.reload()}>REINTENTAR</button>
        </div>
      )}
    </div>
  );
};

export default DavyBack;