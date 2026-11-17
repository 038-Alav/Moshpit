# Phase 1 / Demo 1 — Implementation status

**Checkpoint:** D1 Core Sharing Foundation and the full D1 frontend are implemented. The user has manually validated the key Windows runtime flows; the full automated suite for the latest frontend archive has not yet been explicitly confirmed.

## Current vertical slice

`guest identity → private Setlist → create Pit → independent Live Set snapshot → invite another identity → role-authorized Live Set commands`

### Present in code

- `001_core_sharing.sql`: identity sessions, canonical track references, provider mappings, Setlists/items, Pits/memberships/invitations, Live Sets/items, PlaybackSessions, idempotency records and transactional outbox.
- SQL migration runner and deterministic Test Track A/B/C fixtures, including relational constraints that prevent a PlaybackSession from pointing to a Live Set/item belonging to another Pit.
- Authenticated Fastify routes for guest sessions, Setlists, Pit lifecycle, invitations, Live Set editing, snapshots and Centrifugo tokens.
- Server-side membership/role enforcement.
- Revision checks and idempotent command execution.
- Outbox dispatcher with retry/backoff and Centrifugo publisher.
- React journey for creating/editing/reordering Setlists, creating Pits, editing/reordering Live Sets and joining via invitation.
- Unit/API tests and an optional PostgreSQL integration journey.

### User-verified in the target Windows environment (2026-11-16)

- The application starts and the frontend build succeeds.
- Two guest clients observe Live Set reorder changes.
- Viewer cannot reorder the Live Set.
- Reloading restores the currently open Pit.
- Centrifugo reconnects after a network interruption.
- The user created multiple Pits and joined them with guest identities; server logs show successful create, invite and accept operations.

The full automated suite against the latest frontend archive, PostgreSQL concurrency/load tests and automated revision-gap recovery tests have not been explicitly confirmed. The execution environment used to prepare subsequent source changes does not have the project dependencies or a PostgreSQL service available, so those checks are not claimed as passed here.

## Explicitly not implemented

Real audio playback, provider search/adapters, local-library scanning, Stage Playback, voting, PresenceLease/Admin succession and advanced Setlist collaboration remain outside this checkpoint.

## Windows validation feedback — 2026-11-16

The first target-machine run identified two packaging/schema issues, now corrected in this archive:

- The `packages/contracts` workspace now declares TypeScript as its own development dependency. pnpm uses an isolated workspace dependency layout, so relying on TypeScript declared only by sibling apps does not make `tsc` available in this package. Run `pnpm install` after extracting this update.
- `live_sets` now has the composite unique key `(id, pit_id)` required by the `playback_sessions(live_set_id, pit_id)` foreign key. The previous migration failed transactionally before its migration record was inserted, so retrying the corrected migration should not require dropping the database.

The reported test run had 5 passing API/unit tests and 1 skipped PostgreSQL integration test. That integration test is intentionally skipped unless `MOSHPIT_TEST_DATABASE_URL` points to a dedicated test database.


## User validation feedback — 2026-11-16

The user manually confirmed:

- Reordering Live Set tracks is reflected in both guest clients.
- A Viewer cannot reorder the Live Set from the UI.
- Invitation attempts returning 404 are consistent with expired or already-consumed one-use codes; the same log includes successful acceptances. Request bodies were not logged, so the exact cause of each 404 is not independently proven.
- Reloading restores the currently open Pit. The `sessionStorage` per-tab selection is a navigation hint only; the backend still validates identity, membership and role.
- Centrifugo reconnects correctly after a network interruption.
- The frontend build works in the user's Windows environment.

The complete automated test suite for the latest frontend archive remains unconfirmed.


## Frontend D1 — implementación completa sobre el alcance disponible (2026-11-16)

