import React, { useState, useEffect, useRef } from 'react';
import './WantedQuiz.css';
import MareaGauge from '../components/MareaGauge';
import html2canvas from 'html2canvas';
import { advanceSolo, answerSolo, beginSolo, placeBet, soloCategories, startSolo, useWildcard as playWildcard } from '../lib/quizApi';
import { getPlayerName } from '../lib/user';
import Link from '../components/Link';
import { claimSoloScore, getArcadeIdentity } from '../lib/arcade';
import { bestStreakOf, entryClass, formatBounty, ownedWildcards } from '../lib/quizRoom';
import WantedSummary from '../components/WantedSummary';

const DIFFICULTIES = ['Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible'];

const DIFF_COLORS = {
  'Fácil': '#5fd6c9',
  'Intermedia': '#3fa9c4',
  'Difícil': '#2b7fa8',
  'Muy Difícil': '#3c5d95',
  'Imposible': '#a9c7e8'
};
const WILDCARDS = [
  { key: 'filo', label: 'Filo de Zoro', hint: 'Corta dos respuestas de la siguiente', lore: 'Tres espadas, un solo corte.', kind: 'good' },
  { key: 'alma', label: 'Alma de Brook', hint: '+1 vida, hasta el tope', lore: 'La muerte no acaba la fiesta.', kind: 'good' },
  { key: 'ancla', label: 'Ancla de Franky', hint: 'El pr\u00f3ximo fallo no te devuelve casilla', lore: 'SUPER anclado al fondo.', kind: 'good' },
  { key: 'ojo', label: 'Ojo de Robin', hint: 'Elige la categor\u00eda de la siguiente', lore: 'Los Poneglyph tambi\u00e9n susurran.', kind: 'good' },
  { key: 'pose', label: 'Log Pose doble', hint: '\u00d72 puntos en la siguiente', lore: 'Dos islas, una sola aguja.', kind: 'good' },
  { key: 'marea', label: 'Marea a favor', hint: 'La siguiente baja una marea', lore: 'Nami negocia con el cielo.', kind: 'good' },
  { key: 'den_den', label: 'Den Den Mushi', hint: 'Revela la inicial de la respuesta; la ronda vale \u00d70.5', lore: 'El caracol todo lo oye.', kind: 'neutral' },
  { key: 'haki', label: 'Haki del Rey', hint: '\u00d72 en la siguiente, pero sin racha', lore: 'El rey no necesita rachas.', kind: 'neutral' },
  { key: 'sake', label: 'Barril de sake', hint: '+1 vida; la siguiente vale \u00d70.5', lore: 'Binks no sabe de peajes.', kind: 'neutral' },
  { key: 'bazuca', label: 'Bazuca de Usopp', hint: 'Corta dos, pero la siguiente sube una marea', lore: 'Precisi\u00f3n dudosa, valent\u00eda segura.', kind: 'neutral' },
  { key: 'mihawk', label: 'Ojo de Mihawk', hint: 'Revela la respuesta; la ronda vale 0', lore: 'Ve el corte antes del golpe.', kind: 'neutral' },
  { key: 'law', label: 'Room de Law', hint: 'Cambia la siguiente por otra de la misma marea', lore: 'Dentro del Room, t\u00fa decides d\u00f3nde.', kind: 'neutral' },
  { key: 'shanks', label: 'Haki del Emperador', hint: '\u00d72 en la siguiente, pero con la mitad de tiempo', lore: 'Un emperador no necesita mucho tiempo.', kind: 'neutral' },
  { key: 'fruta', label: 'Fruta del Diablo', hint: 'Un efecto al azar: bueno o maldito', lore: 'Nadie sabe qu\u00e9 le toca al morder.', kind: 'neutral' },
  { key: 'yami', label: 'Maldici\u00f3n Yami Yami', hint: '\u00d72, pero un fallo cuesta 2 vidas', lore: 'La oscuridad cobra su peaje.', kind: 'bad' },
  { key: 'buggy', label: 'Trampa de Buggy', hint: 'No hace nada; ocupa un hueco', lore: 'El circo siempre cobra entrada.', kind: 'bad' }
];

