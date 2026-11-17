# Moshpit — Phase 1 Core Sharing + Phase 2 Playback Foundation

Moshpit es una plataforma musical colaborativa **sharing-first**. Su recorrido principal conecta Setlists persistentes, Pits sociales y Live Sets colaborativos. Este proyecto mantiene un único backend modular; las demos incrementan la misma base de código.

## Principios de producto y datos

- **Setlist:** colección persistente propiedad de Moshpit. En D1 es privada y editable por su propietario.
- **Pit:** contexto social de una sesión; conserva su historial cuando termina.
- **Live Set:** selección musical independiente asociada al Pit. Crear un Pit desde un Setlist copia sus referencias ordenadas; nunca mantiene sincronización implícita con el original.
- **PlaybackSession:** estado compartido asociado al Pit y su Live Set. No es un reproductor ni representa el estado local de cada dispositivo.
- **Música:** PostgreSQL conserva únicamente tracks referenciados por Setlists/Live Sets, no catálogos completos de terceros. Búsqueda federada y adapters reales pertenecen a D7.
- **Bibliotecas locales:** no se escanean ni se requieren. Una importación local explícita podrá evaluarse como adapter futuro.

## Stack

- Node.js 24 + TypeScript.
- pnpm workspaces.
- Fastify modular monolith.
- PostgreSQL como fuente de verdad.
- Centrifugo 6.10.3 como transporte realtime independiente.
- React + TypeScript + Vite.
- Contenedores Docker/Podman opcionales. Desarrollo nativo en Windows y Linux.

## Requisitos para Windows nativo

- Windows 10/11 de 64 bits.
- Node.js 24.
- pnpm 10.34.9.
- PostgreSQL 17 como servicio local.
- Centrifugo 6.10.3 para Windows x64.

No se requiere Docker, Podman, WSL2 ni Hyper-V.

## Inicio local

