# Moshpit — Demo 1 Foundation

Starter monorepo para iniciar Demo 1. Está preparado para abrirse como workspace en **Visual Studio Code**. También puede abrirse como carpeta en Visual Studio 2022, aunque no incluye una solución `.sln` porque el stack es Node.js/TypeScript.

## Principio de infraestructura

**Moshpit no depende de Docker ni de Podman.** Son herramientas opcionales para empaquetar y ejecutar servicios. El backend también puede desarrollarse y desplegarse como proceso Node.js nativo; PostgreSQL y Centrifugo pueden ejecutarse como servicios/binarios nativos.

El camino recomendado para este entorno Windows es desarrollo nativo, sin WSL2, Hyper-V, Docker Desktop ni Podman Desktop. La ruta contenedorizada queda disponible para otros equipos, CI o servidores Linux.

## Qué incluye

- Monorepo `pnpm` con `apps/api`, `apps/web` y `packages/contracts`.
- API Fastify con endpoints de health/readiness.
- Prueba unitaria HTTP inicial para `GET /api/health` usando `node:test`.
- PostgreSQL 17 y Centrifugo `v6.10.3` en Compose opcional.
- Dockerfile opcional para compilar y ejecutar el backend Fastify.
- Puerto interno `RealtimePublisher` y adaptador inicial para publicar mediante la API HTTP de Centrifugo.
- Contratos TypeScript iniciales para identidad, Pit, PresenceLease, PlaybackSession y eventos realtime.
- CI de GitHub Actions para typecheck, pruebas disponibles, build, validación de la imagen Docker opcional y sintaxis de scripts PowerShell.
- Instrucciones para desarrollo nativo en Windows y despliegue nativo en Linux.

## Requisitos para desarrollo nativo en Windows

- Windows 10/11 de 64 bits.
- Node.js 24.
- pnpm 10.34.9 (el proyecto declara esta versión en `packageManager`).
- PostgreSQL 17 instalado como servicio de Windows.
- Binario de Centrifugo `v6.10.3` para Windows x64.

No se requiere Docker, Podman, WSL2 ni Hyper-V para este flujo.

## Inicio local en Windows (sin contenedores)

El setup sigue el mismo patrón que el entorno Windows de JACKSTAFF: un script prepara PostgreSQL y un lanzador valida el entorno e inicia los tres procesos locales. **No necesitas abrir `psql` ni ejecutar SQL manualmente.**

### Requisitos

- Node.js 24.
- pnpm `10.34.9`.
- PostgreSQL 17 instalado como servicio de Windows.
- Ejecutable Centrifugo `v6.10.3` para Windows x64.

Consulta [`docs/local-development-windows.md`](docs/local-development-windows.md) para los enlaces de instalación y los pasos completos.

### 1. Preparar la base de datos

