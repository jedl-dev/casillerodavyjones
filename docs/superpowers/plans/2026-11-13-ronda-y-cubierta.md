# Ronda y cubierta — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar el resultado fantasma de la partida, hacer que dos pestañas puedan ser dos jugadores, suavizar y estabilizar la tarjeta de pregunta (que además se toca para pedir el turno), y limpiar la cubierta: nav sin Sala, logo grande sin anillo y tarjeta "Próximamente".

**Architecture:** Una migración `0005` etiqueta cada resultado con su ronda y deja de pisar `at` al cerrar. El cliente filtra el feedback por ronda con helpers puros y prueba `node --test`. La identidad por pestaña vive en `App.jsx` con `BroadcastChannel`. La cubierta se ajusta en `Navbar.jsx`, `GameMenu.jsx` y su CSS.

**Tech Stack:** React 19 + Vite, Supabase (Postgres 15, RPC `security definer`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-13-ronda-y-cubierta-design.md`

## Global Constraints

- **No se hacen commits.** El usuario no los ha pedido.
- Las migraciones se aplican a mano; no hay `psql` ni Supabase local.
- `anon` solo ejecuta RPC; ninguna tabla nueva.
- Textos en español, voz del proyecto. El modo solitario no se toca.
- `npm test` debe seguir en verde (26 pruebas actuales) en cada tarea.
- Al editar archivos con acentos, usar solo las herramientas de edición (no `Set-Content`).

## Review Focus

- **Acierto que cierra ronda**: el "acierta" debe verse una vez y no repetirse en cada refresco.
- **Fallo que cierra ronda**: no debe aparecer sobre la pregunta nueva, ni con ni sin "Era".
- **Pestaña duplicada**: no debe heredar la partida ni poder borrar al jugador original.
- **Pregunta de una línea**: la tarjeta no debe encogerse ni dejar medio panel vacío.
- **Tocar la tarjeta sin turno**: en `answering`/`steal` la tarjeta no debe pedir el turno al tocarla.

---

### Task 1: Migración 0005 — resultados por ronda y join sin deduplicación

**Files:**
- Create: `supabase/migrations/0005_round_results.sql`

**Interfaces:**
- Consumes: `_advance_room`, `_close_result`, `answer`, `force_timeout`, `join_room` de `0001`-`0004`.
- Produces: `last_result.round`; `_close_result` sin tocar `at`; `join_room(text, text, text)` sin deduplicación de sesión.

- [ ] **Step 1: `_close_result` sin `at`**

`create or replace` con el mismo cuerpo, quitando `'at', now()`; deja solo
`jsonb_build_object('correct_answer', ...)` y el mismo `where` (`->> 'correct_answer' is null`).

- [ ] **Step 2: `answer` y `force_timeout` con `round`**

Copiar los cuerpos de `0003` y añadir `'round', v_room.current_round` a **cada**
`jsonb_build_object` de `last_result` (cuatro en total: acierto, fallo, timeout de
`answering` y timeout de `question`). Nada más cambia.

- [ ] **Step 3: `join_room` sin deduplicación**

Copiar el cuerpo de `0002`, eliminar el bloque que busca sesión existente y el que
lanza "Ya estás en otra sala". Se mantiene: validar nombre, `cleanup_rooms()`,
comprobar sala y estado, plazas, asignar equipo y escribir `client_id`.
Añadir un comentario de una línea:
`-- shortcut: dos jugadores del mismo cliente dejan _client_room ambiguo; el flujo normal no lo provoca.`

- [ ] **Step 4: Comprobar**

Aplicar en el SQL Editor. Expected: `Success. No rows returned`.
`select last_result from public.rooms where status = 'playing' limit 1;` no debe fallar.

---

### Task 2: Helpers de feedback por ronda

**Files:**
- Modify: `src/lib/quizRoom.js`
- Test: `src/lib/quizRoom.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `feedbackForRound(feedback, currentRound) -> feedback | null`
  - `feedbackKey(feedback) -> string`

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `src/lib/quizRoom.test.js` (importar ambos helpers):

- `feedbackForRound({ round: 3, correct: false }, 3)` → devuelve el objeto.
- `feedbackForRound({ round: 2, correct: false }, 3)` → `null`.
- `feedbackForRound({ round: 2, correct: true }, 3)` → devuelve el objeto.
- `feedbackForRound({ round: 2, timeout: true }, 3)` → devuelve el objeto.
- `feedbackForRound({ correct: true }, 3)` → devuelve el objeto (base sin `0005`).
- `feedbackForRound(null, 3)` → `null`.
- `feedbackKey({ at: 'a', correct_answer: null, round: 2 })` distinto de
  `feedbackKey({ at: 'a', correct_answer: 'Zoro', round: 2 })`; e igual para el
  mismo objeto repetido.

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL — no exporta `feedbackForRound`.

- [ ] **Step 3: Implementar**

- `feedbackForRound`: si no hay feedback → `null`. Si `round` no es número → devolver
  el feedback. Si `round === currentRound` → feedback. Si `round === currentRound - 1`
  y (`correct === true` o `timeout === true`) → feedback. En cualquier otro caso `null`.
- `feedbackKey`: `` `${feedback?.at ?? ''}|${feedback?.correct_answer ?? ''}|${feedback?.round ?? ''}` ``.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npm test`
Expected: PASS, 32 pruebas (26 + 6).

---

### Task 3: Ronda — tarjeta tocable, feedback por ronda y entrada suave

**Files:**
- Modify: `src/pages/Room.jsx`
- Modify: `src/pages/Room.css`

**Interfaces:**
- Consumes: `feedbackForRound`, `feedbackKey`, `shouldReveal` (Task 2).
- Produces: estado `buzzMessage`; clases `.duel-ask--live`, `.duel-ask__hint`; el aviso de turno reutiliza `.duel-turn`.

- [ ] **Step 1: Feedback por ronda y dedupe por clave**

- Sustituir `lastResultAt` por `lastResultKey` y comparar `feedbackKey(result)`.
- En el render, `const visibleFeedback = feedbackForRound(feedback, room?.current_round);`
  y usar `visibleFeedback` en el overlay y en la marca `correct/wrong` de las opciones.
- El texto "Era: …" solo aparece si `visibleFeedback.round === room.current_round`.

- [ ] **Step 2: Tarjeta tocable**

- En fase `question`, el contenedor es `<button type="button" className="duel-ask duel-ask--live …"
  onClick={handleBuzz} disabled={!unlocked}>`; en el resto, `<div>`.
- Dentro, el texto de ayuda `.duel-ask__hint` ("Toca la carta para pedir el turno")
  solo en fase `question`.
- Eliminar el botón `.op-buzz` y su bloque.
- `handleBuzz`: si la respuesta es `{won:false}`, `setBuzzMessage('Te adelantaron')`
  y limpiar a los 1,2 s; el mensaje se pinta en `.duel-turn`.

- [ ] **Step 3: Geometría fija y entrada suave**

En `Room.css`:

- `.duel-ask` (sin revelar y revelada) mantiene el **mismo** `padding: 20px 22px`,
  `border: 1px solid transparent`, `min-height: 150px` y `border-radius: 3px`.
  El panel se pinta en `.duel-ask::before` (absolute, inset 0, gradiente y borde),
  con `opacity: 0` y `transition: opacity 0.28s ease`.
- `.duel-ask.is-revealed::before { opacity: 1; }`.
- `.duel-ask.is-revealed` ya **no** anima `padding` ni usa `bubbleIn`; entra con
  `animation: askIn 0.28s cubic-bezier(0.22, 1, 0.36, 1)` sobre `opacity` y
  `translateY(8px)`.
- `.duel-ask--live`: `cursor: pointer`, borde que respira
  (`animation: askBreathe 2.4s ease-in-out infinite`), y `:active` con
  `transform: translateY(1px)`.
- `.duel-ask__hint`: 0.68rem, mayúsculas, `--foam-muted`.
- `.question-text { min-height: 2.6em; }` dentro de `.duel-shell` para que las
  opciones no salten.
- `prefers-reduced-motion`: sin animación y `::before` visible cuando corresponde.

- [ ] **Step 4: Verificar**

Run: `npm run lint`, `npm run build`, `npm test`
Expected: 0 errores, build OK, 32 pruebas.

Manual: tocar la tarjeta pide el turno; en `answering` no hace nada; un acierto se
ve una vez; un fallo no reaparece al entrar la siguiente pregunta; la tarjeta no
cambia de tamaño al revelarse.

---

### Task 4: Pestaña duplicada y salida limpia

**Files:**
- Modify: `src/lib/user.js`
- Modify: `src/App.jsx`
- Modify: `src/pages/Sala.jsx`

**Interfaces:**
- Consumes: `leaveRoom`, `sessionStorage`.
- Produces: `getTabId() -> string`, `resetTabId() -> string`; `opq:room` con `tab_id`.

- [ ] **Step 1: `getTabId` estable por pestaña**

En `user.js`: `let tabId = sessionStorage.getItem('opq:tabId')` al cargar; si no hay,
crear con `crypto.randomUUID()`; `getTabId()` lo devuelve. Se guarda en
`sessionStorage` para sobrevivir a un refresh.

- [ ] **Step 2: Detectar la copia con `BroadcastChannel`**

En `App.jsx`, un efecto al montar:

- `const channel = new BroadcastChannel('opq:tabs');`
- Enviar `{ tabId: getTabId(), born: performance.timeOrigin }`.
- Al recibir un mensaje con el mismo `tabId` y un `born` **mayor** que el propio:
  regenerar el tabId (nueva función `resetTabId()` en `user.js`), borrar
  `opq:room` (`saveRoom(null)`, `setRoomSession(null)`).
- Cerrar el canal al desmontar.

`enterRoom` añade `tab_id: getTabId()` a la sesión guardada; `readRoom` devuelve
`null` si `parsed.tab_id` no coincide con `getTabId()`.

- [ ] **Step 3: Soltar la sala anterior al cambiar**

En `Sala.jsx`, antes de crear/unirse: si `activeRoom` existe, `await leaveRoom(activeRoom.code, activeRoom.token).catch(() => {})`
y `onLeaveRoom()`; después ejecutar la acción. Aplica a crear, buscar y unirse.

- [ ] **Step 4: Verificar**

Run: `npm run lint`, `npm run build`
Expected: OK.

Manual: duplicar una pestaña con partida en curso → la copia cae en la sala sin
sesión y puede unirse como segundo jugador; abandonar en la copia no borra al
original; crear una sala nueva desde el lobby libera la anterior.

---

### Task 5: Cubierta — nav, logo y tarjetas

**Files:**
- Modify: `src/components/Navbar.jsx`
- Modify: `src/pages/GameMenu.jsx`
- Modify: `src/pages/GameMenu.css`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `TABS` sin Sala; tarjeta `.quiz-hatch--sealed` para el próximo juego.

- [ ] **Step 1: Nav**

`TABS` queda en `{ key: 'home', ... }` y `{ key: 'quiz', ... }`. Nada más en
`Navbar.jsx`.

- [ ] **Step 2: Logo sin anillo**

En `GameMenu.jsx`, eliminar `SealRing` y su uso; el `.locker-hero` conserva el
`<img className="locker-logo">`. En `GameMenu.css`, subir el tamaño del logo
(`width: clamp(190px, 24vw, 300px)`), quitar el aro y dejar un resplandor suave
(`filter: drop-shadow(0 18px 40px rgba(95,230,210,0.22))`).

- [ ] **Step 3: Tarjeta del Quiz y Próximamente**

- Reforzar `.quiz-hatch`: más aire interno y `border-color` que sube en `:hover`.
- Añadir tras el hatch del Quiz:

```jsx
<article className="quiz-hatch quiz-hatch--sealed" aria-disabled="true">
  <span className="quiz-hatch__rivets" aria-hidden="true"></span>
  <div className="quiz-hatch__head">
    <span className="quiz-hatch__mark" aria-hidden="true"><CompassIcon /></span>
    <div className="quiz-hatch__intro">
      <h3 className="quiz-hatch__title">El siguiente reto</h3>
      <p className="quiz-hatch__meta">Próximamente</p>
    </div>
  </div>
  <p className="quiz-hatch__lede">Davy D. Jones aún no ha abierto esta puerta.</p>
</article>
```

- `.quiz-hatch--sealed`: opacidad 0.62, borde discontinuo, sin `:hover` activo.
- El contador de la cabecera pasa a `1 abierto · 1 sellado`.

- [ ] **Step 4: Verificar**

Run: `npm run lint`, `npm run build`
Expected: OK.

Manual a 1440 y 390 px: nav con dos pestañas; logo grande sin aro; dos tarjetas,
la segunda sellada y no clicable; nada de scroll horizontal.

---

### Task 6: Verificación del esquema y cierre

**Files:**
- Create: `supabase/tests/0005_verify.sql`
- Modify: `docs/superpowers/specs/2026-11-13-ronda-y-cubierta-design.md` (estado)

**Interfaces:**
- Consumes: Task 1.
- Produces: script de verificación.

- [ ] **Step 1: Escribir `0005_verify.sql`**

Mismo estilo que `0004_verify.sql`. Comprobar:

- `join_room(text, text, text)` existe.
- `answer` y `force_timeout` siguen existiendo con sus firmas.
- Ninguna función `_close_result` escribe `at`: no verificable por catálogo; se
  deja una consulta comentada para revisar el cuerpo con
  `select prosrc from pg_proc where proname = '_close_result';`.

- [ ] **Step 2: Ejecutarlo**

Pegar en el SQL Editor. Expected: `NOTICE: verify: ok`.

- [ ] **Step 3: Pasada completa**

Run: `npm test` → 32 PASS. `npm run lint` → 0 errores (warning previo permitido).
`npm run build` → OK.

Manual: los cinco puntos de Review Focus en 1v1 con dos pestañas.

- [ ] **Step 4: Actualizar el estado del spec**

`Estado: pendiente de aprobación` → `Estado: aprobado e implementado`.
