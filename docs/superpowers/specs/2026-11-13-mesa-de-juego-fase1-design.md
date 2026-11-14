# Fase 1 — Mesa de juego: entrada del boss, avatares, salida y host, resumen

Fecha: 2026-11-13
Estado: aprobado e implementado
Fase 2 (fuera de este documento): admin de reportes y revancha.

## Intención

La ronda multijugador funciona pero no se siente inmersiva: la tarjeta de pregunta
está desde el primer frame, el clic no responde al instante, no se ve quién juega y
salir de la partida no avisa a nadie.

El jugador que revisó esto llama "boss" a la tarjeta de pregunta: quiere que entre
al terminar de escribirse el texto y que solo entonces se pueda responder.

## Objetivos

1. **Coreografía de ronda**: mientras se escribe la pregunta solo se ve el mar, la
   marea y el texto; al terminar, la tarjeta ("boss") aterriza con golpe y se
   habilitan las opciones. El clic responde en el mismo frame.
2. **Identidad**: avatar circular con la inicial y color por nombre, junto al nombre,
   en el marcador y en el resumen. Sin base de datos nueva: el avatar elegible llega
   después y este hueco es donde irá.
3. **Salida con aviso**: confirmar antes de abandonar en partida; en espera se sale
   sin fricción. El host migra al más antiguo presente.
4. **Host desaparecido**: heartbeat para detectar al capitán que cerró la pestaña y
   permitir reclamar el mando.
5. **Resumen de ganador**: pantalla completa con ganador (o empate / equipo), podio
   con avatares, totales por equipo y compartir.

## No objetivos

- No se toca el modo solitario: ya escribe la pregunta y bloquea opciones hasta el
  final, y funciona. Si luego se quiere la misma coreografía, es una llamada aparte.
- Sin revancha ni admin de reportes (fase 2).
- Sin avatares elegibles ni subida de imágenes.
- Sin pausa de la partida: el reloj de 20 s corre igual.

## Anti-objetivos

- Que la animación retrase la respuesta: la tarjeta debe estar lista ≤ 1 s después de
  terminar la escritura. La escritura en sí es el único bloqueo, y es el mismo para
  todos.
- Que el overlay de resultado tape la ventana de robo (ya resuelto: en robo no hay
  overlay a pantalla completa).
- Que el heartbeat deje la sala sin host por un fallo de red momentáneo: umbral 30 s.

## Restricciones

- El estado del turno vive en Postgres; la migración es manual (SQL Editor).
- `anon` solo ejecuta RPC `security definer`.
- Sin commits (el usuario no los ha pedido).
- El sistema visual es `WantedQuiz.css` + `Room.css`; no se añaden fuentes ni assets.

## Enfoques considerados

- **Coreografía**: (A) un flag `revealed` en la pantalla de partida con el texto
  siempre visible y el panel animándose al final — elegido; (B) un componente
  `RoundStage` compartido con el solo — reescribe código que funciona; (C) solo
  transiciones CSS al panel actual — el boss seguiría apareciendo al inicio.
- **Host desaparecido**: (A) heartbeat `last_seen` + `claim_host` — elegido, detecta
  el caso real; (B) solo salida explícita — cero base nueva, pero un host que cierra
  la pestaña deja la sala sin capitán.

## Diseño

### 1. Coreografía de la ronda (`Room.jsx`)

- Estado `revealed`: falso al llegar una pregunta, verdadero cuando la máquina de
  escribir termina (más 120 ms).
- El texto de la pregunta **siempre** está montado; lo que cambia es el contenedor:
  sin panel mientras escribe, con panel (`.duel-ask.is-revealed`) al terminar.
- La entrada del panel usa `questionArrive` + `bounceIn` ya existentes; el emblema de
  la marea pulsa mientras escribe.
- **Opciones y BUZZ esperan a `revealed`**: nadie puede pulsar antes de que la
  pregunta esté completa, igual que en el solitario. El cronómetro de 20 s sí corre
  desde que llega la pregunta; la escritura dura 1–2 s, para todos por igual.
- Clic: `.option-btn:active` con `transform: scale(0.97)` y transición de 90 ms; la
  marca `correct`/`wrong` y el overlay ya existen.

### 2. Avatares

- `initials(name)` y `avatarHue(name)` (ya en `Room.jsx`, usados en el lobby) se
  mueven a `src/lib/quizRoom.js` para poder probarlos; `Room.jsx` los importa.
- `.duel-player` pasa a: avatar circular 26 px (fondo `hsl(var(--avatar-hue) 40% 22%)`,
  borde turquesa, inicial en `--font-display`) + nombre + puntos.
