import React, { useState, useEffect } from 'react';
import './WantedQuiz.css';
import axios from 'axios';

const WantedQuiz = ({ onNavigate }) => {
  // --- ESTADOS DE JUEGO ---
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
  const [answeredQuestions, setAnsweredQuestions] = useState([]);

  // --- ESTADOS DE INMERSIÓN (FX) ---
  const [feedback, setFeedback] = useState(null); 
  const [hakiSpike, setHakiSpike] = useState(false); 

  const API_URL = 'http://localhost:5000/api/quiz';

  const stepConfig = [
    'Fácil', 'Fácil', 'Fácil', 'Fácil',             
    'Intermedia', 'Intermedia', 'Intermedia', 'Intermedia', 
    'Difícil', 'Difícil', 'Difícil',                
    'Muy Difícil', 'Muy Difícil', 'Muy Difícil',    
    'Imposible'                                     
  ];

  // Inicialización
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = async () => {
    setLoading(true);
    setGameOver(false);
    setGameWon(false);
    setCurrentIndex(0);
    setLives(3);
    setHakiSpike(false);
    setAnsweredQuestions([]);
    
    try {
      const res = await axios.get(`${API_URL}/session`);
      if (res.data.success) {
        setPool(res.data.pool);
        selectNextQuestion(0, res.data.pool, []);
      }
    } catch (err) {
      console.error("Error cargando el quiz:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectNextQuestion = (stepIndex, currentPool, history) => {
    const difficulty = stepConfig[stepIndex];
    const categoryQuestions = currentPool[difficulty] || [];
    const available = categoryQuestions.filter(q => !history.includes(q._id));
    const source = available.length > 0 ? available : categoryQuestions;
    const randomQ = source[Math.floor(Math.random() * source.length)];
    setCurrentQuestion(randomQ);
  };

  const triggerFeedback = (text, type) => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 1200);
  };

  // --- LÓGICA MÁQUINA DE ESCRIBIR (FIX PRIMERA LETRA) ---
  useEffect(() => {
    if (currentQuestion && !gameOver && !gameWon) {
      setDisplayedQuestion("");
      setShowOptions(false);
      let i = 0;
      const fullText = currentQuestion.questionText || "";

      const timer = setInterval(() => {
        if (!hakiSpike) { // Solo escribe si no hay animación de nivel bloqueando
          if (i < fullText.length) {
            setDisplayedQuestion(fullText.substring(0, i + 1));
            i++;
          } else {
            clearInterval(timer);
            setTimeout(() => setShowOptions(true), 400);
          }
        }
      }, 35);
      return () => clearInterval(timer);
    }
  }, [currentQuestion?._id, gameOver, gameWon, hakiSpike]);

  const handleAnswer = (option) => {
    if (selectedOption || gameOver || gameWon) return;

    setSelectedOption(option);
    const correct = option === currentQuestion.correctAnswer;
    setIsCorrect(correct);

    const updatedHistory = [...answeredQuestions, currentQuestion._id];
    setAnsweredQuestions(updatedHistory);

    // Feedback visual inmediato
    if (correct) {
      triggerFeedback("¡CORRECTO!", "success");
    } else {
      triggerFeedback("¡INCORRECTO!", "error");
    }

    setTimeout(() => {
      if (correct) {
        if (currentIndex === 14) {
          setGameWon(true);
        } else {
          const nextIndex = currentIndex + 1;
          
          // Trigger de Onda de Haki si cambia la dificultad
          if (stepConfig[nextIndex] !== stepConfig[currentIndex]) {
            setHakiSpike(true);
            setTimeout(() => setHakiSpike(false), 1800); 
          }

          setCurrentIndex(nextIndex);
          selectNextQuestion(nextIndex, pool, updatedHistory);
        }
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) {
          setGameOver(true);
        } else {
          // Si falla, baja un escalón de dificultad si es posible
          const prevIndex = Math.max(0, currentIndex - 1);
          setCurrentIndex(prevIndex);
          selectNextQuestion(prevIndex, pool, updatedHistory);
        }
      }
      setSelectedOption(null); 
      setIsCorrect(null);
    }, 1200);
  };

  const getDiffBackground = (diff) => {
    const styles = {
      'Fácil': 'diff-easy', 'Intermedia': 'diff-intermediate',
      'Difícil': 'diff-hard', 'Muy Difícil': 'diff-very-hard', 'Imposible': 'diff-impossible'
    };
    return styles[diff] || '';
  };

  // Render de Carga
  if (loading || !currentQuestion) {
    return (
      <div className="quiz-loading">
        <div className="loading-content">
          <div className="compass-spinner">⚓</div>
          <p>PREPARANDO LOG POSE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`quiz-page-container ${getDiffBackground(currentQuestion.difficulty)}`}>
      
      {/* 1. OVERLAY DE ONDA DE HAKI (CAMBIO DE NIVEL) */}
      {hakiSpike && (
        <div className="haki-wave-overlay">
          <svg viewBox="0 0 800 200" className="integral-wave">
            <path d="M 0 100 Q 100 0 200 100 T 400 100 T 600 100 T 800 100" />
          </svg>
          <div className="haki-text-alert">NUEVO NIVEL: {currentQuestion.difficulty}</div>
        </div>
      )}

      {/* 2. OVERLAY DE FEEDBACK IMPACTO (ACIERTO / ERROR) */}
      {feedback && (
        <div className={`feedback-fullscreen-overlay ${feedback.type}`}>
          <div className="feedback-impact-content">
            {feedback.type === 'success' ? (
              <div className="success-mark">+1</div>
            ) : (
              <div className="error-mark">-1 ☠️</div>
            )}
            <h2 className="feedback-impact-text">{feedback.text}</h2>
          </div>
        </div>
      )}

      {/* Partículas de ambiente */}
      <div className="haki-particles">
        {[...Array(12)].map((_, i) => <div key={i} className="particle"></div>)}
      </div>

      <button className="btn-exit-top" onClick={() => onNavigate('home')}>
        ✕ ABANDONAR
      </button>

      {/* CONTENIDO PRINCIPAL */}
      <div className="quiz-main-content">
        {gameWon || gameOver ? (
          <div className="quiz-result-card bounce-in">
            <h2 className={gameWon ? "win-title" : "lose-title"}>
              {gameWon ? "SABES MUCHO DE ONE PIECE" : "¡DERROTADO!"}
            </h2>
            <p className="result-subtitle">
              {gameWon ? "Has ganado esta vez... " : "Tu viaje termina aquí por ahora..."}
            </p>
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
            
            <h2 className="question-text">
              {displayedQuestion}
              <span className="cursor">|</span>
            </h2>
            
            <div className={`options-grid ${showOptions ? 'visible' : ''}`}>
              {currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  style={{ animationDelay: `${i * 0.15}s` }}
                  className={`option-btn ${showOptions ? 'pop-in' : ''} ${
                    selectedOption === opt ? (isCorrect ? 'correct' : 'wrong') : ''
                  }`}
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

      {/* FOOTER HUD - STATUS DEL JUGADOR */}
      <div className="quiz-footer-hud">
        <div className="lives-section">
          {[...Array(3)].map((_, i) => (
            <span 
              key={i} 
              className={`skull-icon ${i < lives ? 'active' : 'dead'} ${
                lives === 1 && i < lives ? 'danger-pulse' : ''
              }`}
            >
              ☠️
            </span>
          ))}
        </div>

        <div className="progress-section">
          <div className="track-line">
            <div 
              className="fill-line" 
              style={{ width: `${(currentIndex / 14) * 100}%` }}
            ></div>
            
            {[0, 4, 8, 11, 14].map(f => (
              <div 
                key={f} 
                className={`milestone ${currentIndex >= f ? 'reached' : ''}`} 
                style={{ left: `${(f / 14) * 100}%` }}
              >
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