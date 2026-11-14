# Ronda sin máquina de escribir y 1v1 único — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar el texto a máquina (pregunta completa con entrada aleatoria), anunciar el turno y mantener la pregunta legible, adaptar el acento a la marea, cerrar la partida si el rival abandona, dejar el multijugador en 1v1, recuperar el retroceso del solo y enriquecer el resumen con estadísticas en memoria.

**Architecture:** Una migración `0006` restringe los modos, añade el cierre por abandono y reescribe `answer_solo` con retroceso. En el cliente se elimina el efecto de escritura en las dos pantallas, se añade una entrada CSS aleatoria y un aviso de turno, y el resumen agrega resultados observados en memoria. La cubierta ajusta logo y nav.

**Tech Stack:** React 19 + Vite, Supabase (Postgres 15, RPC), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-ronda-sin-maquina-y-1v1-design.md`

## Global Constraints

- **No se hacen commits.** El usuario no los ha pedido.
- Migraciones manuales; no hay `psql` ni Supabase local.
- `anon` solo ejecuta RPC. Sin columnas nuevas de estadísticas.
- Textos en español, voz del proyecto.
- `npm test` debe seguir en verde (33 pruebas actuales) en cada tarea, salvo las
  pruebas que esta fase elimina en la última tarea.

## Review Focus

- **Pregunta larga**: entra completa, sin espera, y las opciones están activas en el
  primer frame.
- **Movimiento reducido**: con `prefers-reduced-motion` no hay animación de entrada y
  nada bloquea el clic.
- **Turno del rival**: el que no responde ve el aviso con el nombre, y la pregunta
  sigue legible; el overlay no tapa ni bloquea clics.
- **Retroceso en la ronda 1**: fallar ahí deja la ronda en 1 con otra pregunta (o la
  misma si no hay candidata), sin vidas negativas.
- **Abandono con la partida ya terminada**: no debe reabrir ni cambiar el resultado.

---

### Task 1: Migración 0006 — solo 1v1, abandono y retroceso

**Files:**
- Create: `supabase/migrations/0006_duel_only_abandon.sql`

**Interfaces:**
- Consumes: `create_room`, `join_room`, `start_room`, `quick_match`, `_client_room`, `leave_room`, `answer_solo`.
- Produces: rechazo `'Modo no disponible'` para modos ≠ `1v1`; cierre por abandono con `last_result.forfeit`; `answer_solo` con retroceso.

- [ ] **Step 1: Restringir modos**

`create_room` (firma de `0002`): antes de `_client_room`, `if p_mode <> '1v1' then raise exception 'Modo no disponible'; end if;`.
`join_room` (firma de `0005`): tras cargar la sala, `if v_room.mode <> '1v1' then raise exception 'Modo no disponible'; end if;`.
`start_room` (firma de `0003`): mismo chequeo tras cargar la sala.
`quick_match` (firma de `0003`): validar `p_mode = '1v1'`.
`_client_room` (firma de `0002`): añadir `and r.mode = '1v1'` al `where`.

- [ ] **Step 2: Abandono con victoria**

En `leave_room` (firma de `0004`), tras la migración de host y antes del manejo de
fases:

```sql
if v_room.status = 'playing' and v_room.mode = '1v1'
   and (select count(*) from public.room_players where room_id = v_room.id) = 1 then
  update public.rooms
    set status = 'finished', phase = 'finished',
        question_id = null, round_deadline = null, buzzed_by = null,
        last_result = jsonb_build_object(
          'forfeit', true,
          'player_name', (select name from public.room_players
                          where room_id = v_room.id limit 1),
          'at', now())
    where id = v_room.id;
  return;
end if;
```

Ojo: `v_room` se leyó antes de borrar; usar los valores de `v_room` para
`status`/`mode` es correcto.

- [ ] **Step 3: Retroceso en `answer_solo`**

Reescribir la rama de fallo:

- `v_session.lives := v_session.lives - 1`.
- `lives <= 0` → `v_status := 'lost'`.
- Si no: `v_status := 'playing'; v_round := greatest(1, v_session.current_round - 1);`
  y sustituir hasta dos posiciones de `v_session.question_ids` por preguntas nuevas
  que no estén en la lista:
  1. la posición `v_round`, con una pregunta de la misma dificultad que la que había
     en esa posición;
  2. si `v_round <> v_session.current_round`, la posición `v_session.current_round`,
     con una pregunta de la misma dificultad que la fallada y distinta de la elegida
     en (1).
  Cada búsqueda: `select q.id into v_pick from public.questions q where q.difficulty = v_diff and q.id <> all(v_ids) order by random() limit 1;`
  Si `v_pick` es nulo, no se toca esa posición. Tras elegir, actualizar el array en
  memoria para que la segunda búsqueda la excluya.
- El resto (acierto suma, `won` al llegar al final, `last_result`, devolución de la
  pregunta de `v_round`) se mantiene.

- [ ] **Step 4: Comprobar**

Aplicar en el SQL Editor. Expected: `Success. No rows returned`.
`select * from public.rooms where mode <> '1v1' and status = 'waiting';` puede
devolver filas antiguas; no es un error.

---

### Task 2: Helpers puros de entrada y estadísticas

**Files:**
- Modify: `src/lib/quizRoom.js`
- Test: `src/lib/quizRoom.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `entryClass(seed) -> 'ask-enter--top' | 'ask-enter--left' | 'ask-enter--right'`
  - `duelStatsFor(results) -> { byPlayer: { [id]: { correct, wrong, streak, best } }, rounds: number }`