- El resumen reutiliza el mismo avatar en el podio.

### 3. Salida con aviso

- En `playing`, `handleExit` abre un diálogo (`role="dialog"`, foco en Cancelar):
  "Abandonar la partida — La sala sigue sin ti; tu puesto queda libre."
  Botones Cancelar / Abandonar. En `waiting` y `finished` se sale directo.
- La lógica de sala ya cubre el resto (`leave_room` de `0003`: bloquea al que se va,
  hereda turno, migra host, avanza si no queda nadie elegible).

### 4. Host desaparecido (migración `0004_host_heartbeat.sql`)

- `room_players.last_seen timestamptz not null default now()`.
- `ping(p_code, p_token) returns jsonb`: actualiza `last_seen` del jugador y, si la
  sala está en `waiting`, elimina a los fantasmas (`last_seen` > 45 s) para que las
  plazas y el arranque no se queden clavados.
- `claim_host(p_code, p_token) returns jsonb`: exige sala `waiting` o `playing`,
  que el host actual lleve más de 30 s sin `last_seen`, y que quien reclama tenga
  `last_seen` de menos de 15 s. Transfiere `is_host`. **La regla "el más antiguo"
  se aplica en SQL**, no solo en la UI: si el más antiguo está muerto, reclama el
  siguiente más antiguo que esté fresco. Si nadie está fresco, devuelve `{ok:false}`.
- `leave_room` se reemplaza en `0004` para elegir como nuevo host al más antiguo
  **con `last_seen` fresco**, con caída al más antiguo a secas si no hay nadie fresco.
- En `playing` no se eliminan fantasmas: el timeout y `blocked_players` ya cierran
  sus turnos, y borrarlos a media ronda rompería el reparto de equipos.
- `get_room_state` añade `last_seen` por jugador (ya devuelve `is_host`).
- Cliente: `ping` cada 10 s mientras haya sesión de sala. Si no soy host y el host
  lleva > 30 s mudo:
  - en `playing`, el marcador muestra "El capitán no responde";
  - en `waiting`, además aparece el botón "Reclamar mando" (visible para el más
    antiguo fresco; el servidor es quien decide) y, al ganarlo, el botón
    "Iniciar partida" pasa a quien reclama.
- El aviso de salida cubre solo el botón ABANDONAR. El cierre de pestaña no se
  intercepta: el jugador queda como fantasma y, en partida, el reloj lo deja fuera.

### 5. Resumen de ganador

- La pantalla `finished` deja de ser una tarjeta `op-*` y pasa a
  `quiz-page-container` con el mar.
- Bloque central: avatar grande + nombre del ganador + puntos; en `2v2`, equipo
  ganador y totales; empate explícito ("Empate en el casillero").
- Podio: podio de hasta 4 con avatar, nombre y puntos; `me` resaltado.
- Acciones: "Compartir resultado" (html2canvas sobre el bloque, como hoy) y
  "Volver al inicio". Sin revancha (fase 2).

### 6. Pruebas

- `src/lib/quizRoom.test.js` (node:test): `initials`, `avatarHue`, `winnerOf`,
  `hostAway`.
  - `winnerOf`: 1v1 con ganador, 2v2 por suma de equipo, empate.
  - `hostAway(players, now, umbral)`: host fresco → no; host mudo 31 s → sí, y
    `canClaim` solo para el más antiguo presente.
- Manual (dos pestañas): entrada del boss, clic instantáneo, aviso de salida,
  cierre de pestaña del host + reclamar mando, resumen de ganador en los tres modos.
- `supabase/tests/0004_verify.sql`: `last_seen` existe, `ping` y `claim_host`
  existen y no son ejecutables por `anon` salvo con `execute`, y `leave_room` mira
  `last_seen` (presencia de la marca en el cuerpo no es verificable; se comprueba la
  firma y los permisos).

## Riesgos

- El heartbeat añade una escritura cada 10 s por jugador. Con 4 jugadores es trivial.
- `claim_host` durante `playing` no cambia el juego (el host no tiene poderes en
  partida), así que un reclamo erróneo solo cambia la etiqueta del capitán.
- Si el reloj del servidor y `last_seen` divergen, el umbral de 30 s lo absorbe.

## Queda para el constructor

- Nombres exactos de las clases nuevas (`.duel-ask`, `.duel-podium`, `.host-away`).
- Copia final de los textos del diálogo y del resumen.
- Curva y duración exactas de la entrada del panel (dentro de ≤ 1 s).
