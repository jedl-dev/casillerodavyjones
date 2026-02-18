import React, { useState, useEffect } from 'react';
import './WantedQuiz.css';
import axios from 'axios';

const WantedQuiz = ({ onNavigate }) => {
  const [pool, setPool] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [displayedQuestion, setDisplayedQuestion] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [lives, setLives] = useState(3);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const API_URL = 'http://localhost:5000/api/quiz';

  // Configuración de los 15 pasos (Eliminado "Muy Fácil")
  const stepConfig = [
    'Fácil', 'Fácil', 'Fácil', 'Fácil',             // 0-3
    'Intermedia', 'Intermedia', 'Intermedia', 'Intermedia', // 4-7
    'Difícil', 'Difícil', 'Difícil',                // 8-10
    'Muy Difícil', 'Muy Difícil', 'Muy Difícil',    // 11-13
    'Imposible'                                     // 14
  ];

  useEffect(() => { startNewGame(); }, []);

  const startNewGame = async () => {
    setLoading(true); setGameOver(false); setGameWon(false);
    setCurrentIndex(0); setLives(3); setShowLevelUp(false);
    try {
      const res = await axios.get(`${API_URL}/session`);
      setPool(res.data.pool);
      selectNextQuestion(0, res.data.pool);
    } catch (err) { console.error("Error cargando el quiz:", err); }
    finally { setLoading(false); }
  };

  // Selecciona una pregunta del pool evitando repetir la última vista
  const selectNextQuestion = (stepIndex, currentPool, lastId = null) => {
    const difficulty = stepConfig[stepIndex];
    const categoryQuestions = currentPool[difficulty] || [];
    
    // Filtramos para que no sea la misma que acaba de fallar o acertar
    const filtered = categoryQuestions.filter(q => q._id !== lastId);
    const source = filtered.length > 0 ? filtered : categoryQuestions;
    
    const randomQ = source[Math.floor(Math.random() * source.length)];
    setCurrentQuestion(randomQ);
  };

  // Efecto Máquina de Escribir
  useEffect(() => {
    if (currentQuestion && !gameOver && !gameWon && !showLevelUp) {
      setDisplayedQuestion("");
      setShowOptions(false);
      let i = 0;
      const fullText = currentQuestion.questionText;
      const timer = setInterval(() => {
        setDisplayedQuestion((prev) => prev + fullText.charAt(i));
        i++;
        if (i >= fullText.length) {
          clearInterval(timer);
          setTimeout(() => setShowOptions(true), 400);
        }
      }, 35);
      return () => clearInterval(timer);
    }
  }, [currentQuestion, gameOver, gameWon, showLevelUp]);

  const handleAnswer = (option) => {
    if (selectedOption || gameOver || gameWon) return;

    setSelectedOption(option);
    const correct = option === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    setTimeout(() => {
      const lastId = currentQuestion._id;
      if (correct) {
        if (currentIndex === 14) {
          setGameWon(true);
        } else {
          const nextIndex = currentIndex + 1;
          // Banderas de nivel: 4, 8, 11, 14
          if ([4, 8, 11, 14].includes(nextIndex)) setShowLevelUp(true);
          setCurrentIndex(nextIndex);
          selectNextQuestion(nextIndex, pool, lastId);
        }
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) {
          setGameOver(true);
        } else {
          const prevIndex = Math.max(0, currentIndex - 1);
          setCurrentIndex(prevIndex);
          selectNextQuestion(prevIndex, pool, lastId);
        }
      }
      setSelectedOption(null); setIsCorrect(null);
    }, 1200);
  };

  const getDiffBackground = (diff) => {
    const styles = {
      'Fácil': 'diff-easy', 'Intermedia': 'diff-intermediate',
      'Difícil': 'diff-hard', 'Muy Difícil': 'diff-very-hard', 'Imposible': 'diff-impossible'
    };
    return styles[diff] || '';
  };

  if (loading || !currentQuestion) return <div className="quiz-loading">⚓ PREPARANDO LOG POSE...</div>;

  return (
    <div className={`quiz-page-container ${getDiffBackground(currentQuestion.difficulty)}`}>
      <div className="haki-particles">
        {[...Array(12)].map((_, i) => <div key={i} className="particle"></div>)}
      </div>

      <button className="btn-exit-top" onClick={() => onNavigate('home')}>✕ ABANDONAR</button>

      <div className="quiz-main-content">
        {showLevelUp ? (
          <div className="level-up-card pop-in">
             <h2 className="level-up-title">¡EL HAKI SE INTENSIFICA!</h2>
             <p className="level-up-text">Nivel: <span>{currentQuestion.difficulty}</span></p>
             <button className="btn-pirate" onClick={() => setShowLevelUp(false)}>ESTOY LISTO</button>
          </div>
        ) : gameWon || gameOver ? (
          <div className="quiz-result-card bounce-in">
            <h2 className={gameWon ? "win-title" : "lose-title"}>{gameWon ? "¡NUEVO YONKO!" : "¡DERROTADO!"}</h2>
            <div className="result-buttons">
              <button className="btn-pirate" onClick={startNewGame}>REINTENTAR</button>
              <button className="btn-pirate btn-outline" onClick={() => onNavigate('home')}>INICIO</button>
            </div>
          </div>
        ) : (
          <div className="question-area">
            <div className="difficulty-tag-container">
               <span className="diff-label">{currentQuestion.difficulty}</span>
            </div>
            <h2 className="question-text">{displayedQuestion}<span className="cursor">|</span></h2>
            
            <div className={`options-grid ${showOptions ? 'visible' : ''}`}>
              {currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  style={{ animationDelay: `${i * 0.15}s` }}
                  className={`option-btn ${showOptions ? 'pop-in' : ''} ${selectedOption === opt ? (isCorrect ? 'correct' : 'wrong') : ''}`}
                  onClick={() => handleAnswer(opt)}
                  disabled={!showOptions || selectedOption !== null}
                >
                  <span className="option-letter">{String.fromCharCode(65 + i)}</span> 
                  <span className="option-text">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="quiz-footer-hud">
        <div className="lives-section">
          {[...Array(3)].map((_, i) => (
            <span key={i} className={`skull-icon ${i < lives ? 'active' : 'dead'}`}>☠️</span>
          ))}
        </div>
        <div className="progress-section">
          <div className="track-line">
            <div className="fill-line" style={{ width: `${(currentIndex / 14) * 100}%` }}></div>
            {[0, 4, 8, 11, 14].map(f => (
              <div key={f} className={`milestone ${currentIndex >= f ? 'reached' : ''}`} style={{ left: `${(f / 14) * 100}%` }}>
                <div className="milestone-flag">🚩</div>
              </div>
            ))}
          </div>
          <p className="progress-stats">LOG POSE: {currentIndex + 1} / 15</p>
        </div>
      </div>
    </div>
  );
};

export default WantedQuiz;