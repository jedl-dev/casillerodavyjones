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
    <svg className="sea-contours" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="rgba(143, 200, 210, 0.06)" strokeWidth="1">
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
