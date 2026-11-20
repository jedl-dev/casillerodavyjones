// Catálogo de juegos del casillero. Añadir un juego es añadir una entrada aquí.
export const GAMES = [
  {
    id: 'quiz',
    name: 'Quiz del casillero',
    short: 'el quiz',
    modes: [
      { id: 'solo', name: 'Solo', detail: 'Tú contra el casillero.', meta: '20 preguntas · 3 vidas', to: '/quiz', art: 'quiz-solo' },
      { id: 'duel', name: 'Multijugador', detail: 'Duelo 1 vs 1.', meta: 'Por código · partida rápida', to: '/sala?game=quiz', art: 'quiz-multijugador' }
    ]
  }
];
