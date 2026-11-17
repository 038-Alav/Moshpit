# Build y despliegue

Moshpit admite dos modalidades de despliegue del backend: proceso Node.js nativo o contenedor. La modalidad elegida no altera el dominio ni los contratos de Moshpit.

## A. Despliegue nativo en Linux (sin Docker/Podman)

### Requisitos

- Linux x86_64.
- Node.js 24 y pnpm 10.34.9 para compilar.
- PostgreSQL 17, local o remoto.
- Centrifugo `v6.10.3`, local o remoto.

### Compilar

En el servidor o en CI, desde la raíz del repositorio:

```bash
pnpm --version  # debe indicar 10.34.9
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @moshpit/api build
```

El entrypoint generado por el scaffold es `apps/api/dist/apps/api/src/server.js`.

### Configurar el servicio

Crea un usuario de sistema `moshpit`, instala el checkout/build en `/opt/moshpit` y crea `/etc/moshpit/api.env` con valores de producción. Ejemplo orientativo:

```dotenv
NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=3000
DATABASE_URL=postgresql://moshpit:REPLACE_WITH_SECRET@127.0.0.1:5432/moshpit
CENTRIFUGO_URL=http://127.0.0.1:8000
CENTRIFUGO_API_KEY=REPLACE_WITH_SECRET
```

Restringe los permisos del archivo:

```bash
sudo chown root:moshpit /etc/moshpit/api.env
sudo chmod 640 /etc/moshpit/api.env
```

Ajusta `infra/systemd/moshpit-api.service` si el usuario, la ruta del repositorio o la ruta de Node.js difieren de tu servidor. Luego:

```bash
sudo cp infra/systemd/moshpit-api.service /etc/systemd/system/moshpit-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now moshpit-api
sudo systemctl status moshpit-api
```

Logs:

```bash
sudo journalctl -u moshpit-api -f
```

El servicio `moshpit-api.service` administra únicamente Fastify. El repositorio también incluye `infra/systemd/moshpit-centrifugo.service` como plantilla para ejecutar el binario nativo de Centrifugo. Para habilitarlo, instala el binario en `/usr/local/bin/centrifugo`, coloca una configuración de producción en `/etc/moshpit/centrifugo/config.json` y cambia el propietario/permisos para el usuario `moshpit`. Después:

```bash
sudo cp infra/systemd/moshpit-centrifugo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now moshpit-centrifugo
sudo systemctl status moshpit-centrifugo
```

PostgreSQL debe estar instalado/iniciado por separado o proporcionado por otro servidor/infraestructura. Asegúrate de que `CENTRIFUGO_API_KEY` en `/etc/moshpit/api.env` coincida con `http_api.key` en la configuración nativa de Centrifugo. Configura los orígenes permitidos de Centrifugo para el dominio real del frontend y no uses los secretos `local-dev-*`.

Coloca la API detrás de un reverse proxy HTTPS (por ejemplo, Nginx o Caddy) y limita el acceso directo al puerto 3000. El frontend Vite se compila como archivos estáticos con `pnpm --filter @moshpit/web build` y puede publicarse en un servidor estático/CDN.

## B. Despliegue contenedorizado

La imagen del backend se define en `apps/api/Dockerfile`; PostgreSQL, Centrifugo y Fastify se coordinan en `infra/docker-compose.yml`.

Con Docker Compose:

```bash
cp .env.example .env
# Edita .env y sustituye todos los secretos de ejemplo antes de producción.
pnpm infra:docker:up
pnpm infra:docker:logs
```

Con Podman Compose, si el proveedor Compose está instalado:

```bash
pnpm infra:podman:up
```

El stack publica API en `3000`, Centrifugo en `8000` y PostgreSQL en `5432`. En producción, no expongas PostgreSQL públicamente; modifica los puertos del Compose o elimínalos y limita la exposición de API/Centrifugo mediante firewall/reverse proxy.

Para apagar los servicios:

```bash
pnpm infra:docker:down
# o
pnpm infra:podman:down
```

La Compose stack no incluye el frontend. Compílalo y publícalo como archivos estáticos, configurando sus URLs públicas de API y WebSocket para el entorno destino.

## CI y estado de las pruebas

`.github/workflows/ci.yml` ejecuta typecheck, las pruebas declaradas en los workspaces, build y una compilación de validación de la imagen Docker en un runner de GitHub Actions. Un job separado en Windows analiza la sintaxis de los scripts PowerShell de setup y arranque. El runner proporciona su propio entorno; el desarrollador no necesita Docker/Podman en su PC.

La suite actual contiene pruebas unitarias/API y una prueba de integración D1 para PostgreSQL. CI aprovisiona PostgreSQL 17 temporal para ejecutar la integración; todavía falta un entorno de Centrifugo en CI para validar entrega realtime de extremo a extremo, además de pruebas de carga/concurrencia y de PresenceLease cuando esa funcionalidad se implemente.

El scaffold aún no incluye un `pnpm-lock.yaml`. La primera instalación con pnpm lo generará; incorpora ese archivo al control de versiones. Después de añadirlo, cambia el paso de instalación de CI a `pnpm install --frozen-lockfile` para builds reproducibles.
