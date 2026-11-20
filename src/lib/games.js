// Catálogo de juegos del casillero. Añadir un juego es añadir una entrada aquí.
export const GAMES = [
  {
    id: 'quiz',
    name: 'Quiz del casillero',
    short: 'el quiz',
    modes: [
      { id: 'solo', name: 'Solo', detail: 'Tú contra el casillero.', to: '/quiz' },
      { id: 'duel', name: 'Multijugador', detail: 'Duelo 1 vs 1.', to: '/sala?game=quiz' }
    ]
  }
];
