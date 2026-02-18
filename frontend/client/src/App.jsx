import React, { useState } from 'react';

// Componentes
import Navbar from './components/Navbar';
import GameMenu from './components/GameMenu';
import GridGame from './components/GridGame';
import WantedQuiz from './components/WantedQuiz';
import QuizAdmin from './components/QuizAdmin'; // 1. IMPORTAR EL COMPONENTE ADMINISTRADOR
import CharacterList from './components/CharacterList'; 
import AddCharacter from './components/AddCharacter'; 

function App() {
  // Estados: 'home', 'grid-game', 'wanted-quiz', 'admin', 'quiz-admin', 'admin-form'
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
        return <GridGame onNavigate={setView} />;

      case 'wanted-quiz':
        return <WantedQuiz onNavigate={setView} />;

      case 'quiz-admin': // 2. CASO PARA EL CRUD DE PREGUNTAS
        return <QuizAdmin onNavigate={() => setView('admin')} />;

      case 'admin':
        return (
          <div style={{paddingTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <h1 style={{color: '#f1c40f', fontFamily: 'monospace'}}>CENTRO DE CONTROL</h1>
            
            <div style={{display: 'flex', gap: '20px', marginBottom: '40px'}}>
              <button 
                onClick={handleAddNew}
                style={{
                  background: '#d91b1b', color: 'white', padding: '12px 24px', 
                  border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold'
                }}
              >
                + NUEVO PERSONAJE
              </button>

              <button 
                onClick={() => setView('quiz-admin')} // Botón para ir al CRUD de preguntas
                style={{
                  background: '#f1c40f', color: '#1a1a1b', padding: '12px 24px', 
                  border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold'
                }}
              >
                ⚙️ GESTIONAR PREGUNTAS
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
                &larr; Volver al Panel
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
      {/* NAVBAR: Detecta si estamos en cualquier vista de admin para marcar el botón */}
      <Navbar onNavigate={setView} currentView={view.includes('admin') ? 'admin' : 'home'} />

      <main>
        {renderContent()}
      </main>

      <style>{`
        body { margin: 0; background-color: #1a1a1b; min-height: 100vh; overflow-x: hidden; }
        .app-container { min-height: 100vh; display: flex; flex-direction: column; }
        main { flex: 1; position: relative; }
        
        /* Asegura que las transiciones de página no rompan el layout */
        .fade-in-page {
          animation: fadeInApp 0.5s ease-in;
        }
        @keyframes fadeInApp {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default App;