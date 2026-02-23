import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import './CharacterList.css';

const CharacterList = ({ onEdit }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE FILTRADO ---
  const [selectedLetter, setSelectedLetter] = useState('ALL'); // Cambiado el default a TODOS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFaction, setFilterFaction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFruit, setFilterFruit] = useState('');
  const [filterHaki, setFilterHaki] = useState('');
  
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Carga de datos
  const fetchCharacters = async () => {
    try {
      console.log("Intentando conectar con MongoDB...");
      const res = await axios.get('http://localhost:5000/api/characters');
      setCharacters(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error("ERROR DE CONEXIÓN:", err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchCharacters(); }, []);

  // --- EXTRACCIÓN DINÁMICA DE OPCIONES ---
  // Obtenemos las facciones y estados únicos que existen en la base de datos
  const availableFactions = [...new Set(characters.map(c => c.mainFaction).filter(Boolean))];
  const availableStatuses = [...new Set(characters.map(c => c.status).filter(Boolean))];

  // --- MOTOR DE FILTRADO MULTICRITERIO ---
  const filteredCharacters = useMemo(() => {
    if (!characters.length) return [];
    
    return characters.filter(char => {
      // 1. Letra
      const matchLetter = selectedLetter === 'ALL' || char.name.toUpperCase().startsWith(selectedLetter);
      
      // 2. Búsqueda de Texto (Nombre, Epíteto u Origen)
      const term = searchTerm.toLowerCase();
      const matchSearch = !term || 
        char.name.toLowerCase().includes(term) ||
        (char.epithet && char.epithet.toLowerCase().includes(term)) ||
        (char.origin && char.origin.toLowerCase().includes(term));
        
      // 3. Facción
      const matchFaction = !filterFaction || char.mainFaction === filterFaction;
      
      // 4. Estado (Vivo, Fallecido, etc)
      const matchStatus = !filterStatus || char.status === filterStatus;
      
      // 5. Fruta del Diablo
      const matchFruit = !filterFruit || 
        (filterFruit === 'yes' ? char.devilFruit?.hasFruit : !char.devilFruit?.hasFruit);
        
      // 6. Haki
      const matchHaki = !filterHaki || 
        (filterHaki === 'yes' ? char.hakiAbilities?.length > 0 : !char.hakiAbilities?.length > 0);

      // Solo retorna el personaje si cumple con TODOS los filtros activos
      return matchLetter && matchSearch && matchFaction && matchStatus && matchFruit && matchHaki;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [characters, selectedLetter, searchTerm, filterFaction, filterStatus, filterFruit, filterHaki]);

  const handleDelete = async (slug, name) => {
    if (window.confirm(`⚠️ ¿Seguro que quieres eliminar el cartel de "${name}"?`)) {
      try {
        await axios.delete(`http://localhost:5000/api/characters/${slug}`);
        setCharacters(prev => prev.filter(c => c.slug !== slug));
      } catch (err) { alert("Error al eliminar"); }
    }
  };

  if (loading) return <div style={{color: 'white', textAlign: 'center', padding: 50}}><h1>Cargando Den Den Mushi...</h1></div>;

  return (
    <div className="op-gallery-container">
      <h1 className="op-gallery-title">Registros del Nuevo Mundo</h1>
      
      {/* --- PANEL DE FILTROS AVANZADOS --- */}
      <div className="op-filters-panel">
        <input 
          type="text" 
          placeholder="Buscar por nombre, epíteto u origen..." 
          className="op-filter-input search-bar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <div className="op-filters-row">
          <select className="op-filter-select" value={filterFaction} onChange={(e) => setFilterFaction(e.target.value)}>
            <option value="">Todas las Facciones</option>
            {availableFactions.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <select className="op-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Cualquier Estado</option>
            {availableStatuses.map(s => <option key={s} value={s}>{s === 'Alive' ? 'Vivo' : s === 'Deceased' ? 'Fallecido' : s}</option>)}
          </select>

          <select className="op-filter-select" value={filterFruit} onChange={(e) => setFilterFruit(e.target.value)}>
            <option value="">¿Fruta del Diablo?</option>
            <option value="yes">Con Fruta</option>
            <option value="no">Sin Fruta</option>
          </select>

          <select className="op-filter-select" value={filterHaki} onChange={(e) => setFilterHaki(e.target.value)}>
            <option value="">¿Usuario de Haki?</option>
            <option value="yes">Con Haki</option>
            <option value="no">Sin Haki</option>
          </select>

          <button 
            className="op-filter-reset"
            onClick={() => {
              setSearchTerm(''); setFilterFaction(''); setFilterStatus(''); 
              setFilterFruit(''); setFilterHaki(''); setSelectedLetter('ALL');
            }}
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* BARRA ALFABÉTICA */}
      <nav className="op-alphabet-bar">
        <button 
          onClick={() => setSelectedLetter('ALL')} 
          className={`op-letter-link ${selectedLetter === 'ALL' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0 15px', fontSize: '1.2rem' }}
        >
          TODOS
        </button>
        {alphabet.map(l => (
          <button 
            key={l} 
            onClick={() => setSelectedLetter(l)} 
            className={`op-letter-link ${selectedLetter === l ? 'active' : ''}`}
          >
            {l}
          </button>
        ))}
      </nav>

      <p className="op-meta-info">
        Mostrando resultados: <strong>{filteredCharacters.length}</strong> carteles encontrados.
      </p>

      {/* GRILLA */}
      <div className="op-grid-gallery">
        {filteredCharacters.length > 0 ? (
          filteredCharacters.map((char) => (
            <div key={char._id} className={`op-character-card ${char.mainFaction === 'Marines' ? 'marine-style' : ''}`}>
              
              <div className="op-card-img-container">
                <img 
                  src={`/assets/${char.imageFile}`}
                  alt={char.name} 
                  className="op-card-img"
                  onError={(e) => { e.currentTarget.src = '/assets/shadow.jpg'; }}
                />
              </div>

              <div className="op-card-info">
                <h2 className="op-char-name">{char.name}</h2>
                {char.epithet && <p className="op-char-epithet">"{char.epithet}"</p>}

                {char.hasNoBounty ? (
                  <div className="op-bounty-badge" style={{background: '#7f8c8d'}}>SIN RECOMPENSA</div>
                ) : (char.mainFaction === 'Marines' || char.mainFaction === 'Gobierno Mundial') ? (
                  <div className="op-marine-reward">
                    {char.stars > 0 && <span>⭐ {char.stars}</span>}
                    {char.crowns > 0 && <span>👑 {char.crowns}</span>}
                    {(!char.stars && !char.crowns) && <span>⚖️ Oficial</span>}
                  </div>
                ) : (
                  <div className="op-bounty-badge">฿ {Number(char.bounty).toLocaleString()}</div>
                )}

                <div className="op-details-section">
                  <p><strong>Origen:</strong> {char.origin || 'Desconocido'}</p>
                  
                  <div className="op-badge-list">
                    {char.roles?.map(r => <span key={r} className="op-tag role">{r}</span>)}
                    {char.titles?.map(t => <span key={t} className="op-tag title">{t}</span>)}
                    {char.crews?.map(c => <span key={c} className="op-tag crew">{c}</span>)}
                  </div>

                  <div className="op-power-info">
                    {char.devilFruit?.hasFruit && (
                      <p>🌀 <strong>{char.devilFruit.name}</strong> <small>({char.devilFruit.class})</small></p>
                    )}
                    
                    <div className="op-haki-list">
                      {char.hakiAbilities?.map(h => (
                        <span key={h} className="op-tag haki">{h}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="op-status-bar">
                  <span className={`status-dot ${char.status?.toLowerCase() || 'unknown'}`}></span>
                  <span className="status-text">
                    {char.status === 'Alive' ? 'Vivo' : 
                     char.status === 'Deceased' ? 'Fallecido' : 'Desconocido'}
                  </span>
                </div>

                <div className="op-card-actions">
                  <button onClick={() => onEdit(char)} className="btn-action edit">Editar</button>
                  <button onClick={() => handleDelete(char.slug, char.name)} className="btn-action delete">Eliminar</button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="op-empty-state">
            <h3>El Log Pose no encuentra resultados para estos filtros.</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterList;