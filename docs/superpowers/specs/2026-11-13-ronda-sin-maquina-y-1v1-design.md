# Ronda sin máquina de escribir, 1v1 único y resumen con datos

Fecha: 2026-11-13
Estado: pendiente de aprobación

## Intención

Quitar la espera del texto a máquina (la pregunta entra completa y ya se puede
responder), hacer visible quién gana el turno y que la pregunta nunca se vea
apagada, adaptar la interfaz al cambio de marea, cerrar la partida cuando el rival
abandona, dejar el multijugador en **solo 1v1**, recuperar el retroceso del modo
solo al fallar, y dar al resumen de 1v1 algo más que dos números.

## Objetivos

1. **Sin texto a máquina** (solo y multijugador): la pregunta aparece completa con
   una entrada aleatoria (cae desde arriba o entra desde un lado) y se puede pulsar
   de inmediato.
2. **Turno claro**: al ganar el BUZZ se anuncia a todos quién respondió, y quien
   tiene el turno ve la pregunta completa, sin capas oscuras ni difuminado.
3. **Marea coherente**: al cambiar la dificultad, el acento de toda la ronda
   (tarjeta, marcador, aviso de turno, marea) cambia con ella.
4. **Abandono**: en 1v1, si un jugador abandona, el otro gana por abandono y ve el
   resumen; la partida no se queda colgada.
5. **Solo 1v1**: se eliminan 2v2 y 4 jugadores de la interfaz y de las RPC.
6. **Retroceso en solo**: fallar quita una vida y devuelve una casilla atrás con
   **otra pregunta de la misma dificultad** (nunca una ya respondida).
7. **Resumen de 1v1**: ganador, marcador, aciertos, fallos, precisión, mejor racha
   y ronda final. Esas estadísticas se guardan **solo en memoria del cliente** para
   la pantalla final (decisión del usuario): se pierden al recargar y no van a la base.
8. **Cubierta**: logo grande con entrada girada que se asienta; el nav dice
   "Casillero de Davy T. Jones".

## No objetivos

- No se persisten estadísticas ni historial en la base.
- No hay comodines (idea futura).
- No se toca el lobby salvo quitar los modos.
- No se rehace la pantalla de espera.

## Restricciones

- Migraciones manuales; `anon` solo ejecuta RPC.
- Sin commits (el usuario no los ha pedido).
- La base conserva los valores `2v2`/`ffa4` en el `check` (borrarlos rompería filas
  antiguas); se rechazan al crear y no se muestran.
- `room_players` no gana columnas: las estadísticas del resumen son del cliente.

## Enfoques considerados

- **Entrada de la pregunta**: (A) tres keyframes (`dropIn`, `slideLeft`,
  `slideRight`) y una clase elegida al azar por ronda — elegido; se puede reutilizar
  en cualquier juego y respeta `prefers-reduced-motion`. (B) Web Animations API con
  transform calculado en JS — más código y sin CSS reutilizable.
- **Retroceso del solo**: (A) sustituir en `question_ids` la posición a la que se
  vuelve por otra pregunta de la misma dificultad que no esté en la lista —
  elegido, cabe en `answer_solo` sin tablas nuevas. (B) una cola aparte de reserva
  por dificultad — más estado en la sesión.

## Diseño

### 1. Pregunta completa y entrada aleatoria

- `WantedQuiz.jsx`: se elimina el efecto de escritura y el estado
  `displayedQuestion`; se pinta `currentQuestion.question_text` completo. Se elige
  `entry` (`top`/`left`/`right`) al cambiar de ronda con `useState`/`key`.
- `Room.jsx`: fuera `typed`, `revealed` y `shouldReveal`; la tarjeta se pinta
  completa desde el primer frame y las opciones/BUZZ quedan activos ya.
