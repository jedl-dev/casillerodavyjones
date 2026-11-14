# Ronda y cubierta — arreglos de partida, tarjeta suave y navegación

Fecha: 2026-11-13
Estado: pendiente de aprobación

## Intención

Jugar una ronda no se siente bien todavía: la tarjeta se redimensiona mientras
escribe, el BUZZ vive en una barra sosa, y al cerrar una ronda el resultado de la
anterior se pinta encima de la pregunta nueva. Además, en la cubierta sobra una
pestaña (Sala), el logo está pequeño y con un anillo que estorba, y no hay muestra
del siguiente juego.

## Causas encontradas (antes de tocar nada)

1. **Resultado fantasma (real, probado en código).** `_close_result`
   (`0003_steal_and_reports.sql:76-92`) escribe `at: now()` al cerrar la ronda. El
   cliente deduplica el feedback por `result.at` (`Room.jsx:253`), así que ese
   cierre parece un resultado nuevo y pinta "X falla. Era: …" sobre la pregunta
   siguiente. Es lo que se lee como "marca que fallamos y le da la respuesta al rival".
2. **Dos pestañas = mismo jugador.** `join_room` devuelve la sesión existente si el
   `client_id` coincide (`0002_client_identity.sql:137-160`), y además bloquea
   entrar a otra sala. Al duplicar pestaña, las dos son el mismo jugador: cualquiera
   responde y el fallo de una bloquea a la otra. De ahí el "no me deja responder".
3. **La tarjeta cambia de tamaño**: gana padding al revelarse (`Room.css`), así que
   todo lo que hay debajo salta. La entrada usa rebote y escala: se siente dura.

## Objetivos

- Un solo jugador por pestaña aunque compartan navegador; dos pestañas pueden
  jugar un 1v1.
- Sin resultado fantasma: el feedback pertenece a su ronda o no se muestra.
- Tarjeta de pregunta estable y entrada suave, reutilizable por los próximos juegos.
- Pedir el turno tocando la tarjeta (sin barra BUZZ).
- Nav con Inicio y Quiz; la Sala se alcanza desde la tarjeta del Quiz.
- Cubierta: logo más grande sin anillo, tarjeta del Quiz mejorada y tarjeta
  "Próximamente" del siguiente juego.

## No objetivos

- No se toca el reloj ni el reparto de preguntas.
- No hay revancha ni admin de reportes (siguen en fase 2).
- No se añaden assets nuevos: el logo y los iconos son los que hay.
- No se reescribe el modo solitario.

## Restricciones

- Migraciones manuales en el SQL Editor; `anon` solo ejecuta RPC `security definer`.
- Sin commits (el usuario no los ha pedido).
- El sistema visual sigue siendo `WantedQuiz.css` + `Room.css` + `GameMenu.css`.

## Enfoques considerados

- **Feedback por ronda**: (A) cada `last_result` lleva su número de ronda y el
  cliente lo compara con la ronda actual; el cierre deja de pisar `at`. Elegido.
  (B) silenciar todo feedback durante la fase `question` — se pierde el "acertó".
- **El turno en la tarjeta**: (A) la tarjeta es un `<button>` cuando toca pulsar y
  se convierte en texto cuando no; elegido, accesible y sin botón extra.
  (B) un `<div>` con `onClick` y `role="button"` — peor para teclado.
- **Identidad por navegador**: (A) quitar la deduplicación al unirse (dos pestañas,
  dos jugadores); elegido. (B) dejar el bloqueo y probar en incógnito.

## Diseño

### 1. Migración `0005_round_results.sql`

- `_close_result`: deja de escribir `at`; solo añade `correct_answer`
  (y no toca nada más) para que el cierre no parezca un resultado nuevo.
- `answer` y `force_timeout`: añaden `'round', v_room.current_round` a cada
  `last_result` que escriben. Mismo cuerpo, una clave más.
- `join_room`: se eliminan el retorno de sesión existente y el bloqueo por
  "ya estás en otra sala"; se sigue guardando `client_id` para deduplicar
  `create_room`/`quick_match`. Un navegador puede tener dos jugadores.
  *Shortcut: si alguien se une dos veces desde el mismo cliente, `_client_room`
  no puede distinguir cuál de las dos salas devolver; el flujo normal (crear en
  una pestaña, unirse por código en otra) no lo provoca.*
- `get_room_state` no cambia.

### 2. Feedback por ronda (`Room.jsx`)

- `feedbackForRound(feedback, currentRound)` decide qué se pinta:
  - misma ronda → se muestra entero;
  - ronda anterior (`round === currentRound - 1`) → solo si fue **acierto** o
    **tiempo agotado**: el "acierta" y el "tiempo" se disfrutan una vez, pero un
    fallo de la ronda cerrada ya no reaparece sobre la pregunta nueva;
  - sin `round` (base sin `0005`) → se muestra, para no romper la partida.