- [ ] **Step 1: Pruebas que fallan**

- `entryClass(0)` → `'ask-enter--top'`, `1` → left, `2` → right, `3` → top.
- `duelStatsFor([])` → `{ byPlayer: {}, rounds: 0 }`.
- Dos resultados de `p1` (acierto y fallo en rondas 1 y 2) → `correct: 1`, `wrong: 1`, `streak: 0`, `best: 1`, `rounds: 2`.
- Acierto, acierto, fallo (rondas 1-3) → `best: 2`, `streak: 0`.
- `timeout` con `player_id: 'p2'` → `wrong: 1` de `p2`.
- `timeout` sin `player_id` → no añade jugador; `rounds` cuenta la ronda.

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `npm test` → FAIL: no exporta `entryClass`.

- [ ] **Step 3: Implementar**

- `entryClass`: `['top', 'left', 'right'][Math.abs(seed) % 3]` con prefijo `ask-enter--`.
- `duelStatsFor`: recorrer `results`; por cada uno con `player_id`, si `correct`
  incrementa `correct` y `streak` (actualizando `best`), si no incrementa `wrong` y
  reinicia `streak`. `rounds` = tamaño del conjunto de `round` no nulos.

- [ ] **Step 4: Ejecutar y ver pasar**

Run: `npm test` → PASS (33 + 5).

---

### Task 3: Modo solo sin máquina de escribir

**Files:**
- Modify: `src/pages/WantedQuiz.jsx`
- Modify: `src/pages/WantedQuiz.css`

**Interfaces:**
- Consumes: `entryClass` (Task 2).
- Produces: `--deck` en el contenedor; clase `ask-enter--*` en la tarjeta de pregunta.

- [ ] **Step 1: Quitar el efecto de escritura**

- Eliminar `displayedQuestion`, `showOptions` y el `useEffect` que escribe; pintar
  `currentQuestion.question_text` completo.
- Las opciones se habilitan con `selectedOption === null` (ya no esperan `showOptions`).
- Estado `entry` que se recalcula al cambiar `round`/`question`: `useState(() => Math.random())`.

- [ ] **Step 2: Entrada y acento**

- La tarjeta de la pregunta lleva `${entryClass(entry)}` y el contenedor
  `style={{ '--deck': getDifficultyColor(currentQuestion.difficulty) }}`.
- "La marea sube" solo si `difficultyLevel(new) > difficultyLevel(previous)`.

- [ ] **Step 3: CSS compartido**

En `WantedQuiz.css`, añadir `@keyframes askDropIn`, `askSlideLeft`, `askSlideRight`
(320 ms, `cubic-bezier(0.22, 1, 0.36, 1)`) y las clases `.ask-enter--top|left|right`.
Sustituir los acentos fijos de `.marea-tag` y `.question-text` por
`var(--deck, var(--lum))` donde corresponda. Bajo `prefers-reduced-motion`, sin
animación.

- [ ] **Step 4: Verificar**

Run: `npm run lint`, `npm run build`
Manual: en solo, la pregunta aparece completa y clicable al instante; la entrada varía
entre partidas; el acento cambia con la dificultad.

---

### Task 4: Ronda 1v1 sin escritura, turno visible y sin oscurecer

**Files:**
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `entryClass` (Task 2); `DIFF_COLOR` existente.
- Produces: clases `.duel-turn--turn`, `ask-enter--*`; `--deck` en el contenedor.

- [ ] **Step 1: Fuera escritura y gating**

- Eliminar `typed`, `revealed`, `setRevealed`, el `useEffect` de escritura y
  `shouldReveal`; la tarjeta pinta `question.question_text` completo.
- Opciones y BUZZ habilitados desde el primer frame (`disabled` solo por turno o
  `pending`).
- Estado `entry` recalculado al cambiar de ronda.

- [ ] **Step 2: Aviso de turno**

En `answering`, `.duel-turn--turn` con el avatar (`avatarHue`/`initials`) del que
respondió y el texto `<nombre> tiene el turno`; si es el mío, "Es tu turno". En
`steal`, la banda actual. Entrada con `bounce-in`.

- [ ] **Step 3: No oscurecer ni bloquear**

- `.feedback-fullscreen-overlay { pointer-events: none; }`.
- No pintar el overlay si `canAnswer(room, playerId)` es verdadero (quien debe
  responder nunca lo ve encima).
- Tarjeta revelada con fondo `rgba(10,58,69,0.94)` / `rgba(3,21,27,0.97)`, borde
  `var(--deck, var(--lum))` y `text-shadow` contenido.

- [ ] **Step 4: Fuera 2v2 de la UI y acento**

