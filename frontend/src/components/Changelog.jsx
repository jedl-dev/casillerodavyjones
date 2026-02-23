import React from 'react';
import './Changelog.css';

const Changelog = ({ onNavigate }) => {
  const updates = [
    {
      version: "STATUS",
      date: "Estado Actual",
      title: "El Archivo de Ohara",
      changes: [
        { type: 'info', text: 'Base de datos colosal con más de 300 personajes canónicos registrados detalladamente (Frutas, Haki, Facciones).' },
        { type: 'info', text: 'El "Wanted Quiz" cuenta con un banco masivo de más de 1600 preguntas de trivia exclusivas.' },
        { type: 'info', text: '6 minijuegos desafiantes completamente funcionales y responsivos para cualquier dispositivo.' },
        { type: 'info', text: 'Centro de Control (Admin Panel) integrado para gestionar personajes y preguntas en tiempo real.' }
      ]
    },
    {
      version: "v1.4.0",
      date: "Actualización Reciente",
      title: "El Despertar del Cross Guild",
      changes: [
        { type: 'new', text: 'Lanzamiento oficial de BOUNTY CLASH: El duelo definitivo de recompensas.' },
        { type: 'new', text: 'Integración canónica del sistema Cross Guild (Cálculo automático de Estrellas = 100M y Coronas = 1,000M).' },
        { type: 'update', text: 'Sistema de "Memoria a corto plazo" en Bounty Clash para evitar que los personajes se repitan (Efecto Yo-Yo).' },
        { type: 'update', text: 'Interfaz compacta "Frente a Frente" en celulares con estética inmersiva de carteles "DEAD OR ALIVE".' },
        { type: 'fix', text: 'Solucionado el bug de lectura de emojis (⭐ y 👑) en la base de datos de la Marina.' }
      ]
    },
    {
      version: "v1.3.0",
      date: "Mejoras de Navegación",
      title: "Navegación y Pirate Grid",
      changes: [
        { type: 'update', text: 'Rediseño del menú principal: Las tarjetas de juego ahora se adaptan perfectamente a pantallas pequeñas a 1 sola columna.' },
        { type: 'update', text: 'El Navbar principal ahora se oculta automáticamente al entrar a un minijuego para maximizar la inmersión.' },
        { type: 'update', text: 'Añadidos botones globales de "✕ SALIR" flotantes en todos los juegos (Pirate Grid, Bounty Clash).' },
        { type: 'fix', text: 'Solucionado el temblor de pantalla (Scroll Wobble) al hacer hover sobre las tarjetas.' }
      ]
    },
    {
      version: "v1.2.0",
      date: "Expansión de Trivia",
      title: "La Prueba del Haki",
      changes: [
        { type: 'new', text: 'Implementación del "Wanted Quiz" con 4 niveles de dificultad (hasta dificultad Imposible).' },
        { type: 'update', text: 'Rediseño de la barra de progreso estilo "Log Pose" responsiva para móviles.' },
        { type: 'update', text: 'Atmósfera dinámica: El fondo emite partículas de Haki que cambian de color según la dificultad del quiz.' },
        { type: 'new', text: 'Minijuego "Impostor" añadido para poner a prueba la agudeza visual.' }
      ]
    },
    {
      version: "v1.0.0",
      date: "Lanzamiento Inicial",
      title: "Zarpando al Grand Line",
      changes: [
        { type: 'new', text: 'Fundación del "Pirate Archive" con los primeros juegos de deducción: Name Wordle y Bounty Wordle.' },
        { type: 'new', text: 'Diseño base establecido con temática de pergamino viejo, madera y texturas piratas.' },
        { type: 'update', text: 'Buscador predictivo inteligente conectado a la API de personajes.' }
      ]
    }
  ];

  const getBadgeClass = (type) => {
    switch(type) {
      case 'new': return 'badge-new';
      case 'update': return 'badge-update';
      case 'fix': return 'badge-fix';
      case 'info': return 'badge-info';
      default: return '';
    }
  };

  const getBadgeText = (type) => {
    switch(type) {
      case 'new': return 'NUEVO';
      case 'update': return 'MEJORA';
      case 'fix': return 'ARREGLO';
      case 'info': return 'DATO';
      default: return 'INFO';
    }
  };

  return (
    <div className="changelog-wrapper fade-in-page">
      
      {/* ⚓ BOTÓN DE SALIDA FLOTANTE ⚓ */}
      {onNavigate && (
        <button 
          onClick={() => onNavigate('home')}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.8)',
            color: '#f4e4bc',
            border: '2px solid #d91b1b',
            padding: '8px 15px',
            fontFamily: "'Special Elite', cursive",
            fontSize: '0.9rem',
            cursor: 'pointer',
            zIndex: 99,
            transition: '0.3s'
          }}
          onMouseEnter={(e) => { e.target.style.background = '#d91b1b'; e.target.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.target.style.background = 'rgba(0,0,0,0.8)'; e.target.style.color = '#f4e4bc'; }}
        >
          ✕ VOLVER
        </button>
      )}

      <div className="changelog-header">
        <h1 className="title-pirate">Registro de Actualizaciones de Pirate Archive</h1>
      </div>

      <div className="changelog-timeline">
        {updates.map((update, index) => (
          <div className="changelog-card" key={index}>
            <div className="changelog-card-header">
              <div className="version-info">
                <span className="version-number">{update.version}</span>
                <span className="version-date">{update.date}</span>
              </div>
              <h2 className="version-title">{update.title}</h2>
            </div>
            
            <ul className="changelog-list">
              {update.changes.map((change, i) => (
                <li key={i} className="changelog-item">
                  <span className={`changelog-badge ${getBadgeClass(change.type)}`}>
                    {getBadgeText(change.type)}
                  </span>
                  <span className="changelog-text">{change.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Changelog;