- El texto "Era: …" solo se pinta cuando el resultado es de la ronda actual: al
  cerrar la ronda la respuesta se guarda en la base pero no se sopla en pantalla.
- El dedupe por `at` se sustituye por una clave `at|correct_answer|round`, para
  que una misma ronda no se repita en cada refresco.
- Si un BUZZ pierde la carrera (`{won:false}`), se muestra "Te adelantaron" 1,2 s
  en la banda de turno en vez de no pasar nada.

### 2b. Pestaña duplicada (`App.jsx`, `user.js`)

- Al cargar, el cliente genera un `tabId` en memoria (no se guarda en storage).
- La sesión de sala guardada (`opq:room`) lleva ese `tabId`. Si el `tabId` no
  coincide al leerla, la sesión se descarta y el jugador debe volver a entrar:
  una pestaña duplicada **no** hereda la partida de la original ni su token.
- Al entrar o salir de una sala se guarda/limpia el `tabId` junto con la sesión.
- `Sala` abandona la sala anterior (`leaveRoom` con su token) antes de crear o
  unirse a otra, para no dejar una plaza ocupada por un fantasma.

### 3. Tarjeta estable y suave (`Room.css`)

- Geometría fija: `.duel-ask` conserva **siempre** el mismo padding, borde y
  `min-height` (dos líneas de pregunta); el panel entra como capa (`::before`) con
  opacidad, sin tocar el layout.
- Entrada: 280 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, recorrido de 8 px y opacidad.
  Sin rebote ni escala apreciable.
- El texto reserva altura para que las opciones no salten al terminar la escritura.
- `prefers-reduced-motion`: sin transición, panel visible desde el primer frame.

### 4. Pedir el turno tocando la tarjeta (`Room.jsx`)

- En fase `question`, `.duel-ask` es un `<button type="button">` que llama a
  `handleBuzz`; muestra un borde que respira y un texto de ayuda
  ("Toca la carta para pedir el turno").
- En `answering`/`steal` deja de ser botón (es texto) y las opciones mandan.
- Se elimina la barra `.op-buzz`.
- Teclado: Enter/Espacio funcionan por ser un botón real; `aria-label` lo dice.

### 5. Navegación (`Navbar.jsx`)

- `TABS` queda en Inicio y Quiz. La Sala se alcanza desde la tarjeta
  multijugador de la cubierta; la ruta `/sala` sigue existiendo y `labelFor` la
  reconoce para el título de la pestaña.

### 6. Cubierta (`GameMenu.jsx` + `GameMenu.css`)

- **Logo**: se quita `SealRing` y el logo crece; el halo pasa a un resplandor
  suave detrás, sin aro.
- **Tarjeta del Quiz**: se mantiene el hatch y se refuerza la jerarquía
  (título, meta, dos caminos) con más aire y un borde que reacciona a la hover.
- **Tarjeta "Próximamente"**: mismo lenguaje de hatch, sin enlaces, con
  "El siguiente reto del casillero" y una marca de sellado. El contador pasa a
  "1 abierto · 1 sellado".
- Textos existentes se conservan.

### 7. Pruebas

- `src/lib/quizRoom.test.js`:
  - `feedbackForRound`: misma ronda pasa; fallo de la ronda anterior se filtra;
    acierto de la ronda anterior pasa; tiempo agotado de la anterior pasa; sin
    `round` pasa; `null` devuelve `null`.
  - `feedbackKey`: cambia cuando cambia la respuesta revelada, no cuando solo se
    refresca el estado.
- Manual: pestaña duplicada no hereda la partida; pestaña nueva unida por código
  juega como segundo jugador; ronda con fallo + robo sin overlay fantasma; tocar
  la tarjeta pide el turno y no hay barra inferior; nav sin Sala; logo grande sin
  anillo; tarjeta Próximamente visible.

## Riesgos

- Quitar la deduplicación permite que una misma persona entre dos veces a la misma
  sala con el mismo navegador. Es lo buscado para probar; `create_room` y
  `quick_match` siguen evitando duplicados accidentales.
- Una pestaña duplicada pierde la partida en curso y tiene que volver a unirse; es
  preferible a que dos pestañas compartan el mismo token y se pisen los turnos.
- El tamaño reservado de la tarjeta deja aire de más en preguntas de una línea.
- `feedback.round` no existe en resultados escritos por una base sin `0005`; el
  helper los deja pasar para no romper la partida mientras se aplica la migración.

## Queda para el constructor

- Texto exacto de la ayuda al tocar la tarjeta y del "Próximamente".
- Curva fina de la entrada y del borde que respira.
- Nombres de clase nuevos del hatch sellado.
