import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import './CharacterList.css';

const CharacterList = ({ onEdit }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para la letra seleccionada
  const [selectedLetter, setSelectedLetter] = useState('A'); 
  
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

  // Filtrado
  const filteredCharacters = useMemo(() => {
    if (!characters.length) return [];
    return characters
      .filter(char => char.name.toUpperCase().startsWith(selectedLetter))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [characters, selectedLetter]);

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
      
      {/* BARRA ALFABÉTICA */}
      <nav className="op-alphabet-bar">
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

      <p className="op-meta-info" style={{textAlign: 'center', color: '#f4e4bc'}}>
        Mostrando letra: <strong>{selectedLetter}</strong> ({filteredCharacters.length})
      </p>

      {/* GRILLA */}
      <div className="op-grid-gallery">
        {filteredCharacters.length > 0 ? (
          filteredCharacters.map((char) => (
            <div key={char._id} className={`op-character-card ${char.mainFaction === 'Marines' ? 'marine-style' : ''}`}>
              
              {/* IMAGEN */}
              <div className="op-card-img-container">
                <img 
                  src={`/assets/${char.imageFile}`}
                  alt={char.name} 
                  className="op-card-img"
                  onError={(e) => { e.currentTarget.src = '/assets/shadow.jpg'; }}
                />
              </div>

              {/* INFORMACIÓN COMPLETA */}
              <div className="op-card-info">
                <h2 className="op-char-name">{char.name}</h2>
                
                {/* 1. Epíteto */}
                {char.epithet && <p className="op-char-epithet">"{char.epithet}"</p>}

                {/* 2. Recompensas / Rangos (Lógica condicional) */}
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

                {/* 3. Detalles Técnicos (Origen, Roles, Poderes) */}
                <div className="op-details-section">
                  <p><strong>Origen:</strong> {char.origin || 'Desconocido'}</p>
                  
                  {/* Badges de Roles y Títulos */}
                  <div className="op-badge-list">
                    {char.roles?.map(r => <span key={r} className="op-tag role">{r}</span>)}
                    {char.titles?.map(t => <span key={t} className="op-tag title">{t}</span>)}
                    {char.crews?.map(c => <span key={c} className="op-tag crew">{c}</span>)}
                  </div>

                  {/* Poderes y Haki */}
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

                {/* 4. Estado de Vida */}
                <div className="op-status-bar">
                  <span className={`status-dot ${char.status?.toLowerCase() || 'unknown'}`}></span>
                  <span className="status-text">
                    {char.status === 'Alive' ? 'Vivo' : 
                     char.status === 'Deceased' ? 'Fallecido' : 'Desconocido'}
                  </span>
                </div>

                {/* 5. Botones de Acción */}
                <div className="op-card-actions">
                  <button onClick={() => onEdit(char)} className="btn-action edit">Editar</button>
                  <button onClick={() => handleDelete(char.slug, char.name)} className="btn-action delete">Eliminar</button>
                </div>

              </div>
            </div>
          ))
        ) : (
          <div className="op-empty-state">
            <h3>No hay registros con la "{selectedLetter}"</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterList;