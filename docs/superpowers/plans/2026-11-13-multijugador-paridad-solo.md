# Multijugador con la piel del solitario — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que 1v1, 2v2 y 4 jugadores se jueguen y se vean como el modo solitario, con turno heredado tras fallo o silencio, marcador lateral, partida rápida por modo y reporte de preguntas.

**Architecture:** Una migración nueva (`0003`) añade la fase `steal`, `blocked_players`, la tabla de reportes y las RPC nuevas. El cliente reutiliza el sistema visual del solo (`WantedQuiz.css`) en `Room.jsx`, añadiendo un marcador lateral. La lógica de UI que se puede probar sin DOM vive en `src/lib/quizRoom.js`.

**Tech Stack:** React 19 + Vite, Supabase (Postgres 15, RLS, RPC `security definer`), `node --test` para pruebas puras.

**Spec:** `docs/superpowers/specs/2026-11-13-multijugador-paridad-solo-design.md`

## Global Constraints

- **No se hacen commits**: el usuario no los ha pedido. Cada tarea termina verificada, no commiteada.
- La migración se aplica a mano en el SQL Editor de Supabase; el repo no tiene CLI ni base local.
- `anon` solo ejecuta RPC `security definer`; ninguna tabla nueva es legible por `anon`.
- Todas las cadenas de UI van en español, con la voz del proyecto ("casillero", "marea", "robo").
- Prohibido filtrar `correct_answer` en `last_result` mientras la ronda siga abierta.
- `npm test` debe seguir en verde (7 pruebas actuales) en cada tarea de Lógica.

## Review Focus

- **Un solo jugador elegible que falla el robo**: la ronda debe avanzar, nunca quedarse en `steal` sin nadie que pueda responder.
- **Dos navegadores llamando `force_timeout` a la vez**: `for update` debe impedir avanzar dos rondas de golpe.
- **Jugador que recarga a mitad de `steal`**: debe reconstruir el estado desde `get_room_state` (fase, `blocked_players`) y poder responder si le toca.
- **Compañero de 2v2 que se va del equipo bloqueado**: si no queda nadie elegible, la ronda avanza.
- **Respuesta correcta durante el robo**: `last_result.correct_answer` debe llegar `null` hasta que la ronda cierre.

---

### Task 1: Migración 0003 — esquema del robo y reportes

**Files:**
- Create: `supabase/migrations/0003_steal_and_reports.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `public.rooms.blocked_players uuid[]`, fase `'steal'` en `rooms_phase_check`, tabla `public.question_reports`, policy `question_reports_admin_read`, y `public.report_question(p_question_id uuid, p_reason text, p_note text, p_client_id text) -> jsonb`. Las RPC del turno son de la Task 2; el wrapper del cliente, de la Task 8.

- [ ] **Step 1: Escribir la migración**

Cabecera del archivo: comentario de una línea explicando que añade el robo y los reportes. Contenido:

```sql
alter table public.rooms
  add column if not exists blocked_players uuid[] not null default '{}';

alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms
  add constraint rooms_phase_check
  check (phase in ('waiting', 'question', 'answering', 'steal', 'finished'));

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reason text not null check (reason in ('respuesta', 'dificultad', 'otro')),
  note text check (char_length(note) <= 280),
  client_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists question_reports_once
  on public.question_reports (question_id, coalesce(client_id, ''), reason);

alter table public.question_reports enable row level security;

drop policy if exists question_reports_admin_read on public.question_reports;
create policy question_reports_admin_read on public.question_reports
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

Sin `grant`: solo la RPC y el rol admin leen/escriben.

- [ ] **Step 2: Crear la RPC de reporte**

`report_question(p_question_id uuid, p_reason text, p_note text, p_client_id text) returns jsonb`, `security definer`, `set search_path = public`:

- Validar `p_reason in ('respuesta', 'dificultad', 'otro')`; si no, `raise exception 'Motivo inválido'`.
- `insert into public.question_reports (question_id, reason, note, client_id) values (p_question_id, p_reason, nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_client_id, '')), '')) on conflict do nothing;`
- Devolver `jsonb_build_object('ok', true)`.
- `grant execute on function public.report_question(uuid, text, text, text) to anon, authenticated;`

