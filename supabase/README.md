# Base de datos

Las migraciones se ejecutan **en orden** en el SQL Editor de Supabase (o con
`supabase db push`). Cada archivo es idempotente dentro de lo razonable: usa
`if not exists`, `create or replace` y `drop ... if exists`.

## Orden

| Rango | Qué añade |
|---|---|
| `0001`–`0007` | Preguntas, salas, duelos, rondas y comodines del quiz |
| `0008`–`0009` | Ventana de BUZZ, cuentas y perfiles |
| `0010`–`0012` | Identidad arcade, rankings, avatares/marcos, tildes |
| `0013`–`0017` | Reportes, comodines de One Piece, temporizador |
| `0018` | Identidad ligada a Supabase Auth (email + contraseña) |
| `0019`–`0020` | Gameplay del quiz y elección de comodines |
| `0021` | País/bandera del perfil |
| `0022` | `game_key` en partidas, salas y rankings |

## Pendientes de aplicar

- `0021_arcade_profile_country.sql`: sin ella la bandera se guarda solo en el
  dispositivo y el panel lo avisa.
- `0022_game_key.sql`: sin ella los rankings no separan por juego y las salas
  nuevas usan la firma antigua. El cliente tiene fallback para ambas cosas.

## Comprobar

Los archivos de `supabase/tests/` son consultas de verificación manual. Ejecuta
el `*_verify.sql` de la última migración después de aplicarla.
