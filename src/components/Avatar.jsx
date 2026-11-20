import React, { useState } from 'react';
import { initials } from '../lib/quizRoom';
import { assetCandidates } from '../lib/assets';
import './Avatar.css';

function AssetImage({ folder, assetKey, className }) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const candidates = assetCandidates(folder, assetKey);

  if (!assetKey || assetKey === 'inicial' || index >= candidates.length) return null;

  return (
    <img
      className={`${className}${loaded ? ' is-loaded' : ''}`}
      src={candidates[index]}
      alt=""
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(false);
        setIndex((current) => current + 1);
      }}
    />
  );
}

export default function Avatar({
  username,
  avatarKey = 'inicial',
  frameKey = 'inicial',
  size = 'md',
  className = ''
}) {
  const key = avatarKey || 'inicial';

  return (
    <span className={`avatar avatar--${size}${className ? ` ${className}` : ''}`}>
      <span className="avatar__initial" aria-hidden="true">{initials(username)}</span>

      <AssetImage
        key={`avatar-${key}`}
        folder="avatars"
        assetKey={key}
        className="avatar__img"
      />

      <AssetImage
        key={`frame-${frameKey}`}
        folder="frames"
        assetKey={frameKey}
        className="avatar__frame"
      />
    </span>
  );
}