Un id de pregunta inexistente viola la FK y devuelve excepción; es aceptable (el cliente siempre manda el id de la pregunta en pantalla).

- [ ] **Step 3: Verificar que aplica limpio**

Ejecutar el archivo completo en el SQL Editor de Supabase.
Expected: `Success. No rows returned`. Si falla por `rooms_phase_check` con otro nombre, listar constraints con `select conname from pg_constraint where conrelid = 'public.rooms'::regclass;` y usar el nombre real.

- [ ] **Step 3: Comprobación estructural**

```sql
select phase from public.rooms limit 0; -- la columna existe
select blocked_players from public.rooms limit 0;
select count(*) from public.question_reports; -- 0
select public.report_question(q.id, 'dificultad', null, 'prueba')
from public.questions q limit 1; -- {"ok": true}
```
Expected: las cuatro consultas corren sin error.

---

### Task 2: RPC de turno con robo

**Files:**
- Modify: `supabase/migrations/0003_steal_and_reports.sql` (añadir al final)

**Interfaces:**
- Consumes: `rooms.blocked_players`, fase `'steal'` (Task 1).
- Produces: `public.buzz(text, uuid)`, `public.answer(text, uuid, text)` y `public.force_timeout(text, uuid)` con el turno heredado; `get_room_state(text)` incluye `room.blocked_players`. `answer` devuelve `{"correct": boolean}` y deja `last_result.correct_answer = null` mientras la ronda siga abierta.

- [ ] **Step 1: Añadir el helper que revela la respuesta al cerrar**

`_close_result(p_room_id uuid, p_question_id uuid)`: rellena `correct_answer` en `last_result` solo si aún no está.

```sql
create or replace function public._close_result(p_room_id uuid, p_question_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rooms
    set last_result = coalesce(last_result, '{}'::jsonb)
      || jsonb_build_object(
           'correct_answer',
           (select correct_answer from public.questions where id = p_question_id))
  where id = p_room_id
    and last_result is not null
    and not (last_result ? 'correct_answer');
$$;
revoke all on function public._close_result(uuid, uuid) from public, anon, authenticated;
```

- [ ] **Step 2: Reescribir `_advance_room`**

Misma firma. Antes de tocar `question_id`, llamar `perform public._close_result(p_room_id, v_room.question_id);`. En ambas ramas (fin de partida y ronda nueva) añadir `blocked_players = '{}'`. El resto del cuerpo no cambia.

- [ ] **Step 3: Reescribir `answer`**

Misma firma y mismas excepciones que hoy, más:

- Turno válido si `phase = 'answering' and buzzed_by = v_player`, **o** `phase = 'steal' and not (v_player = any(v_room.blocked_players))`. Cualquier otro caso: `raise exception 'No es tu turno'`.
- Comprobar el reloj antes de validar el turno (igual que hoy).
- Acierto: `score + 1`, escribir `last_result` con `correct: true`, `correct_answer: null`, `timeout: false`, `at: now()`, y `perform public._advance_room(v_room.id)`. Devolver `jsonb_build_object('correct', true)`.
- Fallo: calcular `v_blocked := v_room.blocked_players || v_player`; si `v_room.mode = '2v2'` añadir también los ids del equipo del jugador (`select coalesce(array_agg(id), '{}') from public.room_players where room_id = v_room.id and team = (select team from public.room_players where id = v_player)`).
  - Escribir `last_result` con `correct: false`, `correct_answer: null`, `timeout: false`, `at: now()`.
  - Si `v_room.phase = 'steal'` (el robo también falló): persistir `blocked_players` y `_advance_room`.
  - Si era `answering`: contar elegibles (`select count(*) from public.room_players where room_id = v_room.id and not (id = any(v_blocked))`).
    - `> 0`: `phase = 'steal'`, `buzzed_by = null`, `blocked_players = v_blocked`, `round_deadline = now() + interval '15 seconds'`.
    - `= 0`: persistir `blocked_players` y `_advance_room`.
  - Devolver `jsonb_build_object('correct', false)`.

