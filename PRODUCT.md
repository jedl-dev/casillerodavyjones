# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fans de One Piece que hablan español y quieren jugar una trivia corta desde el navegador, solos o con amigos. La mayoría entra desde el móvil, sin instalar nada y sin cuenta.

## Product Purpose

Un archivo de juegos de fans de One Piece. El producto permite empezar una partida individual o abrir/entrar a una sala multijugador en pocos segundos, y compartir el resultado al terminar. El éxito es que alguien llegue, entienda qué hacer y esté jugando sin recorrer explicaciones largas.

## Positioning

Trivia de One Piece con partida individual por vidas y salas multijugador en tiempo real por código o partida rápida, todo desde una web estática apoyada en Supabase. No hay registro ni descarga.

## Operating Context

Se usa en navegador de escritorio o móvil. Las salas se comparten por código. La home canónica es `/home`; `/` muestra la misma pantalla para no romper enlaces viejos. La administración de preguntas vive en `/admin`, solo existe en desarrollo local y requiere una cuenta con rol admin; no se enlaza ni se renderiza en producción. El despliegue es estático en Vercel con fallback de SPA.

## Capabilities and Constraints

- Quiz individual: partida de 20 preguntas, 3 vidas y dificultad ascendente.
- Multijugador: duelo 1 vs 1, crear sala, unirse por código y partida rápida.
- Resultados como cartel de se busca con la recompensa en Berries, compartible como imagen o texto.
- Modo solo con puntuaci?n en Berries (dificultad x racha x marea), 9 comodines de One Piece (Filo de Zoro, Ruta de Nami, Alma de Brook, Ancla de Franky, Ojo de Robin, Log Pose doble, Fruta del Diablo, Maldici?n Yami Yami y Trampa de Buggy), tr?o fijo al zarpar y ruleta en cada cambio de marea.
- Arcade sin cuentas: el jugador elige un nombre ?nico (3?16 letras, n?meros o guion bajo) que se guarda en su navegador; el nombre reserva sus marcas.
- Rankings por nombre: mejor marca del solo y victorias de duelos, con hist?rico y semana.
- Panel de administración de preguntas, solo en desarrollo: crear, editar, duplicar, borrar, buscar y filtrar por dificultad o categoría.
- Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; sin ellas la app muestra un aviso de configuración.
- No hay backend propio: la lógica de juego son funciones RPC de Supabase.

## Brand Commitments

- Nombre de marca: **El Casillero de Davy D. Jones**.
- El fondo es una cueva abisal turquesa con luz desde arriba, part?culas y roca. La home es el interior del casillero: roca h?meda, un casillero met?lico oxidado con cartel de madera, un cofre, coral, algas y burbujas. La madera, el ?xido y el coral son material leg?timo; nada de acero limpio, cristal decorativo ni interfaz tecnol?gica.
- La home se lee como el casillero de Davy D. Jones dentro de una cueva: el casillero oxidado con la puerta entreabierta y un cartel colgado con el nombre, el titular ?Has ca?do en el casillero de Davy D. Jones. Prep?rate para algo impactante.? y dos compuertas de roca y metal para descender solo o retar a un rival. Debajo, el estante de lo que guarda el casillero: el Quiz abierto y un cofre sellado.
- La paleta sale de la ilustraci?n de referencia: abismo negro-verdoso, agua turquesa con luz desde arriba, roca h?meda, ?xido y madera del casillero y el cofre, coral rosado y espuma para leer. El coral queda para lo sellado; el rojo se reserva para errores y respuestas fallidas. Sin acero cepillado ni dorado.
- La navegación es una barra superior fija con la marca y la cuenta, y un riel retráctil en escritorio; por debajo de 1080 px el riel es un cajón lateral oculto que se abre con un botón flotante a la izquierda.
- Tipografía: Special Elite para marca, títulos, acciones y etiquetas; Cormorant Garamond para lectura y textos largos.
- La home muestra una plataforma de reto abierta, el Quiz, con las condiciones del reto (20 preguntas, 3 vidas, dificultad creciente) y las dos compuertas para jugar: Solo y Multijugador. En su base queda una escotilla sellada, sin prometer un juego concreto.
- La pantalla individual es un briefing de reto centrado: título, condiciones, aviso y formulario de nombre.
- La dificultad se comunica con un sonar de cinco contactos; no se usan barras tipo Wi-Fi.
- El pie de página no muestra créditos de One Piece: lleva la marca, los enlaces Inicio, Quiz y Sala y un bloque social apagado hasta tener URLs reales.
- El logo oficial es `public/assets/logos/logobase.png`; se usa en la navegación, en la home y como favicon.

## Evidence on Hand

- Banco de preguntas de ejemplo en `supabase/seed.sql`.
- Logo oficial en `public/assets/logos/logobase.png`; referencia de paleta en `public/assets/referencias/referencia.webp`.
- Arte de juegos en `public/assets/juegos/`: un SVG de ejemplo por modo (`quiz-solo`, `quiz-multijugador`) que se sustituye subiendo un `.webp`, `.png` o `.jpg` con el mismo nombre base.
- No hay testimonios, métricas de uso ni clientes reales; no inventarlos.

## Product Principles

1. Empezar manda: cada pantalla ofrece una acción clara y vuelve al juego.
2. La identidad de fan se nota en el mundo visual, no en datos inventados.
3. Una sola página por tarea: inicio, quiz y sala no comparten formularios.
4. Lo individual y lo multijugador se eligen dentro de la tarjeta del Quiz, en la home, antes de bajar.
5. Nada bloquea al visitante: si Supabase falla, se explica el problema y la salida.

## Accessibility & Inclusion

Navegación por teclado con foco visible, etiquetas enlazadas en formularios y respeto por `prefers-reduced-motion` en el fondo animado.