Se reemplazó la pantalla inicial de prototipo por una aplicación de navegación completa que consume los endpoints D1 existentes. La dirección visual toma como baseline el `docs/ui-ux-blueprint/MOSHPIT_UI_UX_BLUEPRINT_v0.1.md` aprobado: dark mode, balanced density, patrones musicales inspirados en Metrolist y sala colaborativa inspirada en CoJam, con identidad Moshpit propia.

### Pantallas y flujos incluidos

- **Inicio:** saludo guest, accesos rápidos, Pits activos, Setlists recientes e historial resumido.
- **Explorar:** búsqueda local del catálogo de test tracks D1 y acción `Agregar a…` para Setlists privados o Live Sets de Pits activos donde la identidad sea Admin/Crowd. La pantalla etiqueta explícitamente el catálogo como demo.
- **Setlists:** biblioteca privada, creación, detalle, edición de nombre/descripción, agregar/quitar/reordenar tracks y creación de un Pit desde el Setlist.
- **Pits:** tabs Activos/Historial, crear Pit vacío o desde Setlist y unirse mediante código.
- **Sala Pit:** Live Set colaborativo, estado neutral de PlaybackSession, Crowd y roles, detalles, invitaciones Admin para Crowd/Viewer y finalización del Pit. Viewer y Pits finalizados son read-only en la presentación; la autorización server-side sigue siendo autoritativa.
- **Invitación:** ruta `/join/:inviteToken` para aceptar links y formulario para pegar código.
- **Perfil:** información de la guest identity y explicación de sus límites actuales.
- **Navegación:** rutas profundas para Setlist/Pit, recuperación del Pit al recargar, Ctrl/⌘+K para abrir Explorar, sidebar desktop, sidebar colapsada a iconos en tablet, navegación inferior móvil; la navegación global inferior se oculta dentro de la sala Pit para dar prioridad a sus tabs Live Set/Crowd/Detalles.

### Componentes de presentación

`AppShell`, `Artwork`, `TrackRow`, `Modal`, `Icon` y páginas aisladas por destino. La UI no contiene lógica de dominio persistente; ejecuta comandos HTTP y representa snapshots. La suscripción Centrifugo vive solo mientras se visualiza un Pit activo y una publicación provoca un refresh del snapshot, sin polling permanente.

### Límites respetados

- No hay búsqueda real Spotify/YouTube/YouTube Music ni importación de bibliotecas externas/locales.
- No hay audio real, controles play/next ni un `MiniPlayer` ficticio. PlaybackSession se muestra como estado de sesión, no como reproductor.
- No hay chat, voting, Stage Playback, Setlist collaborators ni PresenceLease.
- No hay creación de Setlist a partir del historial todavía; el backend/UX no tienen ese comando en D1.

### Validación de este paquete

- TypeScript/TSX: transpilation sintáctica en los archivos de la app sin diagnósticos.
- Typecheck auxiliar estricto con declaraciones locales temporales de React/Centrifuge: sin diagnósticos; esto no sustituye el typecheck oficial con las dependencias reales.
- Registro de iconos: todos los nombres usados existen en el componente `Icon`.
- En el entorno de empaquetado no fue posible instalar dependencias desde npm por indisponibilidad de red, así que allí no se pudo ejecutar el build oficial ni verificar el bundle Vite. Posteriormente, el usuario confirmó que el build de la última entrega funciona en su Windows.
- La suite automatizada completa del último paquete y la auditoría visual formal desktop/mobile/WCAG AA aún no se han confirmado.


## Phase 2 / D2 Playback Foundation — 2026-11-16

The next implementation increment is documented in `docs/phase2-playback-foundation.md`. It adds `playback_endpoints`, contracts for endpoint-local state and provider-neutral adapters/drivers, authenticated HTTP registration/reporting routes, and a deterministic Individual Playback planner. This is a foundation only: it does not execute audio, dispatch directives, implement real providers, Stage Playback, clock synchronization or drift correction. PostgreSQL integration tests and project typecheck/build still require execution in the target environment or CI.
