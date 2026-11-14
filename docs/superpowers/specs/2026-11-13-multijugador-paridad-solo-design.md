# Multijugador con la piel del modo solitario

Fecha: 2026-11-13
Estado: aprobado e implementado

## Intención

Que 1v1, 2v2 y 4 jugadores se jueguen y se sientan igual que el modo solitario:
mismo mar, misma tipografía, misma respuesta al pulsar una opción. Hoy la sala es
un formulario con tarjetas (`op-*`) y el solo es una experiencia aparte
(`WantedQuiz.css`).

Además tres huecos de producto:

1. El turno no se hereda: si el jugador que pulsó BUZZ no responde, la ronda se
   quema. Debe pasar al rival (o al equipo rival).
2. La partida rápida no deja elegir modo y siempre crea `ffa4`.
3. No hay forma de avisar de una pregunta mal planteada o mal clasificada.

## Objetivos

- Paridad visual y de animaciones entre solo y sala.
- Turno heredado tras fallo o silencio, en los tres modos.
- Marcador lateral con nombres según el modo.
- Partida rápida por modo.
- Reportar pregunta desde la partida multijugador.
- Más variedad de preguntas por partida (12 rondas en vez de 10).

## No objetivos

- No se reescribe el modo solitario ni se extrae un shell compartido (opción B
  descartada por riesgo sobre código que ya funciona).
- No hay chat nuevo, ni espectadores, ni reconexión.
- Reportar pregunta no entra en el modo solitario (decisión mía: el pedido venía
  del bloque de multijugador; extenderlo luego es una llamada más).
- No se toca el lobby (`waiting`): funciona y ya comparte tokens.

## Restricciones

- El estado del turno vive en Postgres. Todo cambio de reglas exige migración
  nueva (`supabase/migrations/0003_*.sql`), que el usuario aplica a mano en el
  SQL Editor. El wrapper `rpc()` ya avisa si la base está desactualizada.
- `anon` solo puede ejecutar RPC `security definer`. Nada de escrituras directas.
- Un mismo navegador no puede estar en dos salas (`0002_client_identity.sql`).

## Enfoques considerados

- **A. Portar el sistema del solo a la sala** (elegido). Se importa
  `WantedQuiz.css` en `Room.jsx` y la pantalla de juego se reconstruye con sus
  clases (`quiz-sea`, `marea-tag`, `options-grid`, `feedback-fullscreen-overlay`),
  añadiendo solo lo nuevo: marcador lateral, estado de robo y botón de reporte.
- **B. Shell compartido** entre solo y sala: más limpio, pero reescribe la
  pantalla que ya funciona y arriesga el modo solitario.
- **C. Animar las tarjetas actuales**: barato y nunca se parecerá al solo.

## Diseño

### 1. Máquina de turnos (migración `0003`)

- `rooms.blocked_players uuid[] not null default '{}'`: quién ya falló o dejó
  pasar esta ronda.
- Fase nueva `steal`: "cualquiera no bloqueado puede responder; el primero gana".
  Una sola ventana de robo por ronda: si el robo también falla, la ronda avanza.
- `buzz` (fase `question`) sigue igual: primero en pulsar gana el turno → `answering`.
- `answer` acepta `answering` (solo el que pulsó) y `steal` (cualquiera no
  bloqueado). Atómico con `update ... where phase in (...) and not (id = any(blocked))`.
  - Acierto: +1 punto (o al equipo, ya lo agrega `teamTotals`) → `_advance_room`.
  - Fallo: el jugador se añade a `blocked_players`; en `2v2` también su compañero;
    si queda alguien elegible → fase `steal`, 15 s; si no → `_advance_room`.
- `force_timeout` deja de avanzar a ciegas:
  - fase `answering` vencida → bloquea al que pulsó (y a su equipo en 2v2) y abre
    `steal` si queda alguien; si no, avanza.
  - fase `steal` vencida → avanza.
  - fase `question` vencida (nadie pulsó) → avanza, como hoy.
- `_advance_room` limpia `blocked_players`.
- `get_room_state` añade `blocked_players` y `question.id` (ya está).
- **La respuesta correcta no sale antes de cerrar la ronda.** `answer` y
  `force_timeout` dejan `last_result.correct_answer = null` mientras se abre el
  robo; `_advance_room` es quien escribe el `correct_answer` final (relanzando el
  `last_result` existente con ese campo). Así el que roba no puede leerla y el
  feedback de un fallo dice "Falló, pasa al rival" sin revelarla.