- CSS compartido en `WantedQuiz.css` (lo usan ambas pantallas):
  `@keyframes askDropIn`, `askSlideLeft`, `askSlideRight`; la clase
  `ask-enter--top|left|right` se aplica al contenedor de la pregunta y dura 320 ms.
  Con `prefers-reduced-motion`, sin animación.
- Se borran `charDelay` (y su prueba) y `shouldReveal` (y su prueba) por quedar sin uso.

### 2. Turno visible y pregunta legible

- `.feedback-fullscreen-overlay` gana `pointer-events: none` (hoy tapa clics) y su
  duración baja a 1,1 s.
- El overlay no se pinta nunca para quien puede responder en ese momento: condición
  `!canAnswer(room, playerId)` además de las actuales.
- Aviso de turno a todos: en `answering`, una banda `.duel-turn--turn` con el avatar
  del que respondió y "**<nombre> tiene el turno**"; en su pantalla, "**Es tu turno**".
  Entra con `bounce-in`. En `steal`, la banda actual.
- La tarjeta revelada usa fondo casi opaco (`0.94`/`0.97`), borde `--deck` y
  `text-shadow` más contenido; nada de capas semitransparentes encima del texto.

### 3. Acento por marea

- `Room.jsx` fija en el contenedor `style={{ '--deck': DIFF_COLOR[difficulty] }}`
  (ya existe el mapa); `WantedQuiz.jsx` hace lo mismo con
  `currentQuestion.difficulty` (y conserva el último en el resumen).
- `Room.css` y `WantedQuiz.css` usan `var(--deck, var(--lum))` en: borde y brillo de
  la tarjeta, borde del avatar propio, banda de turno, aro de la marea y borde del
  marcador. El fondo por dificultad ya cambia.

### 4. Abandono = victoria (migración `0006_duel_only_abandon.sql`)

- **Solo cuenta el abandono explícito** (botón ABANDONAR). Cerrar la pestaña deja un
  fantasma: en 1v1 la ronda sigue avanzando por timeout y la partida termina igual;
  el abandono por inactividad queda para otra fase.
- `leave_room`: tras borrar al jugador, si la sala está `playing` y el modo es `1v1`
  y queda exactamente un jugador, cerrar la partida:
  `status='finished'`, `phase='finished'`, `question_id=null`, `round_deadline=null`,
  `last_result = {"forfeit": true, "player_name": <el que se fue>, "at": now()}`.
  (No se reutiliza `_advance_room`: no hay siguiente ronda.)
- El cliente, en la pantalla final, si `last_result.forfeit` muestra
  "**<nombre> abandonó el casillero**" y "Victoria por abandono" para el que queda.

### 5. Solo 1v1

- `Sala.jsx`: fuera las tarjetas de 2v2 y 4; se muestra el modo fijo "Duelo 1 vs 1"
  (sin selector). "Buscar partida" busca/crea 1v1. El copy se ajusta.
- `quizApi.quickMatch(name, clientId, mode)` pasa a enviar `'1v1'` desde la Sala.
- RPC (`0006`): `create_room`, `join_room`, `start_room` y `quick_match` rechazan
  cualquier modo distinto de `'1v1'` con `'Modo no disponible'`; `_client_room` solo
  devuelve salas `1v1`, para que una partida rápida no reanude una sala antigua.
- `Room.jsx`: se quitan las ramas de `2v2` (totales de equipo, textos de equipo,
  "equipo A/B" en el podio). `sideLayout`/`teamTotals`/`winnerOf` se quedan (pruebas
  y compatibilidad), pero la UI ya no los usa para equipos.

### 6. Retroceso en solo (mismo `0006`)

`answer_solo` cambia en el fallo:

- `lives := lives - 1`.
- Si `lives <= 0` → `lost` (igual que hoy).
- Si no: `v_round := greatest(1, round - 1)`.
- Se sustituyen **dos** posiciones por preguntas nuevas que no estén en
  `question_ids`: la posición a la que se vuelve (misma dificultad que esa posición)
  y la posición de la pregunta fallada (misma dificultad que la fallada). Así la
  pregunta que acabas de fallar no reaparece al avanzar.
  Si no hay candidata para una posición, se deja la que había (caso extremo: una
  única pregunta de esa dificultad).