- [ ] **Step 4: Reescribir `force_timeout`**

Misma firma. Tras comprobar la sala y que el reloj venció:

- `phase = 'answering'`: bloquear a `buzzed_by` (y a su equipo si `2v2`), escribir `last_result` con `timeout: true`, `correct_answer: null`; si quedan elegibles → `phase = 'steal'`, `buzzed_by = null`, `round_deadline = now() + interval '15 seconds'`; si no, `_advance_room`.
- `phase = 'question'`: `last_result` con `timeout: true`, `correct_answer: null`, `_advance_room`.
- `phase = 'steal'`: **no** sobrescribir `last_result`; solo `_advance_room`.
- Devolver `{"advanced": true}` en los tres casos.

- [ ] **Step 5: Exponer `blocked_players`**

En `get_room_state`, añadir a `room`: `'blocked_players', r.blocked_players`.

- [ ] **Step 6: Comprobar en dos pestañas**

1. Crear sala 1v1, unirse con otra ventana, iniciar.
2. Ventana A pulsa BUZZ y no responde: tras 15 s debe verse `steal` y la ventana B debe poder responder. Consultar `select last_result from public.rooms where code = '<código>';` → `correct_answer` debe ser `null`.
3. Ventana B falla: la ronda avanza y `last_result.correct_answer` ya aparece (misma consulta).
4. **Un solo elegible que falla:** A pulsa BUZZ y falla, B responde mal → la ronda avanza (no queda en `steal`).
5. **Timeout concurrente:** dejar vencer el reloj de `question` con dos pestañas abiertas; `Ronda n/12` debe subir exactamente uno.
6. **2v2 con compañero ausente:** en `steal`, abandonar la sala con el compañero del bloqueado; la ronda debe avanzar sin quedarse colgada.
7. Dejar vencer el reloj de `question`: la ronda avanza sin robo.

Expected: los siete casos se comportan así y ninguna ronda queda atascada.

---

### Task 3: Partida rápida por modo y 12 rondas

**Files:**
- Modify: `supabase/migrations/0003_steal_and_reports.sql` (añadir al final)

**Interfaces:**
- Consumes: `quick_match(text, text)` y `start_room(text, uuid)` de `0002`.
- Produces: `public.quick_match(p_name text, p_client_id text, p_mode text)`; `start_room` sirve 3/3/2/2/2 rondas.

- [ ] **Step 1: Reemplazar `quick_match`**

`drop function if exists public.quick_match(text, text);` y crear `quick_match(p_name text, p_client_id text, p_mode text)`:

- Validar `p_mode in ('1v1','2v2','ffa4')` (si no, `raise exception 'Modo inválido'`).
- Mismo orden que hoy: validar nombre, si `p_client_id` tiene sala (`_client_room`) devolverla, `cleanup_rooms()`.
- Buscar: `where r.status = 'waiting' and r.mode = p_mode and (count players) < r.max_players order by created_at limit 1 for update skip locked`.
- Si hay: `return public.join_room(v_code, v_name, v_client);`
- Si no: `return public.create_room(v_name, p_mode, v_client);`
- `grant execute ... to anon, authenticated`.

- [ ] **Step 2: Ampliar el surtido de `start_room`**

En el `with picks`, cambiar el filtro `rn <= 2` por:

```sql
where (difficulty = 'Fácil' and rn <= 3)
   or (difficulty = 'Intermedia' and rn <= 3)
   or (difficulty = 'Difícil' and rn <= 2)
   or (difficulty = 'Muy Difícil' and rn <= 2)
   or (difficulty = 'Imposible' and rn <= 2)
```

El resto del cuerpo no cambia: si el pool tiene menos, salen menos rondas; solo es error si no hay ninguna.

- [ ] **Step 3: Comprobar**

Ejecutar la migración en Supabase y desde la app:
1. Sala → modo 2v2 → "Buscar partida" debe emparejar o crear una sala `2v2` (el código, al entrar, muestra "Equipos 2 vs 2").
2. Iniciar una partida: `Ronda 1 / 12`.

