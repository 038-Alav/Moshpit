# Desarrollo local en Windows (sin Docker ni Podman)

Este es el flujo recomendado para desarrollar Moshpit en Windows cuando Docker Desktop, Podman Desktop, WSL2 o Hyper-V no están disponibles. Es similar al flujo de arranque de JACKSTAFF: un script prepara PostgreSQL y otro valida el entorno e inicia los procesos de la aplicación.

## 1. Requisitos

- Windows 10/11 de 64 bits.
- Node.js 24 x64: <https://nodejs.org/en/download/>.
- pnpm `10.34.9` (si no está instalado: `npm install --global pnpm@10.34.9`).
- PostgreSQL 17 x64 para Windows: <https://www.postgresql.org/download/windows/>.
- Centrifugo `v6.10.3`, ejecutable Windows x86_64: <https://github.com/centrifugal/centrifugo/releases/tag/v6.10.3>.

No instales Docker Desktop ni Podman Desktop para este flujo. PostgreSQL se ejecuta como servicio de Windows; Centrifugo, Fastify y Vite se ejecutan como procesos nativos.

## 2. Instalar PostgreSQL y preparar la base de datos

1. Instala PostgreSQL 17 para Windows. Conserva el puerto `5432` y recuerda la contraseña que asignes al usuario administrador `postgres`.
2. Comprueba que el servicio PostgreSQL esté iniciado desde **Servicios** (`services.msc`). También puedes revisar su estado desde PowerShell:

   ```powershell
   Get-Service *postgres*
   ```

3. Abre PowerShell en la carpeta raíz del repositorio. Si Windows bloquea la ejecución de scripts locales, habilita scripts solo para esa ventana:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

4. Ejecuta el setup automatizado:

   ```powershell
   .\scripts\windows\Setup-Database.ps1
   ```

El script localiza `psql.exe` en el `PATH` o en la carpeta habitual de PostgreSQL, lee `DATABASE_URL` desde `.env` (crea `.env` desde `.env.example` si todavía no existe), solicita la contraseña de `postgres` de forma segura y prepara el rol/base de datos que necesita Moshpit.

La preparación es idempotente: crea el rol si no existe, actualiza sus credenciales/permisos si ya existe, crea la base si falta y corrige su propietario cuando corresponde. Si la base ya existe, conserva sus datos. Finalmente verifica que el rol de aplicación pueda conectarse. **No necesitas abrir SQL Shell ni ejecutar SQL manualmente.**

La contraseña del administrador no se guarda en los archivos del proyecto. La contraseña de desarrollo de la aplicación está en `DATABASE_URL` dentro de `.env`; el script toma ese valor para crear el rol, por lo que puedes cambiarla antes de ejecutar el setup (usa codificación URL para caracteres reservados). Es un valor local de desarrollo y no debe reutilizarse en producción.

> Este script prepara el rol y la base de datos. Las migraciones versionadas del dominio se aplican automáticamente cuando inicia la API; también puedes ejecutarlas manualmente con `pnpm db:migrate`.

## 3. Instalar Centrifugo

1. Descarga el ejecutable Windows x86_64 de Centrifugo `v6.10.3` desde <https://github.com/centrifugal/centrifugo/releases/tag/v6.10.3>.
2. Extrae `centrifugo.exe`, por ejemplo en `C:\Tools\centrifugo\`.
3. Configura la ruta en `.env`:

   ```dotenv
   CENTRIFUGO_BIN=C:\Tools\centrifugo\centrifugo.exe
   ```

   También puedes agregar la carpeta del ejecutable al `PATH` y dejar `CENTRIFUGO_BIN` vacío.

El arranque automatizado utiliza `infra/centrifugo/config.json`. Las claves `local-dev-*` de `.env` y de ese archivo deben coincidir. Son valores exclusivos de desarrollo.

## 4. Iniciar Moshpit

Desde la raíz del repositorio, después de extraer esta actualización o cada vez que cambien los manifiestos `package.json`, sincroniza las dependencias de todos los workspaces. Hazlo antes de ejecutar `typecheck`, `test` o `build`:

```powershell
pnpm install
```

Luego inicia Moshpit:

```powershell
.\Start-Moshpit.ps1
```

El lanzador comprueba Node.js 24, pnpm `10.34.9`, la conexión a PostgreSQL, la ruta/configuración de Centrifugo y los puertos locales. Si `node_modules` no existe realiza la instalación inicial; después de actualizar el proyecto o incorporar dependencias, ejecuta `pnpm install` manualmente antes de iniciar. Luego abre tres ventanas de PowerShell:

- Centrifugo (`:8000`).
- API Fastify (`:3000`).
- Frontend Vite (`:5173`).

Abre:

- Web: <http://localhost:5173>
- API health: <http://localhost:3000/api/health>
- API readiness (comprueba PostgreSQL): <http://localhost:3000/api/ready>
- Centrifugo WebSocket: `ws://localhost:8000/connection/websocket`

Para detener cada proceso, presiona `Ctrl+C` en su ventana. PostgreSQL permanece activo como servicio de Windows.

## 5. Comprobaciones de desarrollo

Desde la raíz, ejecuta:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

La suite incluye pruebas unitarias/API y una prueba de integración D1 que cubre Setlist → Pit → Live Set, orden de canciones, independencia del snapshot, idempotencia e autorización Viewer. Para ejecutar la integración contra una base separada, define `MOSHPIT_TEST_DATABASE_URL` en la sesión de PowerShell antes de ejecutar `pnpm test`. La suite no necesita Docker; sí necesita que la base PostgreSQL de pruebas esté disponible.

También puedes iniciar procesos por separado si ya preparaste sus dependencias:

```powershell
pnpm dev:api
pnpm dev:web
```

En ese caso, inicia Centrifugo aparte con:

```powershell
.\scripts\windows\start-centrifugo.ps1
```

## Solución de problemas

- **No se encuentra `psql.exe`:** agrega `C:\Program Files\PostgreSQL\17\bin` al `PATH` o vuelve a ejecutar el setup después de instalar PostgreSQL.
- **No conecta como `postgres`:** comprueba que el servicio PostgreSQL esté iniciado y que la contraseña administrativa sea correcta.
- **API `not_ready`:** comprueba PostgreSQL, el rol/base de datos y `DATABASE_URL` en `.env`.
- **No se encuentra Centrifugo:** verifica `CENTRIFUGO_BIN` en `.env` y que el archivo exista.
- **Claves Centrifugo no coinciden:** mantén sincronizados `CENTRIFUGO_API_KEY` con `http_api.key` y `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` con `client.token.hmac_secret_key`.
- **Puerto ocupado:** cierra el proceso local que escucha en `3000`, `5173` o `8000` y vuelve a ejecutar el lanzador.