- Acierto: como hoy (`score + 1`); si era la última ronda → `won`.
- La respuesta devuelve la pregunta nueva y la ronda nueva; el cliente ya la pinta y
  la barra del Log Pose retrocede sola.
- "La marea sube" solo se dispara cuando la dificultad **sube** (`nivel(nueva) >
  nivel(anterior)`); al retroceder no se anuncia.

### 7. Resumen de 1v1 con estadísticas en memoria

- `Room.jsx` acumula `duelStats` desde el resultado **crudo** de cada ronda
  (deduplicado por `feedbackKey`): por jugador `{ aciertos, fallos, racha, mejorRacha }`.
  Un `timeout` con `player_id` cuenta como fallo del que tenía el turno; un timeout
  sin jugador no cuenta.
- La pantalla final muestra: ganador (o abandono), puntos, aciertos/fallos,
  precisión, mejor racha, ronda final y una línea de cierre. Si el cliente se
  recarga, solo hay puntos: la pantalla se adapta sin huecos vacíos.
- **Las estadísticas solo se muestran si cubren la partida entera**: se cuentan los
  resultados distintos observados; si son menos que las rondas jugadas, el resumen
  cae al modo "solo puntos" (nada de medias verdades).
- En abandono, `last_result` guarda el nombre del que se fue; el resumen lo usa para
  la línea de abandono y, si hay estadísticas, incluye sus números en memoria.
- Copy en la voz del proyecto, sin listas frías: "El casillero se queda con <nombre>",
  "Aguantó <n> de <total> mareas", etc.

### 8. Cubierta

- `GameMenu.css`: el logo entra con `rotate(-6deg)` → `0` y escala 0.94 → 1 en 420 ms;
  resplandor que respira detrás. Sin giro continuo.
- `Navbar.jsx`: el subtítulo pasa a "de Davy T. Jones".

### 9. Pruebas

- `quizRoom.test.js`: se eliminan las pruebas de `charDelay` y `shouldReveal`; se
  añade `entryClass(seed)` (helper puro que devuelve `ask-enter--top|left|right`
  según un número) y `duelStatsFor(results)` si la agregación se extrae a puro.
- `supabase/tests/0006_verify.sql`: `create_room`/`quick_match` rechazan modos no
  1v1 (comprobación de cuerpo), `answer_solo` contiene el retroceso (`least(` o
  `greatest(`) y `leave_room` contiene `forfeit`.
- Manual: pregunta completa y clicable al instante en solo y 1v1; aviso de turno;
  sin capas oscuras; colores por marea; abandono → victoria; solo 1v1 en la Sala;
  fallo en solo retrocede con otra pregunta; resumen con estadísticas.

## Riesgos

- Las estadísticas del resumen se pierden al recargar (decisión del usuario) y no se
  muestran si están incompletas.
- Rechazar modos en la base deja salas antiguas `2v2` visibles por código; no se
  muestran, no se pueden crear y `join_room`/`start_room` las rechazan.
- Cerrar la pestaña no cuenta como abandono: el rival espera los timeouts hasta el
  final de la partida.
- El retroceso puede alargar la partida si el jugador falla en bucle; las 3 vidas
  siguen limitando.
- Sustituir dos posiciones del pool cambia las preguntas de esa sesión; si no hay
  candidata de la misma dificultad, se conserva la que había.
- El resumen del solo cuenta intentos (puede pasar de 15 con retrocesos); no se
  reescribe en esta fase.

## Queda para el constructor

- Curva exacta de las tres entradas y del logo.
- Texto final del resumen (se escribe en la voz del proyecto).
- Nombres de las clases nuevas del aviso de turno.