Expected: ambos.

---

### Task 4: Helpers puros de reparto y turno

**Files:**
- Modify: `src/lib/quizRoom.js`
- Test: `src/lib/quizRoom.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `sideLayout(players, mode) -> { left: Player[], right: Player[] }` — `Player` es `{ id, name, score, team, is_host }`.
  - `canAnswer(room, playerId) -> boolean` — `room` es el objeto `state.room` de `get_room_state` (incluye `phase`, `buzzed_by`, `blocked_players`).
  - `charDelay(char) -> number` — pausa de la máquina de escribir (190 para `.!?`, 110 para `,;:`, 30 para el resto).

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `src/lib/quizRoom.test.js` (importar `sideLayout`, `canAnswer`, `charDelay`):

- `sideLayout` con 2 jugadores y `'1v1'` → `left` = primer jugador, `right` = segundo.
- `sideLayout` con 4 jugadores y `'2v2'` (dos con `team: 'A'`, dos con `'B'`) → los de A a la izquierda, los de B a la derecha.
- `sideLayout` con 4 jugadores y `'ffa4'` → 2 y 2 por orden de llegada.
- `canAnswer({ phase: 'answering', buzzed_by: 'p1' }, 'p1')` → `true`; con `'p2'` → `false`.
- `canAnswer({ phase: 'steal', blocked_players: ['p1'] }, 'p1')` → `false`; con `'p2'` → `true`.
- `canAnswer({ phase: 'question', blocked_players: [] }, 'p1')` → `false`.
- `charDelay('.')` → 190, `charDelay(',')` → 110, `charDelay('a')` → 30.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — `sideLayout is not a function` (o similar).

- [ ] **Step 3: Implementar los tres helpers en `src/lib/quizRoom.js`**

- `sideLayout`: `1v1` → `[0]` / `[1]`; `2v2` → filtrar por `team`; cualquier otro (incluido `ffa4`) → mitad y mitad por orden del array (que ya llega ordenado por `joined_at`).
- `canAnswer`: `phase === 'answering' && room.buzzed_by === playerId`, o `phase === 'steal' && !(room.blocked_players || []).includes(playerId)`.
- `charDelay`: los tres valores del Step 1.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npm test`
Expected: PASS, 14 pruebas (7 anteriores + 7 nuevas).

---

### Task 5: Sala — partida rápida por modo

**Files:**
- Modify: `src/lib/quizApi.js:28-29`
- Modify: `src/pages/Sala.jsx:140-154`

**Interfaces:**
- Consumes: `quick_match(text, text, text)` (Task 3).
- Produces: `quickMatch(name, clientId, mode)`.

- [ ] **Step 1: Cambiar la firma del wrapper**

`export const quickMatch = (name, clientId, mode) => rpc('quick_match', { p_name: name, p_client_id: clientId, p_mode: mode });`

- [ ] **Step 2: Pasar el modo y ajustar la copia**

En `Sala.jsx`, `run(() => quickMatch(name, getClientId(), mode))`. Texto de `.sala-quick__desc`: "Te empareja en una sala abierta del modo elegido. Si no hay, la crea." El botón sigue diciendo "Buscar partida".

- [ ] **Step 3: Verificar**

Run: `npm run lint`
Expected: sin errores nuevos.

Manual: elegir 1v1 → Buscar partida → la sala creada muestra "Duelo 1 vs 1". Repetir con 2v2 y 4 jugadores.

---

### Task 6: Room — shell del solitario y marcador lateral

**Files:**
- Modify: `src/pages/Room.jsx` (solo el bloque `room.status === 'playing'`)
- Create: `src/pages/Room.css`

**Interfaces:**
- Consumes: `sideLayout`, `teamTotals`, `modeLabel` (Task 4/`quizRoom.js`), clases de `WantedQuiz.css` (`quiz-page-container`, `quiz-sea`, `marea-tag`, `quiz-main-content`, `question-text`, `btn-exit-top`).
- Produces: clases `.duel-scoreboard`, `.duel-side`, `.duel-side--right`, `.duel-player`, `.duel-player.is-me`, `.duel-vs`, `.duel-turn`, `.duel-turn--steal` usadas por Task 7.

