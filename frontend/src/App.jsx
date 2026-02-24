import React, { useState } from 'react';

// Componentes
import Navbar from './components/Navbar';
import GameMenu from './components/GameMenu';
import GridGame from './components/GridGame';
import WantedQuiz from './components/WantedQuiz';
import BountyWordle from './components/BountyWordle'; 
import NameWordle from './components/NameWordle';
import ImpostorGame from './components/ImpostorGame'; 
import QuizAdmin from './components/QuizAdmin'; 
import CharacterList from './components/CharacterList'; 
import AddCharacter from './components/AddCharacter'; 
import BountyClash from './components/BountyClash';
import Changelog from './components/Changelog';
import DavyBack from './components/DavyBack'; // ⚓ IMPORTACIÓN DEL NUEVO JUEGO

function App() {
  // Estados: 'home', 'grid-game', 'wanted-quiz', 'bounty-dle', 'name-wordle', 'impostor-game', 'admin', 'quiz-admin', 'admin-form', 'bounty-clash', 'changelog', 'davy-back'
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

  // --- Renderizado Condicional de Vistas ---
  const renderContent = () => {
    switch (view) {
      case 'home':
        return <GameMenu onNavigate={setView} />;
      
      case 'grid-game':
        return <GridGame onNavigate={setView} />;

      case 'wanted-quiz':
        return <WantedQuiz onNavigate={setView} />;

      case 'bounty-dle': 
        return <BountyWordle onNavigate={setView} />;

      case 'name-wordle':
        return <NameWordle onNavigate={setView} />;

      case 'impostor-game': 
        return <ImpostorGame onNavigate={setView} />;

      case 'davy-back': // ⚓ RUTA DEL NUEVO JUEGO
        return <DavyBack onNavigate={setView} />;

      case 'quiz-admin': 
        return <QuizAdmin onNavigate={() => setView('admin')} />;

      case 'bounty-clash': 
        return <BountyClash onNavigate={setView} />;
      
      case 'changelog':
        return <Changelog onNavigate={setView} />;

      case 'admin':
        return (
          <div className="fade-in-page" style={{paddingTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
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
                onClick={() => setView('quiz-admin')} 
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
          <div className="fade-in-page" style={{paddingTop: '20px'}}>
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

  // El Navbar se oculta en los juegos (como davy-back) para maximizar la inmersión
  const showNavbar = view === 'home' || view.includes('admin') || view === 'changelog';

  return (
    <div className="app-container">
      
      {/* El Navbar condicionado */}
      {showNavbar && (
        <Navbar onNavigate={setView} currentView={view.includes('admin') ? 'admin' : 'home'} />
      )}

      <main className="fade-in-page">
        {renderContent()}
      </main>

      <style>{`
        body { margin: 0; background-color: #1a1a1b; min-height: 100vh; overflow-x: hidden; }
        .app-container { min-height: 100vh; display: flex; flex-direction: column; }
        main { flex: 1; position: relative; }
        
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