const WildIcon = ({ type }) => {
  if (type === 'filo') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20 18 6M6 4l14 14M9 3l12 12" />
        <path d="M3 17l4 4M17 21l4-4" />
        <circle cx="5" cy="19" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'marea') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 14c2.2-3 4.4-3 6.6 0s4.4 3 6.6 0 4.4-3 6.6 0" />
        <path d="M2.5 18.5c2.2-3 4.4-3 6.6 0s4.4 3 6.6 0 4.4-3 6.6 0" />
        <path d="M12 10.5V3.5M9.2 6.3 12 3.5l2.8 2.8" />
      </svg>
    );
  }

  if (type === 'den_den') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 15c0-3 2.2-5 5-5s5 2 5 5v3H6Z" />
        <path d="M16 18c2.6-.6 4-2.4 4-4.8 0-3-2.2-5.2-5-5.2" />
        <path d="M9.5 10 8 5.5M8 5.5 6.2 4M8 5.5l2-.4" />
        <circle cx="10.5" cy="13" r="1" fill="currentColor" stroke="none" />
        <path d="M3.5 20.5h16" />
      </svg>
    );
  }

  if (type === 'haki') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 17.5 5.8 6.5l4.2 4 2-6 2 6 4.2-4L20 17.5Z" />
        <path d="M4 20.5h16" />
        <path d="M12 1.6v1.8M3.2 8.2l1.6.8M20.8 8.2l-1.6.8" />
      </svg>
    );
  }

  if (type === 'sake') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 5.5h10l1 14H6Z" />
        <path d="M6.6 9.5h10.8M6.4 15h11.2" />
        <path d="M10 5.5V3.5h4v2" />
        <circle cx="12" cy="12.2" r="1.4" />
      </svg>
    );
  }

  if (type === 'bazuca') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 21V9M7 9 4 5M7 9l3-4" />
        <path d="M7 12h4a6 6 0 0 0 6-6" />
        <circle cx="18.5" cy="5.5" r="2.2" />
        <path d="M18.5 2v-1M22 5.5h1M20.9 3.1l.8-.8" />
      </svg>
    );
  }

  if (type === 'mihawk') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 12S6 6.4 12 6.4 21.5 12 21.5 12 18 17.6 12 17.6 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M12 2.5 13 21.5" />
      </svg>
    );
  }
  if (type === 'alma') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c2.6 3.1 4.6 5.4 4.6 8.2A4.6 4.6 0 0 1 12 15.8a4.6 4.6 0 0 1-4.6-4.6C7.4 8.4 9.4 6.1 12 3Z" />
        <path d="M12 15.8V21M9.5 18.5h5" />
        <circle cx="10.4" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="13.6" cy="10.2" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'ancla') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v15" />
        <circle cx="12" cy="3.6" r="1.6" />
        <path d="M8 8.5h8" />
        <path d="M5.5 14c.5 3.6 3.2 5.5 6.5 5.5s6-1.9 6.5-5.5" />
        <path d="m3.8 12.6.5 1.8 1.8-.3M20.2 12.6l-.5 1.8-1.8-.3" />
      </svg>
    );
  }
  if (type === 'ojo') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3.2" />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
        <path d="M5 5.5 6.6 7M19 5.5 17.4 7" />
      </svg>
    );
  }
  if (type === 'pose') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="9.5" cy="12" r="6.2" />
        <circle cx="15.5" cy="12" r="6.2" opacity="0.6" />
        <path d="M9.5 8.6v6.8M6.1 12h6.8" />
        <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'law') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.7" />
        <path d="M12 3.3v2.4M12 18.3v2.4M3.3 12h2.4M18.3 12h2.4" />
        <path d="m7.6 7.6 8.8 8.8M16.4 7.6l-8.8 8.8" opacity="0.45" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }

  if (type === 'shanks') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20 18.5 5.5" />
        <path d="M15.5 2.5 21.5 8.5" />
        <path d="m7.5 13.5 3 3M10.5 10.5l3 3M13.5 7.5l3 3" />
        <path d="M3 21h5" />
      </svg>
    );
  }

  if (type === 'fruta') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 7.8c3.4 0 6 2.3 6 5.6S15.4 21 12 21s-6-4.3-6-7.6 2.6-5.6 6-5.6Z" />
        <path d="M12 7.8c0-2 1.1-3.6 3-4.4" />
        <path d="M12 7.8c-1.2-1.6-3-2.2-4.8-1.9" />
        <path d="M8.4 13.4c1.6.6 2.9 1.8 3.6 3.4M15.6 13.4c-1.6.6-2.9 1.8-3.6 3.4" />
        <path d="M9.6 11.2c.8.3 1.7.3 2.5 0" />
      </svg>
    );
  }
  if (type === 'yami') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M12 3.5a8.5 8.5 0 1 0 8.4 7" />
        <path d="M12 7a5 5 0 1 0 4.9 4.1" />
        <path d="M12 10.6a1.9 1.9 0 1 0 1.9 1.9" />
        <path d="M20.4 4.2 18 6.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16l-5.2 2.9L8 13.1l-4.4-4 5.9-.7Z" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 20.5 7 18.5M19 20.5 17 18.5" />
    </svg>
  );
};


