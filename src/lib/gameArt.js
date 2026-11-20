import { useEffect, useState } from 'react';
import { findAsset } from './assets';

// Arte de juegos: deja el archivo en public/assets/juegos con el mismo nombre base.
// Si subes un .webp (o .png/.jpg) con ese nombre, sustituye al SVG de ejemplo.
export const ART_SLOTS = {
  'quiz-solo': { file: 'quiz-solo', label: 'Quiz · Solo' },
  'quiz-multijugador': { file: 'quiz-multijugador', label: 'Quiz · Multijugador' }
};

const probes = new Map();

export function resolveArt(key) {
  if (!ART_SLOTS[key]) return Promise.resolve(null);
  if (!probes.has(key)) probes.set(key, findAsset('juegos', ART_SLOTS[key].file));
  return probes.get(key);
}

// Resuelve una lista de claves una vez y comparte el resultado entre montajes.
export function useGameArt(keys = []) {
  const signature = keys.join('|');
  const [art, setArt] = useState({});

  useEffect(() => {
    let alive = true;
    Promise.all(signature.split('|').filter(Boolean).map(async (key) => [key, await resolveArt(key)]))
      .then((entries) => {
        if (alive) setArt(Object.fromEntries(entries));
      });
    return () => {
      alive = false;
    };
  }, [signature]);

  return art;
}
