# Fase 1 — Mesa de juego: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la ronda multijugador entre con coreografía (la tarjeta aparece al terminar de escribirse y solo entonces se responde), muestre avatar e identidad, avise al abandonar, permita reclamar el mando de un host desaparecido y cierre con un resumen de ganador.

**Architecture:** Una migración `0004` añade `last_seen` y las RPC `ping`/`claim_host`. En el cliente, `Room.jsx` gana un flag `revealed`, un diálogo de salida, el latido de presencia y una pantalla de resultado completa. La lógica decidible sin DOM vive en `src/lib/quizRoom.js` con pruebas `node --test`.

**Tech Stack:** React 19 + Vite, Supabase (Postgres 15, RLS, RPC `security definer`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-mesa-de-juego-fase1-design.md`

## Global Constraints

- **No se hacen commits**: el usuario no los ha pedido.
- La migración se aplica a mano en el SQL Editor; no hay Supabase local ni `psql` en esta máquina.
- `anon` solo ejecuta RPC `security definer`; ninguna tabla nueva es legible por `anon`.
- Textos de UI en español, voz del proyecto ("casillero", "marea", "capitán").
- No se toca el modo solitario (`WantedQuiz.jsx`).
- `npm test` debe seguir en verde (15 pruebas actuales) en cada tarea.

## Review Focus

- **Pregunta larga**: la escritura tarda más y el cronómetro de 20 s corre; aun así debe revelarse y poderse responder antes de que venza.
- **`prefers-reduced-motion`**: sin animación, la tarjeta debe aparecer y las opciones habilitarse de inmediato (no bloquearse esperando un `transitionend`).
- **Host que cierra la pestaña en `waiting`**: nadie debe quedar sin poder iniciar; el reclamo debe funcionar y, si nadie está fresco, reintentarse sin error visible.
- **Fantasma único en sala**: al eliminarlo, la sala queda vacía y debe borrarse, no quedar huérfana.
- **Empate**: 1v1 y 4 jugadores deben mostrar empate explícito, no un ganador arbitrario.

---

### Task 1: Migración 0004 — latido de presencia y relevo de mando

**Files:**
- Create: `supabase/migrations/0004_host_heartbeat.sql`

**Interfaces:**
- Consumes: `rooms`, `room_players`, `room_secrets` y `_player_id` de `0001`/`0002`.
- Produces: `room_players.last_seen`; `public.ping(p_code text, p_token uuid) -> jsonb`; `public.claim_host(p_code text, p_token uuid) -> jsonb`; `leave_room` reemplazada; `get_room_state` con `last_seen` por jugador.

- [ ] **Step 1: Columna de presencia**

```sql
alter table public.room_players
  add column if not exists last_seen timestamptz not null default now();

create index if not exists room_players_seen_idx
  on public.room_players (room_id, last_seen);
```

- [ ] **Step 2: RPC `ping` con limpieza de fantasmas en espera**

Firma `ping(p_code text, p_token uuid) returns jsonb`, `security definer`, `search_path = public`:

- Resolver jugador con `_player_id`; si es nulo, `raise exception 'Jugador no válido'`.
- `update room_players set last_seen = now() where id = v_player`.
- Si la sala está en `waiting`: borrar de `room_players` de esa sala los que tengan
  `last_seen < now() - interval '45 seconds'` y no sean el que llama.
- Igual que `leave_room`: si tras el borrado la sala no tiene jugadores, borrar la sala.
- Si la sala tenía host y el host borrado era el único con `is_host`, reasignar al más
  antiguo que quede (evita salas sin capitán al limpiar fantasmas).
- Devolver `jsonb_build_object('ok', true)`.
- `grant execute on function public.ping(text, uuid) to anon, authenticated;`

- [ ] **Step 3: RPC `claim_host`**

Firma `claim_host(p_code text, p_token uuid) returns jsonb`, `security definer`:

- Resolver `v_player`; si es nulo, excepción.
- Bloquear la sala (`select * into v_room ... for update`) y salir con
  `{"ok": false}` si está `finished` o no existe.
- Salir con `{"ok": false}` si el host actual tiene `last_seen > now() - interval '30 seconds'`.
- Salir con `{"ok": false}` si el que llama tiene `last_seen < now() - interval '15 seconds'`
  o si ya es host.
- Exigir que el que llama sea el **más antiguo fresco** distinto del host:
  `select id into v_claimer from room_players where room_id = v_room.id and last_seen > now() - interval '15 seconds' and is_host = false order by joined_at limit 1`;
  si `v_claimer <> v_player` → `{"ok": false}`.
- Transferir: `update room_players set is_host = false where room_id = v_room.id and is_host;`
  y `update room_players set is_host = true where id = v_player;`
- Devolver `{"ok": true, "player_id": v_player}`.
- `grant execute ... to anon, authenticated;`

- [ ] **Step 4: Reemplazar `leave_room` para saltar fantasmas**

`create or replace function public.leave_room(p_code text, p_token uuid)` idéntica a la de
`0003`, cambiando solo la elección de nuevo host:

```sql
select id into v_next_host
from public.room_players
where room_id = v_room.id
  and last_seen > now() - interval '45 seconds'
order by joined_at
limit 1;

if v_next_host is null then
  select id into v_next_host
  from public.room_players
  where room_id = v_room.id
  order by joined_at
  limit 1;
end if;
```

El resto del cuerpo (bloqueo del que se va, robo heredado, avance si no queda nadie
elegible) no cambia.

- [ ] **Step 5: Exponer `last_seen`**

En `get_room_state`, añadir `'last_seen', rp.last_seen` al objeto de cada jugador.

- [ ] **Step 6: Comprobar contra Supabase**

Aplicar el archivo en el SQL Editor. Expected: `Success. No rows returned`.
Comprobar con `select column_name from information_schema.columns where table_name = 'room_players' and column_name = 'last_seen';` → una fila.

---

### Task 2: Helpers puros de identidad, ganador y host

**Files:**
- Modify: `src/lib/quizRoom.js`
- Test: `src/lib/quizRoom.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `initials(name) -> string` (1–2 letras en mayúsculas, `'?'` si vacío).
  - `avatarHue(name) -> number` (0–359).
  - `winnerOf(players, mode) -> { kind: 'player', player, score } | { kind: 'team', team, score } | { kind: 'tie', score }`.
  - `hostAway(players, now, staleMs = 30000, freshMs = 15000) -> { away: boolean, claimerId: string|null }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `src/lib/quizRoom.test.js` (importar `initials`, `avatarHue`, `winnerOf`, `hostAway`):

- `initials('Monkey D. Luffy')` → `'MD'`; `initials('  ')'` → `'?'`.
- `avatarHue('Luffy')` → mismo número que otra llamada con `'Luffy'`, y entre 0 y 359.
- `winnerOf` con `[{id:'a',name:'Luffy',score:5,team:null},{id:'b',name:'Ace',score:1,team:null}]` y `'1v1'` → `kind === 'player'`, `score === 5`, `player.id === 'a'`.
- `winnerOf` con 2v2 `A=5`, `B=3` → `kind === 'team'`, `team === 'A'`, `score === 5`.
- `winnerOf` con 1v1 empatado a 4 → `kind === 'tie'`, `score === 4`.
- `hostAway` con host fresco (`last_seen` hace 5 s) → `away === false`, `claimerId === null`.
- `hostAway` con host mudo 40 s y segundo jugador fresco → `away === true`, `claimerId === '<segundo>'`.
- `hostAway` con host mudo y todos mudos → `away === true`, `claimerId === null`.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — `The requested module './quizRoom.js' does not provide an export named 'initials'`.

- [ ] **Step 3: Implementar en `src/lib/quizRoom.js`**

- `initials`: partir por espacios, primera letra de cada parte, máximo 2, mayúsculas.
- `avatarHue`: el mismo hash que ya usa el lobby de `Room.jsx`
  (`hash = (hash * 31 + charCode) % 360`).
- `winnerOf`: `2v2` agrupa por `team` y suma; el resto ordena por `score`; si el primero
  y el segundo empatan en puntos → `tie`.
- `hostAway`: host = jugador con `is_host`; `away` si no hay host o
  `now - Date.parse(last_seen) > staleMs`; `claimerId` = primer jugador del array
  (ya viene por `joined_at`) que no sea host y tenga
  `now - Date.parse(last_seen) <= freshMs`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npm test`
Expected: PASS, 23 pruebas (15 + 8).

---

### Task 3: Coreografía del boss y avatares en el marcador

**Files:**
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `initials`, `avatarHue` (Task 2).
- Produces: estado `revealed`; clases `.duel-ask`, `.duel-ask.is-revealed`, `.duel-player__avatar`, `.duel-boss-mark`.

- [ ] **Step 1: Sustituir `showOptions` por `revealed`**

El efecto de escritura marca `revealed` con `setRevealed(true)` cuando termina el texto
(después de 120 ms) y lo pone a `false` al llegar una pregunta nueva. Con
`prefers-reduced-motion`, el texto completo y `revealed` se activan en el mismo paso.

- [ ] **Step 2: Envolver la pregunta en el contenedor del boss**

El bloque de la pregunta pasa a:

```jsx
<div className={`duel-ask${revealed ? ' is-revealed' : ''}`}>
  <div className="duel-boss-mark" aria-hidden="true"><CompassMark /></div>
  <h2 className="question-text" key={room.current_round}>{typed}…</h2>
</div>
```

`CompassMark` es un SVG local de 28 px (círculo + aguja). Las opciones y el botón BUZZ
quedan `disabled={!revealed || …}`.

- [ ] **Step 3: Estilos de entrada y de clic**

En `Room.css`:

- `.duel-ask`: sin fondo ni borde; `position: relative`.
- `.duel-ask.is-revealed`: fondo panel (mismo gradiente que `.marea-tag`), borde
  `rgba(95,230,210,0.28)`, `padding: 18px 20px`, `box-shadow` profundo, y
  `animation: bubbleIn 0.42s cubic-bezier(0.16, 1, 0.3, 1)`.
- `.duel-boss-mark`: oculto (`opacity: 0`, `transform: scale(0.6)`); con
  `.is-revealed` → `opacity: 1`, `transform: scale(1)`, `transition: 0.25s 0.12s`.
- `@keyframes bubbleIn` (en `Room.css`): de `opacity 0`, `translateY(14px) scale(0.97)`
  a `opacity 1`, `translateY(0) scale(1)`.
- `.option-btn:active:not(:disabled) { transform: scale(0.97); }` y
  `.option-btn { transition: transform 90ms ease, … }`.
- Bajo `@media (prefers-reduced-motion: reduce)`, `animation: none` y transición 0.

- [ ] **Step 4: Avatar en el marcador**

`PlayerChip` pasa a incluir el avatar:

```jsx
<span className="duel-player__avatar" style={{ '--avatar-hue': avatarHue(player.name) }} aria-hidden="true">
  {initials(player.name)}
</span>
```

Y añade el nombre con su puntuación como hoy. CSS: círculo de 26 px, `border-radius:
50%`, borde turquesa translúcido, `background: hsl(var(--avatar-hue) 45% 22%)`,
inicial en `--font-display` a 0.72rem.

- [ ] **Step 5: Verificar**

Run: `npm run lint`, `npm run build`
Expected: 0 errores; único warning permitido el de `WantedQuiz.jsx`.

Manual (1v1 y 4 jugadores): la tarjeta no está mientras escribe; al terminar entra con
golpe y se habilitan BUZZ y opciones; el clic responde al instante; cada jugador muestra
su inicial y color.

---

### Task 4: Salida con aviso, latido y reclamo de mando

**Files:**
- Modify: `src/lib/quizApi.js`
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `ping` y `claim_host` (Task 1); `hostAway` (Task 2).
- Produces: `pingRoom(code, token)`, `claimHost(code, token)`; clases `.exit-dialog`, `.host-away`, `.host-away__claim`.

- [ ] **Step 1: Wrappers de las RPC**

En `quizApi.js`:

```js
export const pingRoom = (code, token) => rpc('ping', { p_code: code, p_token: token });
export const claimHost = (code, token) => rpc('claim_host', { p_code: code, p_token: token });
```

- [ ] **Step 2: Latido cada 10 s**

En `Room.jsx`, un `useEffect` con `setInterval` de 10 000 ms que llama
`pingRoom(code, token).catch(() => {})` y limpia al desmontar. No debe romper si el
jugador ya no existe (la RPC lanza; se ignora).

- [ ] **Step 3: Diálogo de salida**

Estado `confirmExit`. `handleExit` se parte en:

- `requestExit()`: si `room.status === 'playing'` → `setConfirmExit(true)`; si no,
  `handleExit()` directo.
- `handleExit()`: la llamada actual a `leaveRoom` + `onExit()`.

El botón ABANDONAR y el "← Salir" de la sala llaman a `requestExit`. El diálogo
(`role="dialog"`, `aria-modal="true"`, foco en "Cancelar") muestra:
"Abandonar la partida — La sala sigue sin ti; tu puesto queda libre." con
"Cancelar" y "Abandonar". Escape cierra el diálogo.

- [ ] **Step 4: Aviso de capitán ausente y reclamo**

Calcular `const host = hostAway(players, now)` (usa el estado `now` que ya refresca cada
500 ms). Si `host.away`:

- En el marcador (`playing`) y en el encabezado del lobby (`waiting`), mostrar
  `<span className="host-away">El capitán no responde</span>`.
- Si `host.claimerId === playerId` y no soy host, mostrar un botón "Reclamar mando"
  que llama `claimHost(code, token)` y, si devuelve `{ok:false}`, muestra
  "Otro jugador se ha adelantado" 2 s (estado `claimError`).

- [ ] **Step 5: Estilos**

`Room.css`: `.exit-dialog` como panel centrado sobre `rgba(2,16,19,0.82)` con z-index
9000, botones `btn-pirate` y `btn-outline`; `.host-away` en `--foam-muted` con punto
turquesa parpadeante; `.host-away__claim` como botón pequeño.

- [ ] **Step 6: Verificar**

Run: `npm run lint`, `npm run build`
Expected: OK.

Manual: salir en partida pide confirmación y cancelar no hace nada; cerrar la pestaña
del host en `waiting` deja a los demás con el aviso y el botón de reclamo; al reclamar,
el nuevo capitán ve "Iniciar partida". Cerrar la pestaña del único jugador de una sala
en espera y esperar 45 s (con otra pestaña haciendo ping): la sala debe desaparecer, no
quedar vacía.

---

### Task 5: Resumen de ganador

**Files:**
- Modify: `src/pages/Room.jsx` (bloque `finished`)
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `winnerOf`, `initials`, `avatarHue` (Task 2); `rankPlayers`, `teamTotals`, `shareText`.
- Produces: clases `.duel-result`, `.duel-winner`, `.duel-podium`, `.duel-podium__row`.

- [ ] **Step 1: Reemplazar la tarjeta `finished`**

La pantalla `finished` usa `quiz-page-container` con el mar y el marcado:

- `div.duel-result` (con `ref={resultRef}`) que contiene:
  - `.duel-winner`: avatar 64 px + nombre + puntos; si `winnerOf` devuelve `team`,
    "Equipo A/B" y su total; si `tie`, "Empate en el casillero" y los puntos.
  - `.duel-podium`: lista `rankPlayers(players)` con avatar, `#n`, nombre, equipo
    (si `2v2`) y puntos; la fila propia con `is-me`.
  - `2v2`: totales por equipo (`teamTotals`).
- Acciones: "Compartir resultado" (mismo `handleShare` con html2canvas) y
  "Volver al inicio" (`handleExit`). Sin revancha.

- [ ] **Step 2: Estilos**

`Room.css`: `.duel-result` centrado, `max-width: 620px`, fondo panel translúcido;
`.duel-winner` con avatar grande y tipografía display; `.duel-podium__row` en grid
`auto 1fr auto` con avatar de 30 px y separador inferior; `is-me` con borde turquesa.

- [ ] **Step 3: Verificar**

Run: `npm run lint`, `npm run build`
Expected: OK.

Manual: terminar una partida 1v1, una 2v2 y una de 4; comprobar ganador correcto,
empate cuando toca, podio con avatares, compartir y volver.

---

### Task 6: Verificación del esquema y cierre

**Files:**
- Create: `supabase/tests/0004_verify.sql`
- Modify: `docs/superpowers/specs/2026-11-13-mesa-de-juego-fase1-design.md` (estado)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: script de verificación reproducible.

- [ ] **Step 1: Escribir `0004_verify.sql`**

Mismo estilo que `0003_verify.sql` (`do $$ ... raise notice 'verify: ok'`). Comprobar:

- `room_players.last_seen` existe y es `not null`.
- Existen `ping(text, uuid)` y `claim_host(text, uuid)` con 2 argumentos.
- `anon` no puede insertar/actualizar/borrar en `room_players` directamente.
- `get_room_state` devuelve `last_seen`: no es verificable por catálogo; se añade
  como consulta comentada para ejecutar a mano contra una sala real.

- [ ] **Step 2: Ejecutarlo**

Pegar en el SQL Editor. Expected: `NOTICE: verify: ok`.

- [ ] **Step 3: Pasada completa**

Run: `npm test` → 23 PASS. `npm run lint` → 0 errores (warning previo permitido).
`npm run build` → OK.

Manual en los tres modos: entrada del boss, avatares, salida con aviso, host ausente +
reclamo, resumen de ganador. Comprobar que el modo solitario sigue igual.

- [ ] **Step 4: Actualizar el estado del spec**

Cambiar `Estado: pendiente de aprobación` por `Estado: aprobado e implementado`.