const FlagReel = ({ rolls }) => {
  const target = rolls[0]?.type || 'filo';
  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [display, setDisplay] = useState(target);
  const [done, setDone] = useState(reduced);

  useEffect(() => {
    if (reduced || !rolls.length) return undefined;

    const keys = WILDCARDS.map((wild) => wild.key);
    let index = 0;
    let delay = 55;
    let timer;

    const tick = () => {
      setDisplay(keys[index % keys.length]);
      index += 1;
      delay = Math.min(210, delay * 1.14);
      if (index < 26) {
        timer = setTimeout(tick, delay);
      } else {
        setDisplay(target);
        setDone(true);
      }
    };

    timer = setTimeout(tick, 120);
    return () => clearTimeout(timer);
  }, [rolls, target, reduced]);

  return (
    <div className={`flag-reel${done ? ' is-done' : ''}`}>
      <span className="flag-reel__label">
        {done ? 'La bandera premi\u00f3' : 'Girando la ruleta...'}
      </span>
      <div className="flag-reel__window" aria-hidden="true">
        <span className="flag-reel__icon"><WildIcon type={display} /></span>
      </div>
      {done && (
        <ul className="flag-reel__results">
          {rolls.map((roll, index) => {
            const type = typeof roll === 'string' ? roll : roll.type;
            const kind = typeof roll === 'string' ? 'good' : roll.kind;
            const meta = WILDCARDS.find((wild) => wild.key === type);
            return (
              <li key={`${type}-${index}`} className={`roll-item roll-item--${kind}`}>
                <span className="roll-item__icon"><WildIcon type={type} /></span>
                <span className="roll-item__label">{meta ? meta.label : type}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const KIND_LABEL = { good: 'Buena', neutral: 'Neutral', bad: 'Maldición' };

const TimerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.8 1.7" />
    <path d="M9 2h6" />
  </svg>
);

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

  const [wildcards, setWildcards] = useState({
    filo: 0, alma: 0, ancla: 0, ojo: 0, pose: 0, marea: 0, den_den: 0,
    haki: 0, sake: 0, bazuca: 0, mihawk: 0, law: 0, shanks: 0, fruta: 0, yami: 0, buggy: 0
  });
  const [roundMultiplier, setRoundMultiplier] = useState(1);
  const [yamiActive, setYamiActive] = useState(false);
  const [categoryHint, setCategoryHint] = useState('');
  const [wildModal, setWildModal] = useState(null);
  const [wildBusy, setWildBusy] = useState(false);
  const [anchor, setAnchor] = useState(false);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [disabledOptions, setDisabledOptions] = useState([]);
  const [wildcardUsed, setWildcardUsed] = useState(false);
  const [phase, setPhase] = useState('question');
  const [between, setBetween] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [notice, setNotice] = useState('');
  const [noStreak, setNoStreak] = useState(false);
  const [zeroPoints, setZeroPoints] = useState(false);
  const [hint, setHint] = useState(null);
  const [summary, setSummary] = useState(null);
  const [record, setRecord] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const [claim, setClaim] = useState(null);
  const [named, setNamed] = useState(false);
  const [startRoll, setStartRoll] = useState([]);
  const [startOverlay, setStartOverlay] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [betActive, setBetActive] = useState(false);
  const [betStake, setBetStake] = useState(0);
  const [betsLeft, setBetsLeft] = useState(3);
  const [betBusy, setBetBusy] = useState(false);
  const [autoLeft, setAutoLeft] = useState(10);
  const [confirmExit, setConfirmExit] = useState(false);

  const summaryRef = useRef(null);
  const tutorialRef = useRef(null);
  const questionAreaRef = useRef(null);
  const answeringRef = useRef(false);
  const sailedRef = useRef(false);
  const bootedRef = useRef(false);
  const startingRef = useRef(false);
  const rulesPausedRef = useRef(false);
  const pausedTimeRef = useRef(0);
  const timerDeadlineRef = useRef(0);
  const autoLeftRef = useRef(10);
  const handleAdvanceRef = useRef(null);
  const advancingRef = useRef(false);
  const timeoutHandlerRef = useRef(null);
  const playerName = getPlayerName() || 'Invitado';
  const identity = getArcadeIdentity();

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    // StrictMode monta el efecto dos veces en desarrollo: una sola sesión.
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (!getArcadeIdentity()?.token) {
      navigate('/quiz');
      return;
    }
    startNewGame();
    try {
      setRecord(Number(window.localStorage.getItem('opq:bestSolo') || 0));
    } catch {
      setRecord(0);
    }
  }, []);

  // Reglas: foco dentro del diálogo y scroll del fondo bloqueado mientras están abiertas.
  useEffect(() => {
    if (!showTutorial) return undefined;
    const node = tutorialRef.current;
    const previous = document.activeElement;
    document.body.classList.add('modal-open');
    node?.focus();

    const onKey = (event) => {
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll('button:not([disabled]), [href], [tabindex="0"]')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      if (previous instanceof HTMLElement && previous !== document.body) previous.focus();
    };
  }, [showTutorial]);

  useEffect(() => {
    if (!timerActive || phase !== 'question') return undefined;

    const tick = () => {
      const left = Math.max(0, Math.ceil((timerDeadlineRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        setTimerActive(false);
        timeoutHandlerRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerActive, phase]);

  const startNewGame = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
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
    setWildcards({
      filo: 0, alma: 0, ancla: 0, ojo: 0, pose: 0, marea: 0, den_den: 0,
      haki: 0, sake: 0, bazuca: 0, mihawk: 0, law: 0, shanks: 0, fruta: 0, yami: 0, buggy: 0
    });
    setRoundMultiplier(1);
    setYamiActive(false);
    setCategoryHint('');
    setWildModal(null);
    setWildBusy(false);
    setAnchor(false);
    setStreak(0);
    setPoints(0);
    setMultiplier(1);
    setDisabledOptions([]);
    setWildcardUsed(false);
    setPhase('question');
    setBetween(null);
    setSummary(null);
    setNewRecord(false);
    setClaim(null);
    setStartRoll([]);
    setStartOverlay(false);
    setStartBusy(false);
    setTimerActive(false);
    setTimeLeft(30);
    setTimeLimit(30);
    setBetActive(false);
    setBetStake(0);
    setBetsLeft(3);
    setBetBusy(false);
    setAutoLeft(10);
    setConfirmExit(false);
    answeringRef.current = false;
    sailedRef.current = false;
    rulesPausedRef.current = false;
    pausedTimeRef.current = 0;
    
    try {
      const identity = getArcadeIdentity();
      const data = await startSolo(identity?.token || null);
      setNamed(Boolean(data.named));
      setSessionToken(data.token);
      setLives(data.lives);
      setRound(data.round);
      setTotalRounds(data.total);
      setPoints(data.score || 0);
      setStreak(data.streak || 0);
      setAnchor(Boolean(data.anchor));
      setWildcards(data.wildcards || {});
      setRoundMultiplier(Number(data.round_multiplier) || 1);
      setYamiActive(Boolean(data.yami_active));
      const roll = Array.isArray(data.start_roll) ? data.start_roll : [];
      setStartRoll(roll);
      const maxBets = Number(data.settings?.bets_per_run);
      setBetsLeft(Number.isFinite(maxBets) ? maxBets : 3);
      setTimeLimit(Number(data.time_limit) || 30);
      setTimeLeft(Number(data.time_limit) || 30);
      if (!showTutorial && roll.length) setStartOverlay(true);
      setCurrentQuestion(
        data.question ? { ...data.question, options: shuffleArray(data.question.options) } : null
      );
      setEntrySeed(Math.floor(Math.random() * 3));
    } catch (err) {
      console.error("Error cargando el quiz:", err);
      setError(err.message);
    } finally {
      startingRef.current = false;
      setLoading(false);
    }
  };

  const startTimer = (limit) => {
    const seconds = Math.max(5, Number(limit) || 30);
    setTimeLimit(seconds);
    setTimeLeft(seconds);
    timerDeadlineRef.current = Date.now() + seconds * 1000;
    setTimerActive(true);
  };

  const finishStart = async () => {
    if (startBusy) return;
    if (!sessionToken) {
      setStartOverlay(false);
      return;
    }
    sailedRef.current = true;
    setStartBusy(true);
    try {
      const data = await beginSolo(sessionToken);
      setStartOverlay(false);
      startTimer(data?.time_limit);
    } catch (err) {
      setStartOverlay(false);
      triggerFeedback(err.message.toUpperCase(), 'error');
      startTimer(timeLimit);
    } finally {
      setStartBusy(false);
    }
  };

  const handleTutorialStart = () => {
    setShowTutorial(false);
    // Las reglas pausan el reloj, no solo la vista.
    if (rulesPausedRef.current) {
      rulesPausedRef.current = false;
      timerDeadlineRef.current = Date.now() + pausedTimeRef.current;
      setTimerActive(true);
    }
    // Reabrir las reglas a mitad de partida no debe relanzar la ruleta inicial.
    if (sailedRef.current) return;
    if (startRoll.length) setStartOverlay(true);
    else finishStart();
  };

  const openRules = () => {
    if (timerActive) {
      pausedTimeRef.current = Math.max(0, timerDeadlineRef.current - Date.now());
      rulesPausedRef.current = true;
      setTimerActive(false);
    }
    setShowTutorial(true);
  };

  const saveScore = async (token) => {
    if (!token) return;
    if (!named) {
      setClaim({ none: true });
      return;
    }
    try {
      const result = await claimSoloScore(token);
      setClaim({ ok: true, rank: result.rank, score: result.score });
    } catch (err) {
      setClaim({ error: err.message });
    }
  };

  const triggerFeedback = (text, type) => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 1200);
  };

  const handleAnswer = async (option, timedOut = false) => {
    if (answeringRef.current || selectedOption || gameOver || gameWon || !sessionToken) return;
    if (phase !== 'question') return;

    answeringRef.current = true;
    setTimerActive(false);
    setNotice('');
    setHint(null);
    setNoStreak(false);
    setZeroPoints(false);
    setSelectedOption(timedOut ? '__timeout__' : option);

    let result;
    try {
      result = await answerSolo(sessionToken, option);
    } catch (err) {
      console.error("Error validando respuesta:", err);
      answeringRef.current = false;
      setSelectedOption(null);
      setTimerActive(true);
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
      userAnswer: timedOut ? 'Sin respuesta' : option,
      correctAnswer,
      isCorrect: correct,
      options: currentQuestion.options
    };

    const updatedHistory = [...answeredQuestions, answerRecord];
    setAnsweredQuestions(updatedHistory);

    if (timedOut) {
      triggerFeedback('TIEMPO AGOTADO', 'error');
    } else if (correct) {
      triggerFeedback('¡CORRECTO!', 'success');
    } else {
      triggerFeedback('¡INCORRECTO!', 'error');
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
      setWildcards(result.wildcards || {});
      setRoundMultiplier(1);
      setYamiActive(false);
      setCategoryHint('');
      setTimerActive(false);
      setBetActive(false);
      setBetStake(0);
      setBetsLeft(Number.isFinite(Number(result.bets_left)) ? Number(result.bets_left) : betsLeft);

      if (result.finished) {
        setPhase('finished');
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
        saveScore(sessionToken);
        setTimeout(() => setShowSummary(true), 800);
      } else {
        setRound(result.round);
        setPhase('between');
        setBetween({
          correct: Boolean(result.correct),
          points: result.points_gained || 0,
          timeBonus: result.time_bonus || 0,
          betDelta: result.bet_delta || 0,
          round: result.round,
          roll: Array.isArray(result.roll) ? result.roll : []
        });
        setAutoLeft(10);
        autoLeftRef.current = 10;
        setDisabledOptions([]);
        setCategoryHint('');
        setWildcardUsed(false);
      }

      setSelectedOption(null); 
      setIsCorrect(null);
      answeringRef.current = false;
    }, 1200);
  };

  const handleTimeout = () => {
    if (answeringRef.current || phase !== 'question') return;
    handleAnswer(null, true);
  };
  timeoutHandlerRef.current = handleTimeout;

  const openWildcard = (key) => {
    if (!sessionToken || gameOver || gameWon) return;
    if (phase !== 'between' || wildcardUsed) return;
    if ((wildcards[key] || 0) <= 0) return;
    const meta = WILDCARDS.find((wild) => wild.key === key);
    setWildModal({
      key,
      meta,
      phase: 'confirm',
      category: null,
      categories: [],
      categoryError: '',
      loadingCategories: key === 'ojo'
    });

    if (key === 'ojo') {
      soloCategories().then((categories) => {
        setWildModal((current) => current && current.key === 'ojo' && current.phase === 'confirm'
          ? {
            ...current,
            categories: Array.isArray(categories) ? categories : [],
            loadingCategories: false
          }
          : current);
      }).catch((err) => {
        setWildModal((current) => current && current.key === 'ojo'
          ? { ...current, loadingCategories: false, categoryError: err.message }
          : current);
      });
    }
  };

  const describeResult = (data) => {
    const resolved = data.resolved || data.used;
    if (resolved === 'filo') return 'La siguiente pregunta llegará con dos respuestas cortadas.';
    if (resolved === 'alma') return `Alma de Brook: ahora tienes ${data.lives} vidas.`;
    if (resolved === 'ancla') return 'Ancla echada: el próximo fallo no te devuelve casilla.';
    if (resolved === 'ojo') {
      return data.category
        ? `Ojo de Robin: la siguiente pregunta será de ${data.category}.`
        : 'Ojo de Robin: la siguiente pregunta será de una categoría al azar.';
    }
    if (resolved === 'law') return 'Room de Law: la siguiente pregunta cambia por otra de la misma marea.';
    if (resolved === 'shanks') return 'Haki del Emperador: la siguiente vale ×2, pero tendrás la mitad de tiempo.';
    if (resolved === 'pose') return 'Log Pose doble: esta ronda vale ×2.';
    if (resolved === 'marea') return 'Marea a favor: la siguiente pregunta baja una marea.';
    if (resolved === 'den_den') return 'Den Den Mushi: verás la inicial; la ronda vale ×0.5.';
    if (resolved === 'haki') return 'Haki del Rey: esta ronda vale ×2, pero sin racha.';
    if (resolved === 'sake') return `Barril de sake: +1 vida (${data.lives}) y la ronda vale ×0.5.`;
    if (resolved === 'bazuca') return 'Bazuca de Usopp: dos respuestas cortadas, pero la siguiente sube una marea.';
    if (resolved === 'mihawk') return 'Ojo de Mihawk: verás la respuesta; la ronda vale 0 puntos.';
    if (resolved === 'yami') {
      return `Yami Yami: esta ronda vale ×2, pero un fallo cuesta ${data.life_cost || 2} vidas.`;
    }
    if (resolved === 'buggy') return 'Trampa de Buggy. No ha pasado absolutamente nada.';
    return 'Comodín usado.';
  };

  const confirmWildcard = async () => {
    if (!wildModal || wildBusy) return;
    setWildBusy(true);

    try {
      const data = await playWildcard(sessionToken, wildModal.key, wildModal.category || null);
      const resolved = data.resolved || data.used;

      setWildcards(data.wildcards || wildcards);
      setWildcardUsed(true);

      if (resolved === 'alma') {
        setLives(data.lives ?? lives);
        setLifeBeat(true);
        setTimeout(() => setLifeBeat(false), 900);
      }
      if (resolved === 'ancla') setAnchor(true);
      if (resolved === 'pose') {
        setRoundMultiplier(2);
        setYamiActive(false);
      }
      if (resolved === 'yami') {
        setRoundMultiplier(2);
        setYamiActive(true);
      }
      if (resolved === 'haki') {
        setRoundMultiplier(2);
        setNoStreak(true);
      }
      if (resolved === 'sake') {
        setLives(data.lives ?? lives);
        setRoundMultiplier(0.5);
        setLifeBeat(true);
        setTimeout(() => setLifeBeat(false), 900);
      }
      if (resolved === 'den_den') setRoundMultiplier(0.5);
      if (resolved === 'shanks') setRoundMultiplier(2);
      if (resolved === 'mihawk') {
        setNoStreak(true);
        setZeroPoints(true);
        if (betActive) {
          setBetActive(false);
          setBetStake(0);
          try {
            await placeBet(sessionToken, false);
          } catch {
            // La apuesta se ignora en la respuesta aunque no se cancele.
          }
        }
      }

      const message = describeResult(data);
      setNotice(message);
      setWildModal((current) => current && {
        ...current,
        phase: 'result',
        resolved,
        text: message
      });
    } catch (err) {
      setWildModal((current) => current && {
        ...current,
        phase: 'result',
        resolved: current.key,
        text: err.message
      });
    } finally {
      setWildBusy(false);
    }
  };

  const handleAdvance = async () => {
    if (!sessionToken || phase !== 'between' || advancing || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);

    try {
      const data = await advanceSolo(sessionToken);
      setPhase('question');
      setBetween(null);
      setWildcardUsed(false);
      setNotice('');
      startTimer(data?.time_limit);
      setBetActive(Boolean(data.bet_active));
      setBetStake(Number(data.bet_stake) || 0);
      setBetsLeft(Number.isFinite(Number(data.bets_left)) ? Number(data.bets_left) : betsLeft);
      setCurrentQuestion(
        data.question ? { ...data.question, options: shuffleArray(data.question.options) } : null
      );
      setDisabledOptions(Array.isArray(data.disabled) ? data.disabled : []);
      setCategoryHint(data.category || '');
      setHint(data.hint_type ? { type: data.hint_type, value: data.hint_value } : null);
      setNoStreak(Boolean(data.no_streak));
      setZeroPoints(Boolean(data.zero_points));
      if (data.question && currentQuestion
        && difficultyLevel(data.question.difficulty) > difficultyLevel(currentQuestion.difficulty)) {
        setHakiSpike(true);
        setTimeout(() => setHakiSpike(false), 1800);
      }
      setRoundMultiplier(Number(data.round_multiplier) || 1);
      setYamiActive(Boolean(data.yami_active));
      setAnchor(Boolean(data.anchor));
      setLives(data.lives ?? lives);
      setPoints(data.score ?? points);
      setStreak(data.streak ?? streak);
      setRound(data.round ?? round);
      setEntrySeed(Math.floor(Math.random() * 3));
      setSelectedOption(null);
      setIsCorrect(null);
      answeringRef.current = false;
    } catch (err) {
      triggerFeedback(err.message.toUpperCase(), 'error');
      autoLeftRef.current = 10;
      setAutoLeft(10);
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  };

  handleAdvanceRef.current = handleAdvance;

  useEffect(() => {
    if (phase !== 'between') return;
    autoLeftRef.current = 10;
    setAutoLeft(10);
  }, [phase, between]);

  useEffect(() => {
    if (phase !== 'between' || showTutorial || wildModal || advancing || betBusy) return undefined;
    if (autoLeftRef.current <= 0) return undefined;

    const deadline = Date.now() + autoLeftRef.current * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      autoLeftRef.current = left;
      setAutoLeft(left);
      if (left <= 0) {
        clearInterval(id);
        handleAdvanceRef.current?.();
      }
    };

    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [phase, between, showTutorial, wildModal, advancing, betBusy]);

  useEffect(() => {
    if (phase === 'finished') return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const toggleBet = async () => {
    if (!sessionToken || phase !== 'between' || betBusy) return;
    setBetBusy(true);
    setNotice('');
    try {
      const data = await placeBet(sessionToken, !betActive);
      setBetActive(Boolean(data.bet_active));
      setBetStake(Number(data.bet_stake) || 0);
      setBetsLeft(Number.isFinite(Number(data.bets_left)) ? Number(data.bets_left) : betsLeft);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBetBusy(false);
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
      `Puntos: ${formatBounty(points)} · mejor racha ${stats.bestStreak}`,
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
  const ownedKeys = ownedWildcards(wildcards);
  const owned = WILDCARDS.filter((wild) => ownedKeys.includes(wild.key));
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
          <div
            className="tutorial-modal bounce-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            aria-describedby="tutorial-lede"
            ref={tutorialRef}
            tabIndex={-1}
          >
            <header className="tutorial-head">
              <div className="tutorial-crest" aria-hidden="true"><ModalCompass /></div>
              <h2 id="tutorial-title">El desafío del casillero</h2>
              <p className="tutorial-lede" id="tutorial-lede">
                20 preguntas, 3 vidas y una sola salida. El mar no perdona a quien duda.
              </p>
            </header>

            <div className="tutorial-body" tabIndex={0} role="group" aria-label="Reglas del descenso">
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
                <li>
                  <span className="tutorial-step" aria-hidden="true">5</span>
                  <span><strong>Tiempo.</strong> Cada marea da entre 30 y 50 segundos. Lo que sobre al acertar se convierte en berries extra.</span>
                </li>
              </ul>
              <div className="tutorial-tides" aria-hidden="true">
                <span className="tutorial-tides__label">Fácil</span>
                <span className="tutorial-tides__scale">
                  {[...Array(5)].map((_, i) => <i key={i}></i>)}
                </span>
                <span className="tutorial-tides__label">Imposible</span>
              </div>
            </div>

            <footer className="tutorial-foot">
              <button type="button" className="btn-pirate tutorial-start" onClick={handleTutorialStart}>
                ZARPAR
              </button>
            </footer>
          </div>
        </div>
      )}

      {startOverlay && (
        <div className="start-overlay" role="dialog" aria-modal="true" aria-labelledby="start-overlay-title">
          <div className="start-overlay__card bounce-in">
            <span className="start-overlay__eyebrow">La marea decide</span>
            <h2 id="start-overlay-title">Tu tirada inicial</h2>
            <FlagReel rolls={startRoll} />
            <button type="button" className="btn-pirate" onClick={finishStart} disabled={startBusy}>
              {startBusy ? 'Preparando...' : 'A la primera pregunta'}
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

      {wildModal && (
        <div className="wild-overlay" role="dialog" aria-modal="true" aria-labelledby="wild-title">
          <div className="wild-panel">
            <span className="wild-panel__eyebrow">
              {wildModal.phase === 'result' ? 'Comodín usado' : 'Usar comodín'}
            </span>
            <span className={`wild-panel__kind wild-panel__kind--${wildModal.meta?.kind || 'good'}`}>
              {KIND_LABEL[wildModal.meta?.kind] || 'Comodín'}
            </span>

            <span className="wild-panel__icon">
              <WildIcon type={wildModal.resolved || wildModal.key} />
            </span>

            <h2 id="wild-title" className="wild-panel__title">
              {WILDCARDS.find((wild) => wild.key === (wildModal.resolved || wildModal.key))?.label
                || wildModal.meta?.label}
            </h2>
            <p className="wild-panel__lore">{wildModal.meta?.lore}</p>
            <p className="wild-panel__text">
              {wildModal.phase === 'result' ? wildModal.text : wildModal.meta?.hint}
            </p>

            {wildModal.key === 'ojo' && wildModal.phase === 'confirm' && (
              <div className="wild-panel__categories">
                <span className="wild-panel__section-label">Elige la categoría de la siguiente</span>
                {wildModal.loadingCategories ? (
                  <span className="wild-panel__note">Cargando categorías...</span>
                ) : wildModal.categories?.length ? (
                  <div className="wild-panel__category-grid">
                    {wildModal.categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`wild-category${wildModal.category === category ? ' is-selected' : ''}`}
                        onClick={() => setWildModal((current) => current && { ...current, category })}
                        aria-pressed={wildModal.category === category}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="wild-panel__note">
                    {wildModal.categoryError || 'No hay categorías disponibles; se elegirá una al azar.'}
                  </span>
                )}
              </div>
            )}

            <p className="wild-panel__cost">
              {wildModal.phase === 'result'
                ? `Te quedan ${wildcards[wildModal.key] || 0} de este tipo.`
                : `Se gasta 1 ? tienes ${wildcards[wildModal.key] || 0} ? 1 por pausa.`}
            </p>

            <div className="wild-panel__actions">
              {wildModal.phase === 'result' ? (
                <button type="button" className="btn-pirate" onClick={() => setWildModal(null)}>
                  Continuar
                </button>
              ) : (
                <>
                  <button type="button" className="btn-pirate btn-outline" onClick={() => setWildModal(null)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-pirate"
                    onClick={confirmWildcard}
                    disabled={wildBusy
                      || (wildModal.key === 'ojo' && (
                        wildModal.loadingCategories
                        || (wildModal.categories?.length > 0 && !wildModal.category)
                      ))}
                  >
                    {wildBusy ? 'Usando...' : 'Usar comodín'}
                  </button>
                </>
              )}
            </div>
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

      <div className="quiz-top-actions">
        <button
          type="button"
          className="btn-rules-top"
          onClick={openRules}
        >
          REGLAS
        </button>
        <button
          type="button"
          className="btn-exit-top"
          onClick={() => (phase === 'finished' ? navigate('/') : setConfirmExit(true))}
        >
          <CloseIcon /> ABANDONAR
        </button>
      </div>

      {confirmExit && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-exit-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmExit(false);
          }}
        >
          <div className="confirm-card">
            <h2 id="confirm-exit-title">¿Abandonar la partida?</h2>
            <p>Si sales ahora, esta partida no se guardará en el ranking.</p>
            <div className="confirm-actions">
              <button type="button" className="btn-pirate btn-outline" onClick={() => setConfirmExit(false)}>
                Seguir jugando
              </button>
              <button type="button" className="btn-pirate" onClick={() => navigate('/')}>
                Abandonar
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="solo-rail solo-rail--right" aria-label="Progreso del descenso">
        <span className="solo-rail__cap">Salida</span>
        <div
          className="solo-track"
          role="progressbar"
          aria-label="Progreso de la partida"
          aria-valuemin={1}
          aria-valuemax={totalRounds}
          aria-valuenow={round}
          style={{ '--p': `${progress}%` }}
        >
          <span className="solo-track__fill" aria-hidden="true"></span>
          <span className="solo-track__marker" aria-hidden="true"><RouteCompass /></span>
          {MILESTONES.map((f) => (
            <span
              key={f}
              className={`solo-track__flag${round / Math.max(1, totalRounds) >= f ? ' is-reached' : ''}`}
              style={{ '--b': `${f * 100}%` }}
              aria-hidden="true"
            >
              <Pennant />
            </span>
          ))}
        </div>
        <span className="solo-rail__cap">Fondo</span>
        <span className="solo-rail__round">{padRound(round)} / {padRound(totalRounds)}</span>
      </aside>

      <div className="quiz-main-content">
        {(gameWon || gameOver) && !showSummary && (
          <div className={`quiz-result-card bounce-in${gameWon ? '' : ' quiz-result-card--lost'}`}>
            <h2 className={gameWon ? "win-title" : "lose-title"}>
              {gameWon ? "SABES MUCHO DE ONE PIECE" : "Davy Jones te atrapó"}
            </h2>
            <p className="result-subtitle">
              {gameWon
                ? "Has ganado esta vez... "
                : "El casillero no devuelve a los que dudan. Tu marca queda en el fondo."}
            </p>
            <div className="result-buttons">
              <button className="btn-pirate" onClick={startNewGame}>REINTENTAR</button>
              <button className="btn-pirate btn-outline" onClick={() => navigate('/')}>INICIO</button>
            </div>
          </div>
        )}

        {!gameWon && !gameOver && phase === 'question' ? (
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
              {timerActive && (
                <span
                  className={`quiz-timer${timeLeft <= 10 ? ' is-low' : ''}`}
                  role="timer"
                  aria-label={`Tiempo restante: ${timeLeft} segundos`}
                >
                  <TimerIcon />
                  <span className="quiz-timer__value">{timeLeft}</span>
                </span>
              )}
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
                <span className="quiz-points__value">{formatBounty(points)}</span>
                <span className="quiz-points__label">puntos</span>
                {streak >= 2 && (
                  <span className="quiz-points__streak">racha {streak} · ×{Number(multiplier)}</span>
                )}
                {anchor && <span className="quiz-points__anchor">Ancla echada</span>}
                {betActive && betStake > 0 && (
                  <span className="quiz-points__streak">Doble o nada ? {formatBounty(betStake)}</span>
                )}
                {roundMultiplier !== 1 && (
                  <span className="quiz-points__streak">
                    {yamiActive
                      ? `Yami Yami · ×${roundMultiplier}`
                      : `Marea · ×${roundMultiplier}`}
                  </span>
                )}
                {noStreak && <span className="quiz-points__streak">Sin racha</span>}
                {zeroPoints && <span className="quiz-points__streak">0 puntos</span>}
                {hint && (
                  <span className="quiz-points__streak">
                    {hint.type === 'answer'
                      ? `Respuesta: ${hint.value}`
                      : `Empieza por ${hint.value}`}
                  </span>
                )}
                {categoryHint && (
                  <span className="quiz-points__streak">Categoría · {categoryHint}</span>
                )}
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
            </div>
          </div>

        ) : null}

        {phase === 'between' && !gameOver && !gameWon && (
          <div className="between-panel between-panel--compact bounce-in">
            <header className="between-panel__head">
              <span className={`between-panel__tag${between?.correct ? ' is-ok' : ' is-bad'}`}>
                {between?.correct ? 'Acierto' : 'Fallo'}
              </span>
              <span className="between-panel__points">
                +{formatBounty(between?.points || 0)} berries
              </span>
              {between?.timeBonus > 0 && (
                <span className="between-panel__time">
                  Incluye +{formatBounty(between.timeBonus)} por rapidez
                </span>
              )}
              {between?.betDelta !== 0 && (
                <span className={`between-panel__bet${between.betDelta > 0 ? ' is-win' : ' is-loss'}`}>
                  Apuesta {between.betDelta > 0 ? '+' : '−'}{formatBounty(Math.abs(between.betDelta))}
                </span>
              )}
              <span className="between-panel__round">Ronda {padRound(between?.round || round)}</span>
            </header>

            {between?.roll?.length > 0 && <FlagReel rolls={between.roll} />}

            {owned.length > 0 && (
              <div className="between-wildcards">
                <span className="between-wildcards__label">Comodines · 1 por pausa</span>
                <div className="between-wildcards__grid">
                  {owned.map((wild) => {
                    const count = wildcards[wild.key] || 0;
                    const tipId = `wild-tip-${wild.key}`;
                    return (
                      <button
                        key={wild.key}
                        type="button"
                        className={`between-wild between-wild--${wild.kind}`}
                        onClick={() => openWildcard(wild.key)}
                        disabled={wildcardUsed}
                        aria-label={`${wild.label}, ${count} disponibles`}
                        aria-describedby={tipId}
                      >
                        <span className="between-wild__icon"><WildIcon type={wild.key} /></span>
                        <span className="between-wild__count">{count}</span>
                        <span className="wild-tip" role="tooltip" id={tipId}>
                          <span className={`wild-tip__kind wild-tip__kind--${wild.kind}`}>
                            {KIND_LABEL[wild.kind] || 'Comodín'}
                          </span>
                          <strong className="wild-tip__name">{wild.label}</strong>
                          <span className="wild-tip__effect">{wild.hint}</span>
                          <em className="wild-tip__lore">{wild.lore}</em>
                          <span className="wild-tip__count">Tienes {count}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {wildcardUsed && (
                  <p className="between-wildcards__used">Comodín usado en esta pausa.</p>
                )}
              </div>
            )}

            <div className="between-bet">
              <div className="between-bet__copy">
                <span className="between-bet__title">Doble o nada</span>
                <span className="between-bet__hint">
                  {betActive
                    ? `En juego ${formatBounty(betStake)}. Aciertas +${formatBounty(betStake)}, fallas −${formatBounty(betStake)}.`
                    : zeroPoints
                      ? 'Mihawk no permite apostar en esta ronda.'
                      : betsLeft <= 0
                        ? 'No quedan apuestas en esta partida.'
                        : `Apuestas la base de la siguiente. Quedan ${betsLeft}.`}
                </span>
              </div>
              <button
                type="button"
                className={`between-bet__toggle${betActive ? ' is-on' : ''}`}
                onClick={toggleBet}
                disabled={betBusy || (!betActive && (betsLeft <= 0 || zeroPoints))}
                aria-pressed={betActive}
              >
                {betBusy ? '...' : betActive ? 'Apostada' : 'Apostar'}
              </button>
            </div>

            {notice && (
              <p className="between-notice" role="status">{notice}</p>
            )}

            <div className="between-auto" aria-hidden="true">
              <span className="between-auto__bar">
                <span style={{ width: `${autoLeft * 10}%` }} />
              </span>
              <span className="between-auto__text">Siguiente en {autoLeft} s</span>
            </div>

            <div className="between-actions">
              <button type="button" className="btn-pirate" onClick={handleAdvance} disabled={advancing}>
                {advancing ? 'Abriendo...' : 'Siguiente pregunta'}
              </button>
            </div>
          </div>
        )}

        {showSummary && (
          <div className="summary-overlay">
            <div className="summary-modal summary-modal--poster bounce-in">
              <button
                type="button"
                className="summary-close"
                aria-label="Cerrar resumen"
                onClick={() => { setShowSummary(false); navigate('/'); }}
              >
                <CloseIcon />
              </button>

              <WantedSummary
                innerRef={summaryRef}
                name={playerName}
                points={points}
                won={gameWon}
                avatarKey={identity?.avatar_key}
              />

              <div className="poster-ledger">
                <div className="poster-ledger__row">
                  <span>Aciertos</span>
                  <strong>{calculateStats().correct} / {calculateStats().total}</strong>
                </div>
                <div className="poster-ledger__row">
                  <span>Precisión</span>
                  <strong>{calculateStats().accuracy}%</strong>
                </div>
                <div className="poster-ledger__row">
                  <span>Mejor racha</span>
                  <strong>{calculateStats().bestStreak}</strong>
                </div>
                <div className="poster-ledger__row">
                  <span>Vidas restantes</span>
                  <strong>{calculateStats().livesRemaining}</strong>
                </div>
                <div className="poster-ledger__row">
                  <span>Comodines sin usar</span>
                  <strong>
                    {Object.entries(wildcards)
                      .filter(([key]) => key !== 'yami' && key !== 'buggy')
                      .reduce((sum, [, count]) => sum + (Number(count) || 0), 0)}
                  </strong>
                </div>
                {summary?.won && (
                  <div className="poster-ledger__row">
                    <span>Recompensa extra</span>
                    <strong>{formatBounty((summary.bonus_wildcards || 0) + (summary.bonus_lives || 0))} berries</strong>
                  </div>
                )}
                <div className="poster-ledger__row poster-ledger__row--record">
                  <span>Récord</span>
                  <strong>{newRecord ? 'Nuevo' : `${formatBounty(record)} berries`}</strong>
                </div>
              </div>

              {claim?.none && (
                <div className="summary-save">
                  <p>
                    <strong>Esta marca no se guarda.</strong> Empieza con un nombre para
                    entrar en el ranking del casillero.
                  </p>
                  <Link className="btn-pirate" to="/quiz" navigate={navigate}>Elegir nombre</Link>
                </div>
              )}

              {claim?.ok && (
                <p className="summary-saved">
                  Marca guardada · puesto #{claim.rank}.{' '}
                  <Link to="/ranking" navigate={navigate}>Ver ranking</Link>
                </p>
              )}

              {claim?.error && <p className="op-error">{claim.error}</p>}

              <details className="poster-log">
                <summary>Ver registro del Log Pose</summary>
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
                            <span className="answer correct">Correcta: {answer.correctAnswer}</span>
                          )}
                        </div>
                        <span className="q-difficulty" style={{ background: getDifficultyColor(answer.difficulty) }}>
                          {answer.difficulty}
                        </span>
                      </div>
                      <div className="q-result">{answer.isCorrect ? <CheckIcon /> : <CrossIcon />}</div>
                    </div>
                  ))}
                </div>
              </details>

              <div className="summary-actions">
                <button className="btn-pirate btn-share-image" onClick={handleShareImage} disabled={isGeneratingImage}>
                  {isGeneratingImage ? 'GENERANDO...' : 'COMPARTIR CARTEL'}
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