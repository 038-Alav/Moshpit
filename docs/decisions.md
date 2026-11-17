# Moshpit — Decision Log

## Confirmado

- Moshpit se construye como monolito modular.
- Node.js + TypeScript y Fastify para el backend.
- React + TypeScript para el cliente web.
- pnpm workspaces para el monorepo.
- PostgreSQL como fuente de verdad.
- Centrifugo desde Demo 1 como infraestructura realtime independiente.
- Fastify conserva lógica de dominio, autorización, comandos, estado y persistencia.
- Los comandos que modifican estado entran por HTTP.
- Fastify publica eventos a Centrifugo después del commit mediante un transactional outbox.
- Los clientes no publican directamente a los canales de Pit.
- RPC Proxy queda reservado para observaciones/acknowledgements de Playback en demos posteriores.

## Propuesta de Presence Contract pendiente de validación final

- Una PresenceLease representa una instancia de aplicación conectada a un Pit.
- Una identidad puede tener varias leases simultáneas.
- La identidad se considera conectada si tiene al menos una lease vigente.
- Heartbeat HTTP cada 15 segundos.
- TTL inicial de 45 segundos.
- Liberación explícita best-effort; la expiración es el mecanismo de seguridad.
- La sucesión de Admin opera sobre identidades agregadas, nunca sobre conexiones individuales.
- La gracia de sucesión existente permanece en 180 segundos.
- Heartbeat, `Skip wait` y promoción deben serializarse usando bloqueo transaccional del Pit.
- Estos valores y el detalle de persistencia se deben confirmar antes de implementar la lógica.

## Pendiente de decisión o implementación

- No se selecciona un ORM por ahora; D1 usa `pg` y SQL explícito. Reconsiderar solo si el costo de mantenimiento lo justifica.
- No se selecciona todavía una librería compartida de validación runtime; D1 utiliza guards explícitos en los límites HTTP.
- Account linking y recuperación de identidad guest entre dispositivos.
- PresenceLease, valores definitivos de heartbeat/TTL y sucesión de Admin.
- Optimización de snapshots/revisión selectiva y pruebas de concurrencia/carga.
- Pruebas E2E de entrega realtime contra Centrifugo en CI.

## Decisiones de implementación D1

- Migraciones SQL versionadas en `apps/api/migrations`, aplicadas por `schema_migrations` al iniciar la API.
- JWT de conexión y suscripción Centrifugo emitidos por Fastify; suscripción Pit autorizada mediante membresía del servidor.
- Transactional outbox con lease, retry y backoff. La entrega puede ser duplicada y los consumidores deduplican por `eventId`.
- Vite es el tooling del frontend inicial, no una decisión irreversible.
- La versión de Centrifugo se fija en `v6.10.3` para el entorno D1.

## Portabilidad de runtime (confirmado)

- Docker y Podman son herramientas opcionales de empaquetado/ejecución, no dependencias del producto ni de la arquitectura.
- El backend Fastify debe poder compilarse y ejecutarse como proceso Node.js nativo en Windows y Linux.
- PostgreSQL y Centrifugo pueden proporcionarse como instalaciones/servicios nativos o como contenedores.
- Se mantienen caminos documentados para desarrollo nativo Windows, despliegue nativo Linux y despliegue contenedorizado.
- CI debe poder ejecutar typecheck, pruebas y build en un runner independiente del equipo local del desarrollador.

## Producto sharing-first — baseline v0.1

- Setlists, Pits and Live Sets are first-class concepts from the beginning.
- Setlists are persistent Moshpit-owned collections; they are not deferred to a later phase or reduced to provider playlist mirrors.
- A Pit is the social/session context. Its Live Set is an independent selection for that session.
- Creating a Pit from a Setlist copies the ordered track references into a new Live Set and records source provenance. Later edits do not implicitly synchronize in either direction.
- PlaybackSession belongs to the Pit/active Live Set context; it is not the Setlist and not a player instance.
- Users must be able to create Moshpit Setlists without first maintaining a library/playlist in Spotify, YouTube or YouTube Music.
- Moshpit will not bulk mirror full external provider catalogs. Search is on-demand through provider adapters; persist selected canonical track references and mappings only as needed.
- Device-local music libraries are optional future import sources. They are not silently scanned, not required for participation and not the source of truth.

## Pendiente de decisión

- Setlist visibility, collaborator roles and invitation semantics.
- Setlist deletion/archive and historical reference behavior.
- Concurrent ordering/reorder conflict strategy.
- Guest identity recovery and account linking.
- Whether future Pits may contain multiple Live Sets (initial assumption: one active Live Set).
- Final PlaybackSession schema and lifecycle.
- Migration tooling and runtime schema validation library.