- [ ] **Step 1: Importar el sistema visual y crear la hoja de la sala**

En `Room.jsx`, `import './WantedQuiz.css'; import './Room.css';`. `Room.css` contiene solo lo nuevo (marcador y turno); todo lo demás sale de `WantedQuiz.css`.

- [ ] **Step 2: Sustituir la tarjeta de pregunta por el shell del solo**

La pantalla `playing` pasa a:

- `div.quiz-page-container` con la clase de dificultad que ya usa el solo (`diff-easy`, `diff-intermediate`, `diff-hard`, `diff-very-hard`, `diff-impossible`).
- `div.quiz-sea` copiado del solo (olas, rayos, corrientes) con `aria-hidden="true"`.
- `button.btn-exit-top` con "ABANDONAR" → `handleExit`.
- `header.duel-scoreboard` en la parte superior: dos `.duel-side` (izquierda/derecha) generadas con `sideLayout(players, room.mode)`, cada jugador como `.duel-player` con nombre y puntos, `is-me` si es `playerId`; en el centro `.duel-vs` con el modo (`modeLabel`) y `Ronda n/12`. En `2v2` mostrar también el total del equipo (`teamTotals`).
- `div.quiz-main-content` con `div.question-area` para la pregunta, la `marea-tag` (dificultad) y el reloj (`remaining`), reutilizando el marcado del solo.
- `div.duel-turn` (debajo del marcador) con el texto del estado: "Pulsa BUZZ" (`question`), "Responde <nombre>" (`answering`), "Robo para <lado>" (`steal`, clase `duel-turn--steal`).
- El bloque `finished` no se toca.
- Eliminar `DIFFICULTY_COLORS` de `Room.jsx` (queda sin uso al usar las clases `diff-*` del solo).

- [ ] **Step 3: Verificar que compila y no hay regresiones**

Run: `npm run lint`
Run: `npm run build`
Expected: OK; el único warning permitido es el de `WantedQuiz.jsx`.

Manual a 1440 px y 390 px: marcador legible, botón ABANDONAR no tapa el marcador, la página no hace scroll horizontal.

---

### Task 7: Room — responder con animación y turno heredado

**Files:**
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `canAnswer`, `charDelay` (Task 4); `room.blocked_players` (Task 2); clases `options-grid`, `option-btn`, `option-letter`, `option-text`, `feedback-fullscreen-overlay`, `success-mark`, `error-mark` de `WantedQuiz.css`.
- Produces: efecto de escritura local `useTypewriter(text, enabled)` dentro de `Room.jsx` (no se exporta).

- [ ] **Step 1: Efecto de escritura**

En `Room.jsx`, un `useEffect` que, cuando cambian `question.question_text` y la fase, revela el texto carácter a carácter con `charDelay`. Si `matchMedia('(prefers-reduced-motion: reduce)').matches`, muestra el texto completo de golpe y las opciones de inmediato. Al terminar, espera 420 ms y marca `showOptions`.

- [ ] **Step 2: Opciones con estado**

Sustituir el `op-options` actual por `div.options-grid` + `button.option-btn`:

- `disabled` si `!showOptions || !canAnswer(room, playerId)`.
- Mientras espera la respuesta del servidor, mantener el botón pulsado con `aria-busy`.
- Al llegar `last_result` de mi respuesta (`player_id === playerId`), marcar `correct` si `correct` y `wrong` si no, durante 1,2 s.

- [ ] **Step 3: Overlay de impacto**

Reutilizar el overlay del solo: `.feedback-fullscreen-overlay.ok|bad` con `+1` / `-1` y texto:

- Acierto: "¡CORRECTO!" (desaparece en 1,2 s).
- Fallo mío en `answering`: "¡FALLÓ! Pasa al robo" — **sin** revelar la respuesta.
- `timeout` con la ronda cerrada: "Tiempo agotado. Era: <correct_answer>" (solo entonces existe el campo).

