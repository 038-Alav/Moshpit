# Phase 1 — Frontend D1

## Dirección de diseño

El frontend implementa el UI/UX Blueprint aprobado: dark mode, balanced density, identidad propia de Moshpit, navegación orientada a música y sala colaborativa. El documento de diseño y los wireframes se encuentran en `docs/ui-ux-blueprint/`.

## Rutas

| Ruta | Vista | Funciones |
|---|---|---|
| `/` | Inicio | Accesos rápidos, Setlists recientes, Pits activos e historial |
| `/explore` | Explorar | Buscar entre test tracks y elegir destino |
| `/setlists` | Biblioteca | Listar y crear Setlists privados |
| `/setlists/:setlistId` | Detalle | Editar detalles; agregar/quitar/reordenar; crear Pit |
| `/pits` | Pits | Activos, historial, crear y unirse por código |
| `/pits/:pitId` | Sala | Live Set, Crowd, roles, invitaciones, detalles y finalizar |
| `/join/:inviteToken` | Invitación | Aceptar un código recibido por enlace |
| `/profile` | Perfil | Identidad guest y límites de cuenta actuales |

## Flujo de navegación y sesión

La identidad guest se obtiene/valida con `GET /api/me` y `POST /api/identity/guest`; el token permanece en `localStorage`. Las rutas profundas identifican el recurso a reabrir al recargar. La membresía y el rol se validan de nuevo desde el servidor. `sessionStorage` mantiene un ID de Pit por pestaña para evitar que una respuesta tardía de snapshot sustituya otra selección.

`Ctrl+K` o `⌘K` abre Explorar. Desktop utiliza sidebar; tablet reduce la sidebar a iconos con labels accesibles; mobile usa bottom nav. En la sala Pit móvil, el bottom nav global se oculta y se usan tabs internas para Live Set, Crowd y Detalles.

## Realtime

El cliente solicita JWT de conexión y suscripción a Fastify. La conexión Centrifugo solo se establece al visualizar una sala Pit activa. `subscribed` y `publication` actualizan el estado de conexión y provocan lectura de snapshot; no existe polling periódico. La publicación no se interpreta como fuente de verdad: el snapshot HTTP es el estado autoritativo.

## Permisos y estados

- Admin: edita Live Set, genera invitaciones Crowd/Viewer y finaliza el Pit.
- Crowd: edita el Live Set.
- Viewer: consulta en modo lectura.
- Pit finalizado: historial read-only.
- Setlists D1: privados, solo owner. Los permisos de Pit no conceden edición de Setlists.
- Errores de comando se muestran en feedback global; errores de invitación se exponen en el flujo de unión.

La UI oculta acciones no permitidas, pero Fastify continúa imponiendo permisos.

## Componentes compartidos

- `AppShell`: navegación desktop/tablet/mobile, topbar, perfil y Pits activos.
- `Artwork`: portadas abstractas estables para los datos de demo.
- `TrackRow`: fila musical y controles accesibles de orden/eliminación.
- `Modal`: formularios para crear/editar Setlist, crear Pit y unirse mediante código.
- `Icon`: set de iconos lineales local sin dependencia adicional.

## Límites funcionales D1

No hay providers reales, búsqueda federada, catálogo completo, importación de bibliotecas locales, audio, controles de reproducción, MiniPlayer, chat, voting, Stage Playback, colaboración de Setlists ni PresenceLease. El catálogo visible es exclusivamente de prueba.

## Pruebas manuales recomendadas

1. Como Admin, crear Setlist, agregar A/B/C, cambiar el orden, editar nombre y descripción.
2. Crear un Pit desde ese Setlist y comprobar que el Live Set es una copia independiente.
3. Abrir una segunda sesión guest, aceptar invitación Crowd, reordenar y comprobar ambos clientes.
4. Aceptar invitación Viewer y verificar que no aparecen acciones de edición y que el backend las rechaza si se intenta llamar directamente.
5. Recargar `/pits/:pitId` como Admin, Crowd y Viewer y comprobar recuperación de snapshot/rol.
6. Finalizar un Pit y comprobar su presencia en Historial y su vista read-only.
7. Verificar que un Pit terminado no intenta mantener conexión Centrifugo.
8. Revisar layout a 1440px, 1024px, 768px, 390px y 320px. En mobile, la sala Pit debe usar solo sus tabs internas, sin bottom nav global.

## Validación técnica pendiente

La entrega preparada pasó revisión sintáctica TS/TSX y typecheck auxiliar con stubs locales. El entorno de empaquetado no pudo descargar los paquetes npm, por lo que aún deben ejecutarse con dependencias reales: `pnpm install`, `pnpm typecheck`, `pnpm test` y `pnpm build`. La revisión de contraste WCAG AA y las capturas de navegador real siguen pendientes de ejecución en el entorno Windows del usuario.
