import React from 'react';

const MARKS = [
  { x: 9.2, y: 29.7 },
  { x: 6.8, y: 14.1 },
  { x: 20, y: 5.5 },
  { x: 33.2, y: 14.1 },
  { x: 30.8, y: 29.7 }
];

const MareaGauge = ({ level = 1, className = '' }) => {
  const current = Math.min(Math.max(level, 1), 5);

  return (
    <svg
      className={`marea-gauge${className ? ` ${className}` : ''}`}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle className="marea-gauge__scope" cx="20" cy="20" r="18.4" />
      <circle className="marea-gauge__ring" cx="20" cy="20" r="14.5" />
      <circle className="marea-gauge__ring" cx="20" cy="20" r="9.5" />
      <circle className="marea-gauge__ring" cx="20" cy="20" r="4.5" />
      <g className="marea-gauge__sweep">
        <path className="marea-gauge__sweep-line" d="M20 20V5.5" />
      </g>
      {MARKS.map((mark, i) => (
        <circle
          key={i}
          className={`marea-gauge__blip${i === current - 1 ? ' is-on' : ''}`}
          cx={mark.x}
          cy={mark.y}
          r={i === current - 1 ? 2.7 : 1.3}
        />
      ))}
    </svg>
  );
};

export default MareaGauge;