En `steal` no se usa overlay a pantalla completa: `.duel-turn--steal` es la banda.

- [ ] **Step 4: Botón BUZZ y bloqueo del que falló**

- `phase === 'question'`: conservar el botón BUZZ, ahora con clase `btn-pirate op-buzz`.
- `phase === 'answering'`: las opciones solo se activan para `room.buzzed_by`; al resto se les muestra el aviso del marcador.
- `phase === 'steal'`: activas para `canAnswer`; el bloqueado ve "Ya fallaste esta ronda".

- [ ] **Step 5: Verificar**

Run: `npm run lint`, `npm run build`, `npm test`
Expected: todo en verde.

Manual: partida 1v1 completa con dos ventanas. Comprobar (a) animación al pulsar, (b) el fallo abre el robo y no enseña la respuesta, (c) el rival puede responder, (d) al cerrar la ronda aparece la respuesta correcta, (e) recargar en `steal` reconstruye el estado.

---

### Task 8: Room — reportar pregunta

**Files:**
- Modify: `src/lib/quizApi.js`
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `report_question(uuid, text, text, text)` (Task 1), `getClientId` de `src/lib/user.js`, `question.id` que ya expone `get_room_state`.
- Produces: `reportQuestion(questionId, reason, note, clientId)`.

- [ ] **Step 1: Wrapper de la RPC**

`export const reportQuestion = (questionId, reason, note, clientId) => rpc('report_question', { p_question_id: questionId, p_reason: reason, p_note: note, p_client_id: clientId });`

- [ ] **Step 2: Menú de reporte junto a la marea**

Botón `aria-label="Reportar pregunta"` con un banderín (SVG de 16 px) al lado de `.marea-tag`. Al pulsar abre un `div.report-menu` con tres botones ("Respuesta incorrecta", "Dificultad mal puesta", "Otro") y un `input.op-input` de nota (`maxLength=280`). Elegir razón envía y cierra; muestra "Reporte enviado" 2 s. Error de red → `setError` con el mensaje del wrapper.

- [ ] **Step 3: Verificar**

Run: `npm run lint`, `npm run build`
Expected: OK.

Manual: reportar una pregunta y comprobar en el SQL Editor `select * from public.question_reports order by created_at desc limit 3;`. Repetir el mismo reporte: no debe duplicarse.

---

### Task 9: Verificación final del esquema y de la app

**Files:**
- Create: `supabase/tests/0003_verify.sql`
- Modify: `docs/superpowers/specs/2026-11-13-multijugador-paridad-solo-design.md` (marcar estado aprobado)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: script de verificación reproducible.

- [ ] **Step 1: Escribir `0003_verify.sql`**

Mismo estilo que `0001_verify.sql` (`do $$ ... raise notice 'verify: ok'`). Comprobar:

- `blocked_players` existe en `public.rooms`.
- `rooms_phase_check` admite `'steal'`.
- `question_reports` existe con el índice único `question_reports_once`.
- Existe `report_question(uuid, text, text, text)` y solo tiene `execute` para `anon`/`authenticated` (sin `insert` en la tabla).
- `quick_match` tiene 3 argumentos.
- `_close_result(uuid, uuid)` existe y no es ejecutable por `anon`.

- [ ] **Step 2: Ejecutarlo**

Pegar en el SQL Editor.
Expected: `NOTICE: verify: ok`. Cualquier otro resultado, corregir la migración y repetir.

- [ ] **Step 3: Pasada completa**

Run: `npm test` → 14+ PASS. `npm run lint` → sin errores nuevos. `npm run build` → OK.

Manual, en los tres modos: crear/unirse, jugar una ronda con acierto, una con fallo+robo y una con timeout; reportar una pregunta; abandonar la sala. Comprobar que el lobby y el modo solitario siguen funcionando igual.

- [ ] **Step 4: Actualizar el estado del spec**

Cambiar `Estado: pendiente de aprobación` por `Estado: aprobado e implementado` en la cabecera del spec.
