import React from 'react';

const PARTICLES = Array.from({ length: 36 }, () => {
  const size = 2 + Math.random() * 4.5;
  return {
    left: `${Math.random() * 100}%`,
    width: `${size}px`,
    height: `${size}px`,
    '--dur': `${18 + Math.random() * 26}s`,
    '--delay': `${-Math.random() * 40}s`,
    '--drift': `${-60 + Math.random() * 120}px`,
    '--o': `${0.25 + Math.random() * 0.45}`
  };
});

const WAVE =
  'M0 120 C 240 40 480 200 720 120 S 1200 40 1440 120 S 1920 200 2160 120 S 2640 40 2880 120 V320 H0 Z';

const SeaBackground = () => (
  <div className="sea-bg" aria-hidden="true">
    <svg className="sea-cave" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <path className="sea-rock" d="M0 0h560c-28 46-74 72-132 88-78 22-112 58-176 78-70 22-134 12-252 92Z" />
      <path className="sea-rock" d="M1440 0H920c22 42 70 66 126 82 84 22 116 62 182 82 76 22 138 10 212 78Z" />
      <path className="sea-rock" d="M0 900V690c54 10 92 42 134 78 28 24 50 38 86 42 38 4 62-8 96 20 22 18 30 44 26 70Z" />
      <path className="sea-rock" d="M1440 900V700c-48 8-84 38-124 72-30 26-54 40-92 44-38 4-62-8-96 20-18 14-26 38-24 64Z" />
      <g fill="none" stroke="rgba(159, 240, 228, 0.06)" strokeWidth="1">
        <path d="M-60 260 C 240 170 380 360 680 300 S 1180 170 1500 280" />
        <path d="M-60 330 C 220 250 400 430 700 370 S 1180 250 1500 350" />
        <path d="M-60 420 C 260 340 420 520 740 450 S 1200 330 1500 440" />
        <path d="M-60 545 C 280 460 460 650 780 570 S 1220 450 1500 545" />
      </g>
    </svg>

    <div className="sea-rays">
      <span className="sea-ray sea-ray--1"></span>
      <span className="sea-ray sea-ray--2"></span>
      <span className="sea-ray sea-ray--3"></span>
    </div>

    <div className="sea-glow"></div>

    <div className="sea-particles">
      {PARTICLES.map((style, index) => (
        <span key={index} className="sea-particle" style={style}></span>
      ))}
    </div>

    <div className="sea-waves">
      <svg className="sea-wave sea-wave--back" viewBox="0 0 2880 320" preserveAspectRatio="none">
        <path d={WAVE} />
      </svg>
      <svg className="sea-wave sea-wave--mid" viewBox="0 0 2880 320" preserveAspectRatio="none">
        <path d={WAVE} />
      </svg>
      <svg className="sea-wave sea-wave--front" viewBox="0 0 2880 320" preserveAspectRatio="none">
        <path d={WAVE} />
      </svg>
    </div>
  </div>
);

export default SeaBackground;