Consecuencia: en 1v1 hay dos oportunidades por ronda; en 2v2 el robo es del
equipo contrario; en 4 jugadores roban los que no fallaron.

### 2. Variedad de preguntas

`start_room` pasa de `rn <= 2` (10 rondas) a 3 Fácil + 3 Intermedia + 2 Difícil +
2 Muy Difícil + 2 Imposible = 12 rondas, mismo orden por dificultad. El seed tiene
20 preguntas, así que cabe sin duplicados. Si producción tiene menos, se toman las
que haya por dificultad (sin error); solo se lanza error si no hay ninguna.

### 3. Partida rápida por modo

`quick_match(p_name, p_client_id, p_mode)`:
- filtra salas `waiting` del modo pedido con hueco;
- si no hay, crea una de ese modo (en vez de `ffa4`).
`Sala.jsx` reutiliza el selector de modo que ya existe y pasa `mode`.
Si el navegador ya tiene una sala abierta (de cualquier modo), `_client_room` sigue
ganando: se devuelve esa sala, no se crea otra.

### 4. Reportar pregunta

- Tabla `question_reports` (id, question_id, reason, note, client_id, created_at),
  `reason in ('respuesta', 'dificultad', 'otro')`, `note` ≤ 280.
- Índice único `(question_id, client_id, reason)` para no repetir el mismo aviso.
- RPC `report_question(p_question_id, p_reason, p_note, p_client_id)`,
  `on conflict do nothing`, devuelve `{ok: true}` también en el duplicado.
- UI: banderín junto al tag de marea. Abre tres razones + nota opcional y confirma
  con "Reporte enviado". Solo lectura del cliente; nadie aprueba nada en vivo.

### 5. UI de la sala (solo la pantalla `playing`)

- Fondo y ambiente: `quiz-sea`, partículas y tipografía del solo. El lobby queda
  como está.
- Pregunta con el mismo efecto de escritura del solo (respetando
  `prefers-reduced-motion`).
- Opciones: `options-grid` + `option-btn`, con estado correcto/incorrecto y la
  animación de impacto (`feedback-fullscreen-overlay`) al responder. En la ventana
  de robo el aviso es una banda compacta, no el overlay a pantalla completa: taparía
  las opciones mientras corre el reloj.
- Marcador lateral `.duel-scoreboard`:
  - `1v1`: un nombre a cada lado, ronda en el centro.
  - `2v2`: equipo A (dos nombres) a la izquierda, B a la derecha, totales por equipo.
  - `ffa4`: los dos primeros por `joined_at` a la izquierda, los otros dos a la derecha.
- HUD: marea (dificultad), ronda actual y reloj; se reutiliza el estilo del Log Pose.
- Estados de turno visibles:
  - `question`: botón BUZZ grande.
  - `answering`: "Responde <nombre>" y opciones activas solo para él.
  - `steal`: banda "Robo para <lado>" y opciones activas para los elegibles.
- Resultado final: se mantiene el ranking actual, con el enlace de compartir.

### 6. Pruebas

- `src/lib/quizRoom.test.js` (node:test, ya existe): `sideLayout(players, mode)`
  reparte lados A/B/A-B y `canAnswer(room, playerId)` cubre `question`,
  `answering`, `steal` y bloqueados.
- `supabase/tests/0003_verify.sql` al estilo de `0001_verify.sql`: fase `steal`
  existe, `blocked_players` existe, `report_question` revocada para anon salvo
  execute, `quick_match` acepta 3 argumentos.

## Riesgos

- La migración es manual: hasta aplicarla, `buzz`/`answer` nuevos fallan y el
  wrapper muestra "La base de datos no está actualizada".
- Cambia el contrato de `quick_match` (de 2 a 3 argumentos): hay que recrear la
  función; los clientes viejos dejarían de encontrarla, pero es una app de un solo
  despliegue.
- El robo alarga la partida: 12 rondas × hasta 2 respuestas, como mucho 6 min.
- `question_reports` guarda el `client_id` anónimo del navegador. No hay moderación
  ni panel de reportes: es una bandeja para revisar luego (Admin puede leerla).
- `last_result` ya no lleva la respuesta correcta hasta cerrar la ronda; si algo
  lee ese campo antes, verá `null`. Hoy solo lo lee `Room.jsx`.

## Queda para el constructor

- Nombres exactos de las clases nuevas del marcador y del reporte.
- Cómo animar la transición de turno (no se especifica más allá de reutilizar
  `bounce-in` / `pop-in`).
- Copia final en español de los textos de robo y reporte.
