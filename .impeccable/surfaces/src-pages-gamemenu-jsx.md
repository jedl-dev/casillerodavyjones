---
version: 1
slug: "src-pages-gamemenu-jsx"
primary_target: "src/pages/GameMenu.jsx"
related_targets: ["src/pages/QuizIntro.jsx"]
---

> Nota 2026-11-19: la home pasó de pasarela/plataforma a retrato del casillero (dos cards de modo con arte + tablón; sin galería). La navegación incluye barra superior fija y el botón del cajón móvil vive a la izquierda. DESIGN.md manda sobre este brief cuando difieran.

# Home surface

Scope: `/home` (canonical home; `/` renders the same surface) for El Casillero de Davy D. Jones, the individual challenge briefing at `/quiz`, and the navigation shell shared by `/quiz` and `/sala`.
Visitor mode: Operate. The visitor chooses a challenge and a mode, then leaves; the world never obscures the choice.

## Audience and job

Spanish-speaking One Piece fans on mobile or desktop who want to start playing in seconds. The home must answer "which challenge, and do I play alone or with my crew" without inventing games that do not exist yet.

## Chosen direction

El Casillero de Davy D. Jones inside an abyssal turquoise cave, read as a challenge walked into. The supplied circular logo sits in a porthole ring with aqua arcs and a slow sonar sweep; the headline says the visitor has fallen into the locker and tells them to get ready for something worth playing. Below, a steel walkway crosses the dark abyss toward a raised platform: the Quiz with its stakes (20 questions, 3 lives, rising difficulty) and two gates, Solo and Multijugador; a sealed hatch sits at the platform base.

Materials: deep turquoise water and light shafts, black cave rock, brushed steel plates with rivets, chains and a lit porthole; aqua bioluminescence for life and primary action, foam for display type, a muted coral for the sealed state. No wood, brass, gold, brown surfaces, warm tones or algae; red is reserved for errors. Type: Special Elite for brand, titles, actions and labels; Cormorant Garamond for reading. No fake games, fake claims or gameplay details for future challenges.

Memorable moment: the walkway's joints light from the entrance to the platform, and hovering or focusing a gate floods that half of the platform with rising water, aqua for Solo and pale foam for Multijugador; the arrow advances.

Desktop navigation (from 1081 px) is a retractable left rail: 56 px at rest, 232 px on hover or focus-within. Below 1081 px it becomes an off-canvas left drawer with a floating 44 px button; there is no top bar, and the drawer closes on route change. Route changes pause on an immersive loading curtain for about 1.2 s. The footer carries the brand, Inicio/Quiz/Sala links, a disabled social block and no One Piece credits. The `/admin` question panel exists only in development.

## Constraints

- Navbar: Inicio, Quiz, Sala. Each route is its own URL; Inicio points to `/home`. Mobile uses an off-canvas drawer and a floating toggle, not a top bar.
- The Quiz card chooses the mode: Solo opens the centered challenge briefing at `/quiz`; Multijugador opens `/sala`.
- The challenge briefing keeps the name field before the solo game.
- Sala is multiplayer only: create, join by code, quick match.
- Existing Supabase flows must keep working.
- The admin question panel must keep working on localhost and stay out of production.
- Preserve the sea background, particle drift and route curtain.
- The footer links Inicio/Quiz/Sala, reserves a disabled social block and carries no One Piece credit line.
- Difficulty uses a five-contact sonar scope, never coverage-style bars or a Wi-Fi-like meter.
- The logo is `public/assets/logos/logobase.png`; the palette reference is `public/assets/referencias/referencia.webp`.

## Direction contract

THESIS: The home is a walkway over the abyss that ends at the one open challenge: the Quiz platform with two gates and a sealed hatch, refusing both the flat hero-plus-card landing and the equal-card grid.
OWN-WORLD: Turquoise abyssal cave field, black rock silhouettes, brushed steel plates with rivets and chains, the circular logo in a porthole ring with a sonar sweep, aqua for life and Solo, pale foam for Multijugador, muted coral only for the sealed state, foam display over Cormorant reading, a retractable left rail from 1081 px and an off-canvas drawer below. The sea, particles and route curtain stay.
STORY: The visitor has fallen into Davy D. Jones' locker. A steel walkway crosses the dark toward the Quiz; Solo and Multijugador are the two gates that open it. The sealed hatch proves the locker still holds more.
FIRST VIEWPORT: Fixed cave sea and waves fill the screen. A retracted left rail shows an anchor and «Cubierta»; below 1081 px a floating toggle replaces it. Top left: the logo in its porthole ring, the foam headline «Has caído en el casillero de Davy D. Jones.», the aqua line «Prepárate para algo impactante.» and the lede; top right the depth and the archive count. The lower half is the abyss, crossed by a riveted steel walkway with chains that ends at a raised Quiz platform holding «20 preguntas · 3 vidas · dificultad creciente», the two gates «Jugar solo» and «Reta a tu tripulación», and a sealed hatch at its base. A footer with brand, links and a disabled social block sits below.
FORM: sixth of seven grounded structures; the deal put the walkway on the table. seed:f6591e3f861af6ff
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
