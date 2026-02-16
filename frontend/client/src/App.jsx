import React, { useState } from 'react';

// Componentes
import Navbar from './components/Navbar';
import GameMenu from './components/GameMenu';
import GridGame from './components/GridGame';
import CharacterList from './components/CharacterList'; // Tu herramienta Admin
import AddCharacter from './components/AddCharacter'; // Tu formulario

function App() {
  // Estados: 'home', 'grid-game', 'admin', 'admin-form'
  const [view, setView] = useState('home');
  const [editingCharacter, setEditingCharacter] = useState(null);

  // --- Lógica del Admin ---
  const handleEdit = (character) => {
    setEditingCharacter(character);
    setView('admin-form');
  };

  const handleAddNew = () => {
    setEditingCharacter(null);
    setView('admin-form');
  };

  const handleSuccess = () => {
    setView('admin');
    setEditingCharacter(null);
  };

  // --- Renderizado Condicional ---
  const renderContent = () => {
    switch (view) {
      case 'home':
        return <GameMenu onNavigate={setView} />;
      
      case 'grid-game':
        return <GridGame />;

      case 'admin':
        return (
          <div style={{paddingTop: '20px'}}>
            {/* Botón flotante o cabecera interna del admin */}
            <div style={{textAlign: 'center', marginBottom: '20px'}}>
              <button 
                onClick={handleAddNew}
                style={{
                  background: '#d91b1b', color: 'white', padding: '10px 20px', 
                  border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: '1.2rem'
                }}
              >
                + NUEVO PERSONAJE
              </button>
            </div>
            <CharacterList onEdit={handleEdit} />
          </div>
        );

      case 'admin-form':
        return (
          <div style={{paddingTop: '20px'}}>
             <button 
                onClick={() => setView('admin')}
                style={{margin: '20px', background:'transparent', color:'white', border:'1px solid white', padding:'5px 10px', cursor:'pointer'}}
             >
               &larr; Volver a la Lista
             </button>
            <AddCharacter editData={editingCharacter} onSuccess={handleSuccess} />
          </div>
        );

      default:
        return <GameMenu onNavigate={setView} />;
    }
  };

  return (
    <div className="app-container">
      {/* 1. NAVBAR SIEMPRE VISIBLE */}
      <Navbar onNavigate={setView} currentView={view.includes('admin') ? 'admin' : 'home'} />

      {/* 2. CONTENIDO DINÁMICO */}
      <main>
        {renderContent()}
      </main>

      <style>{`
        body { margin: 0; background-color: #1a1a1b; min-height: 100vh; }
        .app-container { min-height: 100vh; display: flex; flex-direction: column; }
        main { flex: 1; }
      `}</style>
    </div>
  );
}

export default App;