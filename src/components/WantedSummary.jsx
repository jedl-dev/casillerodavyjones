import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { assetCandidates } from '../lib/assets';
import { formatBounty, initials } from '../lib/quizRoom';
import './WantedSummary.css';

function PosterPhoto({ name, avatarKey }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!avatarKey || avatarKey === 'inicial') return undefined;

    (async () => {
      for (const candidate of assetCandidates('avatars', avatarKey)) {
        const ok = await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
          image.src = candidate;
        });

        if (!alive) return;
        if (ok) {
          setSrc(candidate);
          return;
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [avatarKey]);

  if (src) {
    return <img className="wanted-poster__photo-img" src={src} alt="" />;
  }

  return <span className="wanted-poster__photo-initial">{initials(name)}</span>;
}

export default function WantedSummary({
  name,
  points,
  won,
  avatarKey,
  rotation = -1.2,
  innerRef
}) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return undefined;

    const fit = () => {
      text.style.transform = 'scaleX(1)';
      const available = wrap.clientWidth;
      const width = text.getBoundingClientRect().width;
      if (width > available) text.style.transform = `scaleX(${available / width})`;
    };

    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(wrap);

    return () => observer?.disconnect();
  }, [name]);

  return (
    <div
      className="wanted-poster"
      ref={innerRef}
      style={{ '--wanted-rotate': `${rotation}deg` }}
      role="img"
      aria-label={`Cartel de ${name} con ${formatBounty(points)} berries`}
    >
      <span className="wanted-poster__photo">
        <PosterPhoto key={avatarKey || 'inicial'} name={name} avatarKey={avatarKey} />
      </span>

      <span className="wanted-poster__template" aria-hidden="true" />

      <span className={`wanted-poster__stamp${won ? ' is-win' : ' is-loss'}`}>
        {won ? 'VICTORIA' : 'DERROTA'}
      </span>

      <span className="wanted-poster__pin" aria-hidden="true" />

      <span className="wanted-poster__name-wrap" ref={wrapRef}>
        <span className="wanted-poster__name" ref={textRef}>{name}</span>
      </span>

      <span className="wanted-poster__bounty">
        <img src="/assets/quiz/belly.png" alt="" aria-hidden="true" />
        <span>{formatBounty(points)}</span>
      </span>
    </div>
  );
}
