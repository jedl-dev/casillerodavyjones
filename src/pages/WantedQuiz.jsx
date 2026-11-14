import React, { useState, useEffect, useRef } from 'react';
import './WantedQuiz.css';
import MareaGauge from '../components/MareaGauge';
import html2canvas from 'html2canvas';
import { answerSolo, startSolo, useWildcard as playWildcard } from '../lib/quizApi';
import { getPlayerName } from '../lib/user';
import { bestStreakOf, entryClass } from '../lib/quizRoom';

const DIFFICULTIES = ['Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible'];

const DIFF_COLORS = {
  'Fácil': '#5fd6c9',
  'Intermedia': '#3fa9c4',
  'Difícil': '#2b7fa8',
  'Muy Difícil': '#3c5d95',
  'Imposible': '#a9c7e8'
};
const WILDCARDS = [
  { key: 'eliminar', label: 'Eliminar dos', hint: 'Tacha dos respuestas falsas' },
  { key: 'cambiar', label: 'Cambiar pregunta', hint: 'Otra de la misma dificultad' },
  { key: 'vida', label: 'Vida extra', hint: '+1 vida, hasta el tope' },
  { key: 'ancla', label: 'Ancla', hint: 'El pr?ximo fallo no te devuelve casilla' }
];

const WildIcon = ({ type }) => {
  if (type === 'eliminar') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M5 6l5.5 6L5 18M13 6l5.5 6L13 18" />
      </svg>
    );
  }
  if (type === 'cambiar') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.3-5.7" />
        <path d="M20 4v5h-5" />
      </svg>
    );
  }
  if (type === 'vida') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M12 4v16M7 9h10" />
        <path d="M5 6.5C5 4.6 6.6 3 8.5 3h7C17.4 3 19 4.6 19 6.5v11c0 1.9-1.6 3.5-3.5 3.5h-7C6.6 21 5 19.4 5 17.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v15" />
      <circle cx="12" cy="3.6" r="1.6" />
      <path d="M8 8.5h8" />
      <path d="M5.5 14c.5 3.6 3.2 5.5 6.5 5.5s6-1.9 6.5-5.5" />
    </svg>
  );
};

const DIFF_LEVEL = { 'Fácil': 1, 'Intermedia': 2, 'Difícil': 3, 'Muy Difícil': 4, 'Imposible': 5 };

const MILESTONES = [0, 0.25, 0.5, 0.75, 1];

const SEA_WAVE =
  'M0 120 C 240 40 480 200 720 120 S 1200 40 1440 120 S 1920 200 2160 120 S 2640 40 2880 120 V320 H0 Z';

const getDifficultyColor = (diff) => DIFF_COLORS[diff] || 'var(--lum)';
const difficultyLevel = (diff) => DIFF_LEVEL[diff] || 1;
const padRound = (value) => String(value).padStart(2, '0');

const Pennant = () => (
  <svg viewBox="0 0 12 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 15V1" />
    <path d="M2 1h8L8 5l2 4H2" />
  </svg>
);

const LifeSkull = ({ dead, danger }) => (
  <svg
    className={`life-icon${dead ? ' is-dead' : ''}${danger ? ' is-danger' : ''}`}
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <g className="life-bones" strokeWidth="2.1">
      <path d="M6.6 7.4 25.4 24.6" />
      <path d="M6.6 24.6 25.4 7.4" />
      <circle cx="5.2" cy="8.4" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="7.8" cy="6.3" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="26.8" cy="23.6" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="24.2" cy="25.7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="7.8" cy="25.7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="5.2" cy="23.6" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="24.2" cy="6.3" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="26.8" cy="8.4" r="1.25" fill="currentColor" stroke="none" />
    </g>
    <path d="M16 8.2a7.6 7.6 0 0 0-7.6 7.6c0 2.7 1.4 4.9 3.6 6.2v3.4h8v-3.4c2.2-1.3 3.6-3.5 3.6-6.2A7.6 7.6 0 0 0 16 8.2Z" />
    <circle cx="13" cy="15.8" r="1.45" fill="currentColor" stroke="none" />
    <circle cx="19" cy="15.8" r="1.45" fill="currentColor" stroke="none" />
    <path d="M16 18.7 14.7 21h2.6Z" fill="currentColor" stroke="none" />
    <path d="M13.4 25.4v1.8M16 25.4v1.8M18.6 25.4v1.8" />
  </svg>
);