## D1 decisions fixed for the first vertical slice (2026-11-16)

- Setlists are Moshpit-owned persistent collections and exist from the start of the product.
- D1 visibility is `private` only. Only the owner can read/edit a Setlist. Collaborators and shared visibility are deferred to D5; Pit roles do not grant Setlist access.
- Creating a Pit from a Setlist requires the caller's expected source revision and takes an ordered transactional snapshot into a separate Live Set.
- D1 assumes one Live Set per Pit (`UNIQUE(pit_id)`). Multiple Live Sets per Pit are not supported yet.
- Pit invitation tokens are single-use, expire after seven days and grant only `crowd` or `viewer`. Admin is assigned only to the Pit creator.
- Guest identity uses a cryptographically random bearer token; only its SHA-256 hash is persisted. Browser storage retains the bearer token and the server slides its expiry to 30 days on authenticated activity. Cross-device recovery/account linking is deferred.
- Setlist and Live Set order uses dense integer positions. Commands require `expectedRevision`, lock the aggregate row, validate that a reorder contains every current item exactly once, and commit all position changes atomically.
- PlaybackSession belongs to the Pit and its Live Set. D1 initializes `mode=individual`, `desiredState=paused`, no current item and position zero; no playback execution is implemented.
- Use versioned SQL migrations and the `pg` driver; no ORM is selected. Runtime input validation uses small module/shared helpers at this stage; a schema library is not selected.
- D1 creates CanonicalTrack rows only for selected/referenced content or deterministic fixtures. ProviderMappings schema is prepared, but real provider adapters/search are deferred to D7.
- The API starts the SQL migration runner before accepting requests. Outbox events are committed with domain changes and published post-commit by a retrying worker.

## Still open

- Whether Setlist deletion becomes archive, tombstone or hard-delete, including historical references.
- Future Setlist collaborator roles and invitation semantics.
- Future multi-Live-Set-per-Pit product behavior.
- Account linking and cross-device guest recovery.
- Presence heartbeat/TTL and Admin succession policy.
- Provider-specific metadata/cache retention and legal/API constraints.


## Dirección UI/UX aprobada — 2026-11-16

- El usuario aprobó el UI/UX Blueprint v0.1 como baseline visual del frontend: tema oscuro y densidad equilibrada (`balanced`).
- La navegación principal tiene Inicio, Explorar, Setlists y Pits. Perfil/configuración se mantienen fuera de la navegación musical primaria.
- Se toman patrones de experiencia musical de Metrolist y claridad de sala colaborativa de CoJam, sin copiar la identidad visual o el producto de esas referencias.
- Desktop usa sidebar persistente; tablet la colapsa a iconos; mobile usa navegación inferior. En la sala Pit mobile, se oculta la navegación inferior global para priorizar los tabs Live Set/Crowd/Detalles y el retorno a Pits.
- Las pantallas D1 muestran únicamente el catálogo de test tracks como demo. No se simula búsqueda de providers, reproducción de audio ni chat.
- UI es presentación y consumo de contratos D1; backend sigue siendo autoridad de permisos, persistencia y estado.

## Phase 2 / D2 Playback Foundation decisions (2026-11-16)

- `PlaybackSession` remains shared Pit/Live Set state. Device-local playback state belongs to a separate `PlaybackEndpoint`.
- An endpoint is scoped to one `(playbackSessionId, identityId, clientInstanceId)`; multiple tabs/devices may have separate endpoints.
- Endpoint states are `idle`, `resolving`, `ready`, `playing`, `paused`, `unavailable` and `error`. Local failures carry a structured failure code and optional safe message.
- Endpoint registration/state reports are authorized against the caller's Pit membership and endpoint ownership. Viewers may report their own local endpoint state; this does not grant shared Live Set or playback-control permissions.
- Endpoint-local failures never mutate `PlaybackSession` or interrupt other endpoints. Endpoint changes have their own revision/outbox aggregate.
- Endpoint capabilities are self-reported effective local capabilities for planning only, not a security boundary; concrete adapters/drivers must verify support before execution.
- `lastReportedAt` is not a PresenceLease and must not be interpreted as proof of online presence. PresenceLease policy remains separate and unresolved.
- D2's `PlaybackCoordinator` creates deterministic Individual Playback plans only. It does not dispatch commands, execute audio, synchronize clocks or implement Stage Playback.
- `PlaybackProviderAdapter` resolves a CanonicalTrack for a provider; `PlaybackEndpointDriver` executes on a local endpoint. No concrete provider or player implementation is introduced in D2.