1. Inicia el servicio PostgreSQL desde `services.msc`.
2. Abre PowerShell en la raíz del proyecto y prepara la base:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\windows\Setup-Database.ps1
```

3. Configura `CENTRIFUGO_BIN` en `.env` y asegúrate de que las claves coincidan con `infra/centrifugo/config.json`.
4. Instala o sincroniza las dependencias (también después de actualizar el proyecto):

```powershell
pnpm install
```

5. Inicia Moshpit:

```powershell
.\Start-Moshpit.ps1
```

El servidor API aplica las migraciones SQL pendientes al iniciar. También puedes ejecutarlas explícitamente:

```powershell
pnpm db:migrate
```

Direcciones locales:

- Web: http://localhost:5173
- API health: http://localhost:3000/api/health
- API readiness: http://localhost:3000/api/ready
- Centrifugo WebSocket: ws://localhost:8000/connection/websocket

El primer acceso crea una guest identity y guarda el token de sesión en el almacenamiento local del navegador. Las rutas profundas (`/pits/:pitId` y `/setlists/:setlistId`) permiten recuperar directamente una sala o colección al recargar. `sessionStorage` conserva por pestaña el Pit activo como protección de selección; no concede acceso. En cada recuperación, el backend vuelve a validar la identidad, la membresía y el rol. Todavía no existe account linking ni recuperación multidispositivo.

## Comprobaciones

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Las pruebas de integración D1 usan una base de datos PostgreSQL dedicada. Configura `MOSHPIT_TEST_DATABASE_URL` antes de ejecutar `pnpm test` para habilitarlas. Sin esa variable, la prueba de integración se omite y siguen ejecutándose las pruebas unitarias/API que no requieren PostgreSQL.

## Qué incluye esta entrega

### Implementado en el primer corte de D1

- Guest identity, bearer session token hasheado en base de datos y sesión deslizante de 30 días.
- Las rutas profundas permiten volver a la sala de Pit al recargar. `sessionStorage` registra el Pit activo por pestaña como protección ante respuestas tardías, pero nunca concede acceso; PostgreSQL vuelve a validar membresía y rol.
- Setlists persistentes privados: crear, consultar, renombrar, agregar/quitar tracks y reordenar con revisión esperada.
- CanonicalTrack mínimo para referencias usadas por Moshpit y tres tracks determinísticos de prueba A/B/C.
- Tabla ProviderMappings preparada para correspondencias futuras; todavía no hay providers reales.
- Crear un Pit vacío o desde un Setlist.
- Al crear desde un Setlist, copiar sus items ordenados en un Live Set independiente y conservar la procedencia de origen.
- Membresías Admin/Crowd/Viewer e invitaciones de un solo uso con expiración de siete días.
- Live Set: agregar/quitar/reordenar tracks para Admin y Crowd; Viewer es de solo lectura.
- PlaybackSession persistida con estado inicial `paused` y modo `individual`; sin reproducción real.
- D2 Playback Foundation: PlaybackEndpoint independiente por identidad/runtime, estados locales, capacidades y reporte de fallos sin mutar PlaybackSession.
- Contratos provider-neutral `PlaybackProviderAdapter` y `PlaybackEndpointDriver`, además de `PlaybackCoordinator` para crear planes Individual Playback deterministas (sin dispatch ni audio).
- Migración SQL, transacciones, idempotency keys, optimistic concurrency y transactional outbox.
- Worker de outbox y publicación post-commit en canales privados Centrifugo mediante JWT de conexión/suscripción.
- Snapshot HTTP del Pit para recuperación y carga inicial.
- Frontend D1 con cuatro secciones principales: Inicio, Explorar, Setlists y Pits; detalle de Setlist; biblioteca e historial de Pits; sala del Pit con Live Set, Crowd, detalles, invitaciones y roles; aceptación de invitaciones por enlace/código; perfil guest.
- Interfaz de creación y edición de Setlists, incorporación/eliminación/reordenamiento de tracks, creación de Pits vacíos o desde Setlists, y edición colaborativa del Live Set para Admin/Crowd.
- Navegación de rutas profundas, recuperación de Pit al recargar y suscripción Centrifugo solo mientras se visualiza una sala activa.
- Catálogo de demostración claramente rotulado; no se presenta como búsqueda externa ni como catálogo de proveedores.
- UI responsive desktop/tablet/mobile basada en el UI/UX Blueprint aprobado: tema dark, densidad balanced, sidebar desktop y navegación inferior móvil (oculta dentro de la sala del Pit para no competir con sus pestañas internas).
- Prueba de integración automatizada para independencia Setlist/Live Set, idempotencia y autorización Viewer.

### Phase 1 — Validación en el entorno del usuario

El usuario confirmó manualmente en Windows que dos guests reciben los cambios de orden del Live Set, Viewer no puede reordenar, recargar restaura el Pit, Centrifugo reconecta después de una interrupción de red y el build del frontend actualizado funciona. La suite automatizada completa de la última entrega aún no está confirmada.

### Pendiente de D1 / siguientes incrementos

- Prueba de carga y pruebas adicionales de concurrencia sobre PostgreSQL.
- Snapshot/revision gap recovery completamente automatizado en el cliente; la sala ya recupera snapshot al entrar y al recibir publicaciones realtime.
- Auditoría visual con navegador real en anchos desktop/tablet/mobile y verificación formal de contraste WCAG AA.
- Creación de Setlist desde un Pit terminado.
- Edición colaborativa y permisos de Setlist.
- Gestión avanzada del ciclo de vida de sesión y account linking.
- Reproducción de audio, dispatch de directivas a drivers y comandos compartidos play/pause/next/previous.
- Reconciliación completa y recuperación avanzada de endpoints, sincronización de relojes y drift correction.
- Adaptadores reales de proveedores y Stage Playback.

### Phase 2 — Playback Foundation (D2)

- `PlaybackEndpoint` independiente por identidad/runtime, capabilities y estados locales.
- Registro y reporte autenticado de endpoint por HTTP, con revisión propia e idempotencia.
- `PlaybackCoordinator` determinista que prepara planes Individual Playback sin despacharlos.
- Contratos provider-neutral para `PlaybackProviderAdapter` y `PlaybackEndpointDriver`.
- Las fallas locales no mutan PlaybackSession ni interrumpen otros endpoints.

### Fuera de D2 / siguientes incrementos

- Búsqueda federada real y adapters Spotify/YouTube/YouTube Music.
- Importación de bibliotecas de proveedores o del dispositivo.
- Ejecución real de audio y despacho a endpoint drivers.
- Sincronización de reloj, drift correction, Stage Playback.
- Voting, presencia con leases y sucesión de Admin.

## Estructura

```text
moshpit/
├── apps/
│   ├── api/
│   │   ├── migrations/
│   │   ├── src/modules/
│   │   │   ├── identity/
│   │   │   ├── setlists/
│   │   │   ├── pits/
│   │   │   ├── live-sets/
│   │   │   ├── playback/
│   │   │   └── realtime/
│   │   └── test/
│   └── web/
├── packages/contracts/
├── infra/centrifugo/
├── scripts/windows/
└── docs/
```

## Comandos HTTP principales

Los endpoints de dominio requieren `Authorization: Bearer <sessionToken>`. Los comandos que cambian estado requieren `Idempotency-Key`. Las mutaciones de agregados requieren `expectedRevision`.

- `POST /api/identity/guest`, `GET /api/me`
- `GET/POST /api/setlists`, `GET/PATCH /api/setlists/:setlistId`
- `POST /api/setlists/:setlistId/items`, `DELETE /api/setlists/:setlistId/items/:itemId`
- `PATCH /api/setlists/:setlistId/items/reorder`
- `GET /api/music/test-tracks`
- `GET/POST /api/pits`, `GET /api/pits/:pitId/snapshot`
- `POST /api/pits/:pitId/invitations`, `POST /api/pit-invitations/accept`
- `POST/DELETE /api/pits/:pitId/live-set/items`, `PATCH /api/pits/:pitId/live-set/items/reorder`
- `GET /api/realtime/connection-token`, `GET /api/pits/:pitId/realtime-token`
- `POST/GET /api/pits/:pitId/playback/endpoints`, `PATCH /api/pits/:pitId/playback/endpoints/:endpointId/state`
- `POST /api/pits/:pitId/end`

## Decisiones temporales de D1

- Setlists son privados y solo el propietario puede editarlos; sharing/collaborators se amplían en D5.
- Un Pit tiene un único Live Set activo en D1.
- Pit invite codes son de un solo uso, roles Crowd o Viewer y vencen en siete días.
- La sesión guest usa bearer token aleatorio; el servidor persiste solo su SHA-256. El navegador conserva el token por 30 días renovables. No es un mecanismo de cuenta ni de recuperación en otro dispositivo.
- El orden es una lista densa de posiciones enteras. El cliente envía la lista completa de IDs con `expectedRevision`; el backend bloquea el agregado, valida la permutación completa y reescribe posiciones de forma atómica.
- Las migraciones son SQL versionadas y ejecutadas con un runner pequeño sobre `pg`; no se ha elegido ORM.

Consulta `docs/phase2-playback-foundation.md` para los contratos y el alcance D2.

Consulta `docs/PRODUCT_ENGINEERING_BLUEPRINT_v0.1.md`, `docs/ui-ux-blueprint/MOSHPIT_UI_UX_BLUEPRINT_v0.1.md`, `docs/demo-1-scope.md`, `docs/decisions.md`, `docs/frontend-phase1.md` y `docs/phase1-implementation-status.md` para el alcance y los límites actuales.