Inicia el servicio PostgreSQL desde `services.msc`. Luego abre PowerShell en la raíz del proyecto. Si es necesario, habilita scripts para esa ventana y ejecuta:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\windows\Setup-Database.ps1
```

El script localiza `psql.exe`, crea `.env` desde `.env.example` si hace falta, solicita la contraseña administrativa de `postgres` sin guardarla, y crea/actualiza el rol de aplicación y la base descritos por `DATABASE_URL`. Es idempotente y conserva la base si ya existe. El scaffold todavía no define tablas de dominio ni migraciones SQL.

### 2. Configurar Centrifugo

Descarga Centrifugo `v6.10.3`, extrae `centrifugo.exe` y configura su ruta en `.env`:

```dotenv
CENTRIFUGO_BIN=C:\Centrifugo\centrifugo.exe
```

También puedes agregar su carpeta al `PATH`. Los secretos locales de `.env` deben coincidir con `infra/centrifugo/config.json`.

### 3. Iniciar la aplicación

```powershell
.\Start-Moshpit.ps1
```

El lanzador valida Node.js, pnpm, PostgreSQL, Centrifugo y los puertos locales; instala dependencias en la primera ejecución y abre tres ventanas de PowerShell (Centrifugo, API y frontend).

- Web: http://localhost:5173
- API health: http://localhost:3000/api/health
- API readiness: http://localhost:3000/api/ready
- Centrifugo WebSocket: ws://localhost:8000/connection/websocket

Detén cada proceso con `Ctrl+C` en su ventana. PostgreSQL permanece activo como servicio de Windows.

### Verificaciones locales

```powershell
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` ejecuta la prueba unitaria actual de health. Las futuras pruebas de integración podrán utilizar PostgreSQL/Centrifugo nativos o remotos; no requieren Docker en este equipo.

## Infraestructura contenedorizada (opcional)

La Compose stack levanta PostgreSQL, Centrifugo y el backend Fastify. Úsala solamente en un equipo/servidor que ya disponga de Docker Compose o Podman Compose.

Con Docker:

```bash
pnpm infra:docker:up
pnpm infra:docker:logs
pnpm infra:docker:down
```

Con Podman y un proveedor Compose configurado:

```bash
pnpm infra:podman:up
pnpm infra:podman:logs
pnpm infra:podman:down
```

La API queda en `http://localhost:3000`; Centrifugo en `http://localhost:8000`; PostgreSQL en `localhost:5432`. El frontend no se incluye en la Compose stack: puede ejecutarse localmente con `pnpm dev:web` o desplegarse como archivos estáticos.

**No ejecutes `pnpm dev` al mismo tiempo que la API de Compose**, porque ambos intentarían usar el puerto 3000. Para trabajar con el frontend local y backend contenedorizado, utiliza `pnpm dev:web`.

## Despliegue sin Docker en Linux

El backend se compila con TypeScript y se ejecuta como un proceso Node.js normal. El repositorio incluye una unidad de ejemplo `systemd` en `infra/systemd/moshpit-api.service` y una guía en [`docs/deployment.md`](docs/deployment.md).

PostgreSQL y Centrifugo también pueden instalarse como servicios nativos de Linux. Ningún cliente Moshpit ni el backend requieren que Docker esté instalado si se utiliza esta modalidad.

## Estructura

```text
moshpit/
├── .github/workflows/ci.yml
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── src/
│   │   └── test/
│   └── web/
├── packages/contracts/
├── infra/
│   ├── centrifugo/
│   ├── systemd/
│   └── docker-compose.yml
├── Start-Moshpit.ps1
├── scripts/windows/
│   ├── common.ps1
│   ├── Setup-Database.ps1
│   ├── run-api.ps1
│   ├── run-web.ps1
│   └── start-centrifugo.ps1
├── docs/
└── moshpit.code-workspace
```

## Importante: qué NO está implementado todavía

Este es el principio de Demo 1, no una Demo 1 terminada. Aún no implementa:

- Creación/autenticación real de guest identities.
- Creación de Pits, memberships, roles ni Live Set.
- Persistencia de agregados y migraciones de dominio.
- Creación, renovación y expiración de PresenceLeases.
- Sucesión automática de Admin.
- Emisión de JWT de conexión/suscripción de Centrifugo.
- Transactional outbox y worker de publicación.
- RPC Proxy.
- Reproducción real o integraciones con proveedores musicales.
- Suites de pruebas de integración y end-to-end.

Estos elementos se deben implementar después de validar los contratos y completar los siguientes pasos de Demo 1.

## Decisiones técnicas y límites del scaffold

- Fastify es el único backend de dominio y se despliega como monolito modular.
- Centrifugo es infraestructura realtime independiente; no es un servicio de dominio.
- PostgreSQL es la fuente de verdad.
- El scaffold usa el driver `pg` directamente para el health check y deja el acceso a datos aislado. **No se ha seleccionado un ORM**.
- React + Vite se usa como cliente web inicial; Vite es una elección de tooling provisional.
- La autenticación final y el mecanismo de sesión todavía no están implementados ni cerrados.
- Los valores de heartbeat/TTL de PresenceLease son propuestas iniciales, no parámetros definitivos.
- Docker/Podman son opciones de ejecución y empaquetado, no requisitos del producto.

Consulta `docs/decisions.md` antes de ampliar el alcance.