- Eliminar `totals`/`teamTotals`, los textos de equipo y el sufijo `(A/B)` del podio;
  `requiredPlayers` fijo a 2; `MODE_RULES` solo con `1v1`.
- `style={{ '--deck': DIFF_COLOR[question.difficulty] || 'var(--lum)' }}` en el
  contenedor; usar `var(--deck)` en tarjeta, banda de turno, avatar propio y marcador.

- [ ] **Step 5: Verificar**

Run: `npm run lint`, `npm run build`, `npm test`.
Manual: pregunta completa y clicable; aviso de turno para ambos; sin capa oscura; el
acento sigue a la marea; el rival ve las opciones desactivadas pero la pregunta legible.

---

### Task 5: Sala solo con 1v1

**Files:**
- Modify: `src/pages/Sala.jsx`

**Interfaces:**
- Consumes: `quickMatch` (Task 1 la restringe en servidor).
- Produces: modo fijo; sin selector.

- [ ] **Step 1: Quitar modos**

- `MODES` se reduce a la información del duelo; se elimina el estado `mode` y el
  bloque `sala-modes`; en su lugar, una línea `.sala-mode-fixed`:
  "Duelo 1 vs 1 · Dos jugadores, mismas preguntas".
- `createRoom(name, '1v1', getClientId())` y `quickMatch(name, getClientId(), '1v1')`.
- Ajustar el copy del bloque rápido: "Te empareja con otro jugador en un duelo 1 vs 1."

- [ ] **Step 2: Verificar**

Run: `npm run lint`, `npm run build`
Manual: la Sala muestra solo el duelo; crear y buscar partida funcionan.

---

### Task 6: Resumen de 1v1 con estadísticas y abandono

**Files:**
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `duelStatsFor` (Task 2), `feedbackKey`, `last_result.forfeit` (Task 1).
- Produces: `.duel-stats`, `.duel-forfeit`; estado `observed` (array de resultados).

- [ ] **Step 1: Acumular resultados**

- Estado `observed` (array). En el efecto que ya detecta un resultado nuevo, añadir el
  objeto a `observed` (deduplicado por `feedbackKey`).
- `const stats = duelStatsFor(observed);` y
  `const complete = stats.rounds >= room.total_rounds;` (o `>=` rondas jugadas).

- [ ] **Step 2: Pantalla final**

- Si `room.last_result?.forfeit`, línea `.duel-forfeit`:
  "**<nombre> abandonó el casillero.** Victoria por abandono."
- Si `complete`, rejilla `.duel-stats` por jugador: aciertos, fallos, precisión,
  mejor racha. Si no, se omite por completo.
- Copy de cierre: el ganador con su marcador y una frase del proyecto; empate:
  "El casillero no corona a nadie esta vez."

- [ ] **Step 3: Verificar**

Run: `npm run lint`, `npm run build`
Manual: resumen con estadísticas completas; recargar a mitad y terminar → resumen sin
estadísticas; abandonar → victoria por abandono con el nombre del que se fue.

---

### Task 7: Cubierta — logo y nombre

**Files:**
- Modify: `src/pages/GameMenu.css`
- Modify: `src/components/Navbar.jsx`

**Interfaces:**
- Consumes: nada.
- Produces: animación `logoArrive`; subtítulo "de Davy T. Jones".

- [ ] **Step 1: Logo**

`.locker-logo` entra con `@keyframes logoArrive` (de `rotate(-6deg) scale(0.94)` a
`rotate(0) scale(1)`, 420 ms) y conserva el resplandor. Sin giro continuo.

- [ ] **Step 2: Nombre**

En `Navbar.jsx`, el subtítulo pasa a `de Davy T. Jones`.

- [ ] **Step 3: Verificar**

Run: `npm run lint`, `npm run build`
Manual a 1440 y 390: el logo entra y se asienta, el nav dice "Davy T. Jones".

---

### Task 8: Limpieza, verificación del esquema y cierre

**Files:**
- Create: `supabase/tests/0006_verify.sql`
- Modify: `src/lib/quizRoom.js` y `src/lib/quizRoom.test.js` (borrar helpers muertos)
- Modify: `docs/superpowers/specs/2026-11-13-ronda-sin-maquina-y-1v1-design.md` (estado)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `0006_verify.sql`.

- [ ] **Step 1: Borrar helpers sin uso**

Eliminar `charDelay` y `shouldReveal` de `quizRoom.js` y sus pruebas (ya no los usa
nadie; comprobar con búsqueda antes de borrar).

- [ ] **Step 2: `0006_verify.sql`**

Comprobar: `create_room` y `join_room` contienen `'Modo no disponible'` (vía
`prosrc`), `answer_solo` contiene `greatest(`, `leave_room` contiene `forfeit`, y
`_client_room` contiene `'1v1'`.

- [ ] **Step 3: Pasada completa**

Run: `npm test` → PASS con las pruebas nuevas y sin las dos borradas.
`npm run lint` → 0 errores (warning previo permitido). `npm run build` → OK.

Manual: los cinco Review Focus.

- [ ] **Step 4: Estado del spec**

`Estado: pendiente de aprobación` → `Estado: aprobado e implementado`.