const RouteCompass = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m12 5.5 1.8 4.7 4.7 1.8-4.7 1.8L12 18.5l-1.8-4.7L5.5 12l4.7-1.8Z" fill="currentColor" stroke="none" />
  </svg>
);

const ModalCompass = () => (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="24" cy="24" r="19" />
    <circle cx="24" cy="24" r="15" strokeDasharray="1 5" />
    <path d="m24 8 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" />
    <circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="m3 3 10 10M13 3 3 13" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 12 5 5L20 6" />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);

const WantedQuiz = ({ navigate }) => {
  const [sessionToken, setSessionToken] = useState(null);
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(15);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [entrySeed, setEntrySeed] = useState(0);
  const [lives, setLives] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);

  const [feedback, setFeedback] = useState(null); 
  const [hakiSpike, setHakiSpike] = useState(false); 
  const [lifeBeat, setLifeBeat] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [wildcards, setWildcards] = useState({ eliminar: 0, cambiar: 0, vida: 0, ancla: 0 });
  const [anchor, setAnchor] = useState(false);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [disabledOptions, setDisabledOptions] = useState([]);
  const [wildcardRound, setWildcardRound] = useState(0);
  const [rollQueue, setRollQueue] = useState([]);
  const [summary, setSummary] = useState(null);
  const [record, setRecord] = useState(0);
  const [newRecord, setNewRecord] = useState(false);

  const summaryRef = useRef(null);
  const questionAreaRef = useRef(null);
  const answeringRef = useRef(false);
  const playerName = getPlayerName() || 'Invitado';

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    startNewGame();
    try {
      setRecord(Number(window.localStorage.getItem('opq:bestSolo') || 0));
    } catch {
      setRecord(0);
    }
  }, []);

  const startNewGame = async () => {
    setLoading(true);
    setError('');
    setGameOver(false);
    setGameWon(false);
    setRound(0);
    setTotalRounds(20);
    setLives(3);
    setHakiSpike(false);
    setLifeBeat(false);
    setAnsweredQuestions([]);
    setShowSummary(false);
    setIsGeneratingImage(false);
    setCurrentQuestion(null);
    setWildcards({ eliminar: 0, cambiar: 0, vida: 0, ancla: 0 });
    setAnchor(false);
    setStreak(0);
    setPoints(0);
    setMultiplier(1);
    setDisabledOptions([]);
    setWildcardRound(0);
    setRollQueue([]);
    setSummary(null);
    setNewRecord(false);
    answeringRef.current = false;
    
    try {
      const data = await startSolo();
      setSessionToken(data.token);
      setLives(data.lives);
      setRound(data.round);
      setTotalRounds(data.total);
      setPoints(data.score || 0);
      setStreak(data.streak || 0);
      setAnchor(Boolean(data.anchor));
      setWildcards(data.wildcards || { eliminar: 0, cambiar: 0, vida: 0, ancla: 0 });
      setRollQueue(Array.isArray(data.roll) ? data.roll : []);
      setCurrentQuestion(
        data.question ? { ...data.question, options: shuffleArray(data.question.options) } : null
      );
      setEntrySeed(Math.floor(Math.random() * 3));
    } catch (err) {
      console.error("Error cargando el quiz:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerFeedback = (text, type) => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 1200);
  };

  const handleAnswer = async (option) => {
    if (answeringRef.current || selectedOption || gameOver || gameWon || !sessionToken) return;

    answeringRef.current = true;
    setSelectedOption(option);

    let result;
    try {
      result = await answerSolo(sessionToken, option);
    } catch (err) {
      console.error("Error validando respuesta:", err);
      answeringRef.current = false;
      setSelectedOption(null);
      triggerFeedback("ERROR DE CONEXIÓN", "error");
      return;
    }

    const correct = Boolean(result?.correct);
    const correctAnswer = result?.correct_answer;
    setIsCorrect(correct);

    const answerRecord = {
      round,
      question: currentQuestion.question_text,
      difficulty: currentQuestion.difficulty,
      userAnswer: option,
      correctAnswer,
      isCorrect: correct,
      options: currentQuestion.options
    };

    const updatedHistory = [...answeredQuestions, answerRecord];
    setAnsweredQuestions(updatedHistory);

    if (correct) {
      triggerFeedback("¡CORRECTO!", "success");
    } else {
      triggerFeedback("¡INCORRECTO!", "error");
    }

    setTimeout(() => {
      if (result.lives < lives) {
        setLifeBeat(true);
        setTimeout(() => setLifeBeat(false), 900);
      }
      setLives(result.lives);
      setPoints(result.score || 0);
      setStreak(result.streak || 0);
      setMultiplier(result.multiplier || 1);
      setAnchor(Boolean(result.anchor));
      setWildcards(result.wildcards || { eliminar: 0, cambiar: 0, vida: 0, ancla: 0 });
      if (Array.isArray(result.roll) && result.roll.length) {
        setRollQueue(result.roll);
      }

      if (result.finished) {
        if (result.won) setGameWon(true);
        else setGameOver(true);
        setSummary(result.summary || null);
        if ((result.score || 0) > record) {
          setNewRecord(true);
          setRecord(result.score || 0);
          try {
            window.localStorage.setItem('opq:bestSolo', String(result.score || 0));
          } catch {
            // Sin almacenamiento.
          }
        }
        setTimeout(() => setShowSummary(true), 800);
      } else {
        if (result.question
          && difficultyLevel(result.question.difficulty) > difficultyLevel(currentQuestion.difficulty)) {
          setHakiSpike(true);
          setTimeout(() => setHakiSpike(false), 1800);
        }

        setRound(result.round);
        if (result.question) {
          setCurrentQuestion({
            ...result.question,
            options: shuffleArray(result.question.options)
          });
          setEntrySeed(Math.floor(Math.random() * 3));
          setDisabledOptions([]);
        }
      }

      setSelectedOption(null); 
      setIsCorrect(null);
      answeringRef.current = false;
    }, 1200);
  };

  const handleWildcard = async (type) => {
    if (!sessionToken || gameOver || gameWon) return;
    if ((wildcards[type] || 0) <= 0 || wildcardRound === round) return;

    try {
      const result = await playWildcard(sessionToken, type);
      setWildcards(result.wildcards || wildcards);
      setWildcardRound(result.round ?? round);

      if (type === 'eliminar') {
        setDisabledOptions(Array.isArray(result.disabled) ? result.disabled : []);
      }
      if (type === 'cambiar' && result.question) {
        setCurrentQuestion({
          ...result.question,
          options: shuffleArray(result.question.options)
        });
        setEntrySeed(Math.floor(Math.random() * 3));
        setDisabledOptions([]);
        setSelectedOption(null);
        setIsCorrect(null);
      }
      if (type === 'vida') {
        setLives(result.lives ?? lives);
        setLifeBeat(true);
        setTimeout(() => setLifeBeat(false), 900);
      }
      if (type === 'ancla') {
        setAnchor(true);
      }
    } catch (err) {
      triggerFeedback(err.message.toUpperCase(), 'error');
    }
  };

  const getDiffBackground = (diff) => {
    const styles = {
      'Fácil': 'diff-easy', 'Intermedia': 'diff-intermediate',
      'Difícil': 'diff-hard', 'Muy Difícil': 'diff-very-hard', 'Imposible': 'diff-impossible'
    };
    return styles[diff] || '';
  };

  const calculateStats = () => {
    const total = answeredQuestions.length;
    const correct = answeredQuestions.filter(a => a.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const difficultyReached = total > 0
      ? answeredQuestions[total - 1].difficulty
      : 'Fácil';
    
    return {
      total,
      correct,
      accuracy,
      difficultyReached,
      livesRemaining: lives,
      bestStreak: bestStreakOf(answeredQuestions)
    };
  };

  const generateShareText = () => {
    const stats = calculateStats();
    const status = gameWon ? '🏆 VICTORIA' : '💀 DERROTA';
    const lines = [
      `⚓ EL CASILLERO DE DAVY D. JONES - QUIZ`,
      `${status}`,
      `Jugador: ${playerName}`,
      `Preguntas: ${stats.correct}/${stats.total} (${stats.accuracy}% precisión)`,
      `Puntos: ${points} · mejor racha ${stats.bestStreak}`,
      `Dificultad alcanzada: ${stats.difficultyReached}`,
      `Vidas restantes: ${stats.livesRemaining} ❤️`,
      ``,
      `¿Te atreves a superar mi puntuación?`,
      `🏴‍☠️ onepiecegames.vercel.app`
    ];
    return lines.join('\n');
  };

  const handleShareImage = async () => {
    if (!summaryRef.current || isGeneratingImage) return;
    
    setIsGeneratingImage(true);
    const modal = summaryRef.current;
    let canvas = null;
    
    try {
      modal.classList.add('is-capturing');
      canvas = await html2canvas(modal, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#021013',
        width: modal.scrollWidth,
        height: modal.scrollHeight,
      });
      modal.classList.remove('is-capturing');
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
      
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'wanted-quiz-result.png', { type: 'image/png' })] })) {
        await navigator.share({
          title: 'Quiz - El Casillero de Davy D. Jones',
          text: generateShareText(),
          files: [new File([blob], 'wanted-quiz-result.png', { type: 'image/png' })]
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'Quiz - El Casillero de Davy D. Jones',
          text: generateShareText(),
          url: window.location.origin
        });
      } else {
        // Fallback: download image
        const link = document.createElement('a');
        link.download = 'wanted-quiz-result.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('Error generating/sharing image:', err);
      // Fallback: download image
      if (canvas) {
        const link = document.createElement('a');
        link.download = 'wanted-quiz-result.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        try {
          await navigator.clipboard.writeText(generateShareText());
        } catch {
          // Sin portapapeles disponible.
        }
      }
    } finally {
      modal.classList.remove('is-capturing');
      setIsGeneratingImage(false);
    }
  };

  const progress = totalRounds > 1 ? ((round - 1) / (totalRounds - 1)) * 100 : 0;
  const level = difficultyLevel(currentQuestion?.difficulty);

  if (loading || !currentQuestion) {
    return (
      <div className="quiz-loading">
        <div className="loading-content">
          <div className="compass-loader" aria-hidden="true">
            <span className="compass-ring"></span>
            <span className="compass-ring"></span>
            <span className="compass-center"><ModalCompass /></span>
          </div>
          <p className="loading-text">{error || 'Descendiendo al casillero...'}</p>
          {!error && <span className="quiz-loading__track" aria-hidden="true"><span></span></span>}
          {error && (
            <button className="btn-pirate" onClick={() => navigate('/')}>
              VOLVER A LA CUBIERTA
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`quiz-page-container ${getDiffBackground(currentQuestion.difficulty)}`}
      style={{ '--deck': getDifficultyColor(currentQuestion.difficulty) }}
    >
      <div className="quiz-sea" aria-hidden="true">
        <div className="quiz-sea__light"></div>
        <div className="quiz-sea__rays">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="quiz-sea__currents"></div>
        <div className="quiz-sea__swell" aria-hidden="true">
          <svg viewBox="0 0 2880 320" preserveAspectRatio="none">
            <path d={SEA_WAVE} />
          </svg>
          <svg viewBox="0 0 2880 320" preserveAspectRatio="none">
            <path d={SEA_WAVE} />
          </svg>
          <svg viewBox="0 0 2880 320" preserveAspectRatio="none">
            <path d={SEA_WAVE} />
          </svg>
        </div>
      </div>

      {showTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-modal bounce-in">
            <div className="tutorial-crest" aria-hidden="true"><ModalCompass /></div>
            <h2>El desafío del casillero</h2>
            <p className="tutorial-lede">
              20 preguntas, 3 vidas y una sola salida. El mar no perdona a quien duda.
            </p>
            <ul className="tutorial-list">
              <li>
                <span className="tutorial-step" aria-hidden="true">1</span>
                <span><strong>20 preguntas.</strong> Acierta para abrir la siguiente puerta del casillero y suma puntos según la marea.</span>
              </li>
              <li>
                <span className="tutorial-step" aria-hidden="true">2</span>
                <span><strong>Racha.</strong> Encadenar aciertos multiplica lo que ganas: ×1.1 desde tres, ×1.25 desde seis, ×1.5 desde nueve.</span>
              </li>
              <li>
                <span className="tutorial-step" aria-hidden="true">3</span>
                <span><strong>Tres vidas.</strong> Cada fallo te cuesta una y te devuelve casilla atrás. A la tercera, el mar te reclama.</span>
              </li>
              <li>
                <span className="tutorial-step" aria-hidden="true">4</span>
                <span><strong>Comodines.</strong> La ruleta te da unos al zarpar y otros a mitad de descenso. Uno por ronda: elimina, cambia, suma vida o echa el ancla.</span>
              </li>
            </ul>
            <div className="tutorial-tides" aria-hidden="true">
              <span className="tutorial-tides__label">Fácil</span>
              <span className="tutorial-tides__scale">
                {[...Array(5)].map((_, i) => <i key={i}></i>)}
              </span>
              <span className="tutorial-tides__label">Imposible</span>
            </div>
            <button className="btn-pirate tutorial-start" onClick={() => setShowTutorial(false)}>
              ZARPAR
            </button>
          </div>
        </div>
      )}

      {hakiSpike && (
        <div className="haki-wave-overlay">
          <div className="sea-spike">
            <span className="sea-spike__eyebrow">La marea sube</span>
            <span className="sea-spike__name">{currentQuestion.difficulty}</span>
            <MareaGauge className="sea-spike__gauge" level={level} />
          </div>
        </div>
      )}

      {rollQueue.length > 0 && !showTutorial && !gameOver && !gameWon && (
        <div className="roll-overlay" role="dialog" aria-modal="true" aria-labelledby="roll-title">
          <div className="roll-panel bounce-in">
            <span className="roll-eyebrow">La ruleta del casillero</span>
            <h2 id="roll-title" className="roll-title">
              {rollQueue.length} comodín{rollQueue.length === 1 ? '' : 'es'} para la mano
            </h2>
            <ul className="roll-list">
              {rollQueue.map((type, index) => {
                const meta = WILDCARDS.find((wild) => wild.key === type);
                return (
                  <li
                    key={`${type}-${index}`}
                    className="roll-item"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <span className="roll-item__icon"><WildIcon type={type} /></span>
                    <span className="roll-item__label">{meta ? meta.label : type}</span>
                  </li>
                );
              })}
            </ul>
            <button className="btn-pirate" onClick={() => setRollQueue([])}>
              A la mano
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`feedback-fullscreen-overlay ${feedback.type}`}>
          <div className="feedback-impact-content">
            {feedback.type === 'success' ? (
              <div className="success-mark">+1</div>
            ) : (
              <div className="error-mark">-1</div>
            )}
            <h2 className="feedback-impact-text">{feedback.text}</h2>
          </div>
        </div>
      )}

      <div className="haki-particles">
        {[...Array(12)].map((_, i) => <div key={i} className="particle"></div>)}
      </div>

      <button className="btn-exit-top" onClick={() => navigate('/')}>
        <CloseIcon /> ABANDONAR
      </button>

      <div className="quiz-main-content">
        {(gameWon || gameOver) && !showSummary && (
          <div className="quiz-result-card bounce-in">
            <h2 className={gameWon ? "win-title" : "lose-title"}>
              {gameWon ? "SABES MUCHO DE ONE PIECE" : "¡DERROTADO!"}
            </h2>
            <p className="result-subtitle">
              {gameWon ? "Has ganado esta vez... " : "Tu viaje termina aquí por ahora..."}
            </p>
            <div className="result-buttons">
              <button className="btn-pirate" onClick={startNewGame}>REINTENTAR</button>
              <button className="btn-pirate btn-outline" onClick={() => navigate('/')}>INICIO</button>
            </div>
          </div>
        )}

        {!gameWon && !gameOver ? (
          <div className="question-area" ref={questionAreaRef}>
            <div className="difficulty-tag-container">
              <div
                className="marea-tag"
                style={{ '--diff-color': getDifficultyColor(currentQuestion.difficulty) }}
                aria-label={`Marea ${currentQuestion.difficulty}, nivel ${level} de 5`}
              >
                <span className="marea-tag__label">Marea</span>
                <span className="marea-tag__name">{currentQuestion.difficulty}</span>
                <MareaGauge level={level} />
              </div>
            </div>
            
            <h2 className={`question-text ${entryClass(entrySeed)}`} key={round}>
              {currentQuestion.question_text}
            </h2>

            <div className="options-grid visible">
              {currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  className={`option-btn ${
                    disabledOptions.includes(opt) ? 'is-gone ' : ''
                  }${
                    selectedOption === opt ? (isCorrect ? 'correct' : 'wrong') : ''
                  }`}
                  onClick={() => handleAnswer(opt)}
                  disabled={selectedOption !== null || disabledOptions.includes(opt)}
                >
                  <span className="option-letter">{String.fromCharCode(65 + i)}</span> 
                  <span className="option-text">{opt}</span>
                </button>
              ))}
            </div>
            
            <div className="quiz-inline-hud">
              <div className="quiz-points" aria-live="polite">
                <span className="quiz-points__value">{points}</span>
                <span className="quiz-points__label">puntos</span>
                {streak >= 2 && (
                  <span className="quiz-points__streak">racha {streak} ? ?{Number(multiplier)}</span>
                )}
                {anchor && <span className="quiz-points__anchor">Ancla echada</span>}
              </div>

              <div
                className={`lives-section${lifeBeat ? ' is-beating' : ''}`}
                role="img"
                aria-label={`Vidas: ${lives}`}
              >
                {[...Array(Math.min(5, Math.max(3, lives)))].map((_, i) => (
                  <LifeSkull
                    key={i}
                    dead={i >= lives}
                    danger={lives === 1 && i < lives}
                  />
                ))}
              </div>

              <div className="progress-section">
                <div className="progress-head">
                  <p className="progress-stats">Ruta del Log Pose</p>
                  <p className="progress-count">
                    {padRound(round)}<span> / {padRound(totalRounds)}</span>
                  </p>
                </div>
                <div
                  className="track-line"
                  role="progressbar"
                  aria-label="Progreso de la partida"
                  aria-valuemin={1}
                  aria-valuemax={totalRounds}
                  aria-valuenow={round}
                >
                  <span className="track-ticks" aria-hidden="true"></span>
                  <span className="fill-line" style={{ width: `${progress}%` }}></span>
                  <span className="route-marker" style={{ left: `${progress}%` }} aria-hidden="true">
                    <RouteCompass />
                  </span>
                  {MILESTONES.map((f) => (
                    <span
                      key={f}
                      className={`milestone ${(round - 1) / Math.max(1, totalRounds - 1) >= f ? 'reached' : ''}`}
                      style={{ left: `${f * 100}%` }}
                      aria-hidden="true"
                    >
                      <Pennant />
                    </span>
                  ))}
                </div>
                <div className="track-legend" aria-hidden="true">
                  <span>Fácil</span>
                  <span>Imposible</span>
                </div>
              </div>
            </div>

            <div className="wildcard-bar" aria-label="Comodines">
              {WILDCARDS.map((wild) => {
                const count = wildcards[wild.key] || 0;
                const blocked = count <= 0 || wildcardRound === round || selectedOption !== null;
                return (
                  <button
                    key={wild.key}
                    type="button"
                    className={`wildcard${wild.key === 'ancla' && anchor ? ' is-active' : ''}`}
                    onClick={() => handleWildcard(wild.key)}
                    disabled={blocked}
                    title={wild.hint}
                  >
                    <span className="wildcard__icon"><WildIcon type={wild.key} /></span>
                    <span className="wildcard__copy">
                      <strong>{wild.label}</strong>
                      <small>{wild.hint}</small>
                    </span>
                    <span className="wildcard__count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showSummary && (
          <div className="summary-overlay">
            <div className="summary-modal bounce-in" ref={summaryRef}>
              <div className="summary-header">
                <div className="summary-heading">
                  <div className="summary-badge" style={{ background: gameWon ? 'var(--state-ok)' : 'var(--state-bad)' }}>
                    {gameWon ? 'VICTORIA' : 'DERROTA'}
                  </div>
                  <p className="summary-player">{playerName}</p>
                </div>
                <button className="summary-close" aria-label="Cerrar resumen" onClick={() => { setShowSummary(false); navigate('/'); }}><CloseIcon /></button>
              </div>

              <div className="summary-score">
                <span className="summary-score__label">Puntuación</span>
                <span className="summary-score__value">{points}</span>
                <span className="summary-score__record">
                  {newRecord ? 'Nuevo récord en el casillero' : `Récord: ${record}`}
                </span>
                {summary && (
                  <span className="summary-score__breakdown">
                    Comodines sin usar +{summary.bonus_wildcards} · Vidas +{summary.bonus_lives}
                  </span>
                )}
              </div>

              <div className="summary-stats">
                <div className="stat-card">
                  <span className="stat-value">{calculateStats().correct}</span>
                  <span className="stat-label">Correctas</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{calculateStats().total}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{calculateStats().accuracy}%</span>
                  <span className="stat-label">Precisión</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{calculateStats().bestStreak}</span>
                  <span className="stat-label">Mejor racha</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{calculateStats().livesRemaining}</span>
                  <span className="stat-label">Vidas</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{calculateStats().difficultyReached}</span>
                  <span className="stat-label">Nivel Final</span>
                </div>
              </div>

              <div className="summary-questions">
                <h3>Registro del Log Pose</h3>
                <div className="questions-list">
                  {answeredQuestions.map((answer, idx) => (
                    <div key={idx} className={`question-row ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                      <div className="q-number">{idx + 1}</div>
                      <div className="q-content">
                        <p className="q-text">{answer.question}</p>
                        <div className="q-answers">
                          <span className={`answer user ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                            Tu respuesta: {answer.userAnswer}
                          </span>
                          {!answer.isCorrect && (
                            <span className="answer correct">
                              Correcta: {answer.correctAnswer}
                            </span>
                          )}
                        </div>
                        <span className="q-difficulty" style={{ background: getDifficultyColor(answer.difficulty) }}>
                          {answer.difficulty}
                        </span>
                      </div>
                      <div className="q-result">
                        {answer.isCorrect ? <CheckIcon /> : <CrossIcon />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="summary-actions">
                <button className="btn-pirate btn-share-image" onClick={handleShareImage} disabled={isGeneratingImage}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  {isGeneratingImage ? 'GENERANDO...' : 'COMPARTIR IMAGEN'}
                </button>
                <button className="btn-pirate" onClick={startNewGame}>REINTENTAR</button>
                <button className="btn-pirate btn-outline" onClick={() => { setShowSummary(false); navigate('/'); }}>INICIO</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WantedQuiz;