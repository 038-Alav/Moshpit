# Moshpit — UI/UX Blueprint v0.1

**Estado:** baseline visual aprobada por el usuario; implementada en el frontend D1 con validación visual en navegador pendiente  
**Producto:** Moshpit  
**Versión:** 0.1  
**Dirección confirmada por el usuario:** dark mode · densidad balanced  
**Alcance:** estructura de información, navegación, wireframes, lenguaje visual, estados y comportamiento responsive. El frontend D1 implementa este baseline; este documento conserva los criterios y límites de producto.

---

## 1. Objetivo de diseño

Moshpit debe sentirse como una aplicación musical colaborativa, no como un dashboard administrativo ni como una landing page con herramientas debajo.

La experiencia debe hacer evidentes tres acciones centrales:

1. **Organizar música** en Setlists propios de Moshpit.
2. **Compartir música** reuniendo personas dentro de un Pit.
3. **Construir música juntos** mediante el Live Set compartido del Pit.

La UI no debe obligar a conocer el modelo técnico. La persona debería poder encontrar su música, volver a una sesión o invitar a alguien sin aprender conceptos internos como agregados, revisiones, snapshots o providers.

### Principios UX

- **Music-first:** portadas, canciones, artistas y colecciones tienen mayor jerarquía visual que métricas o datos técnicos.
- **Sharing-first:** crear un Pit desde un Setlist y volver a un Pit activo deben ser acciones visibles.
- **Una tarea principal por pantalla:** evitar mezclar biblioteca, administración de sesiones, configuración y bienvenida en una sola vista.
- **Claridad antes que decoración:** superficies, espaciado y tipografía organizan la información; no usar adornos para llenar espacio.
- **Acciones contextuales:** agregar a un Setlist, agregar a un Live Set, invitar o editar deben aparecer donde se necesitan.
- **Permisos comprensibles:** Admin, Crowd y Viewer deben entenderse en la interfaz, pero la autorización siempre sigue siendo responsabilidad del backend.
- **Responsive real:** el diseño móvil no será una versión desktop encogida.

---

## 2. Decisiones confirmadas y propuestas

### Confirmado

| Decisión | Estado |
|---|---|
| Tema oscuro inicial | Confirmado |
| Densidad equilibrada | Confirmado |
| Navegación Inicio / Explorar / Setlists / Pits | Confirmada |
| Sidebar desktop, bottom nav mobile y tabs Pit internas | Confirmado como baseline |
| Referencias de experiencia | Metrolist y CoJam |
| Identidad y componentes propios | Requerido |
| Setlists, Pits y Live Sets como núcleo | Confirmado por el Product & Engineering Blueprint |
| Live Set dentro del Pit; no como sección principal separada | Coherente con el modelo de producto |
| No simular playback real en D1 | Requerido por el alcance de D1 |

### Tokens y detalles sujetos a revisión visual posterior

- Paleta base near-black con superficies ligeramente elevadas.
- Violeta como acento principal de interacción; verde reservado para señales explícitas de estado en curso/conectado en el contexto que corresponda.
- Tipografía sans-serif única (Inter o equivalente de sistema) para reducir ruido.
- Navegación desktop lateral y navegación móvil inferior.
- Cuatro destinos principales: Inicio, Explorar, Setlists y Pits.
- Sala del Pit con Live Set como columna principal y Crowd como panel secundario.

Estos valores son el baseline aplicado en la primera implementación; pueden ajustarse tras revisión visual en navegador real. No cambian los contratos de dominio.

---

## 3. Referencias y qué aprendemos de ellas

### Metrolist — experiencia musical

Tomamos como referencia su orientación de reproductor musical: biblioteca, búsqueda por tipos de contenido, listas de canciones y controles familiares; su proyecto declara Material 3 y modos de tema Dark/Black/Dynamic. Moshpit no debe copiar su navegación Android literalmente, pero sí su enfoque de música reconocible y controles directos.

Referencia: https://github.com/MetrolistGroup/Metrolist

### CoJam — experiencia de sesión compartida

Tomamos como referencia la lectura inmediata de una sala: estado de la sesión, elemento musical actual, personas y cola compartida. Su guía de diseño documenta una sala desktop de paneles oscuros, con áreas para now-playing/listeners, queue y chat, y una adaptación a pestañas en móvil. Moshpit adopta la claridad de jerarquía, no su identidad visual, sus decisiones de color ni necesariamente su distribución exacta. El chat queda fuera de D1 y no se añadirá por analogía.

Referencias:
- https://github.com/LucasSantana-Dev/cojam
- https://raw.githubusercontent.com/LucasSantana-Dev/cojam/main/DESIGN.md

### Regla

**Borrow interaction patterns, not product identity.** Moshpit debe conservar su vocabulario y diseñar una experiencia centrada en su propio flujo Setlist → Pit → Live Set.

---

## 4. Arquitectura de información

### Navegación principal

1. **Inicio** — regresar a contenido reciente, Setlists y Pits activos.
2. **Explorar** — buscar música y decidir dónde agregarla.
3. **Setlists** — biblioteca persistente de colecciones propias.
4. **Pits** — sesiones activas e historial.

**Configuración y perfil** viven en el menú del usuario, no como destinos musicales principales.

No crear una sección superior independiente de Live Sets: un Live Set pertenece a un Pit y se administra dentro de él.

### Mapa de navegación propuesto

```text
Moshpit
├── Inicio
│   ├── Pits activos / continuar Pit
│   ├── Setlists recientes
│   └── Acciones rápidas: Crear Setlist / Crear Pit
├── Explorar
│   ├── Buscar
│   ├── Canciones / Álbumes / Artistas
│   └── Acción contextual: Agregar a…
├── Setlists
│   ├── Biblioteca
│   └── Detalle de Setlist
│       ├── Editar detalles
│       ├── Ordenar / quitar canciones
│       └── Crear Pit
├── Pits
│   ├── Activos
│   ├── Historial
│   ├── Crear Pit
│   ├── Unirse mediante invitación
│   └── Sala de Pit
│       ├── Live Set
│       ├── Crowd
│       ├── Invitaciones (según rol)
│       └── Detalles de sesión
└── Perfil / Configuración
```

### Rutas conceptuales

Las rutas son propuesta de navegación para la futura implementación; no se asume que el router ya exista.

| Pantalla | Ruta conceptual |
|---|---|
| Inicio | `/` |
| Explorar | `/explore` |
| Biblioteca de Setlists | `/setlists` |
| Detalle de Setlist | `/setlists/:setlistId` |
| Pits | `/pits` |
| Sala de Pit | `/pits/:pitId` |
| Aceptar invitación | `/join/:inviteToken` |
| Configuración | `/settings` |

Una URL de invitación debe permitir entrar al flujo de aceptación, pero la pertenencia y el rol se resuelven en el servidor.

---

## 5. Layout global

### Desktop (≥ 1200 px)

- Sidebar persistente de aproximadamente 224–240 px.
- Área de contenido flexible, con ancho máximo para evitar líneas excesivamente largas.
- Header superior de contenido con búsqueda global, perfil y estado de identidad.
- Contenido con gutters de 24–32 px.
- Mantener el Pit dentro del mismo shell al menos en la primera versión; la sala puede reducir elementos de navegación si el ancho requiere más espacio.

### Tablet (768–1199 px)

- Sidebar colapsada a iconos con tooltips y labels accesibles.
- Contenido a una columna cuando no haya espacio suficiente para dos paneles.
- Paneles secundarios pasan debajo de la tarea principal, no a una columna estrecha.

### Mobile (< 768 px)

- Top bar compacto.
- Navegación inferior: Inicio, Explorar, Setlists, Pits.
- Objetivos táctiles de al menos 44 × 44 CSS px.
- En la sala de Pit, priorizar el Live Set y usar tabs internos `Live Set` / `Crowd` / `Detalles`; la implementación oculta la navegación global inferior dentro de la sala para dar espacio. Ofrecer retorno claro a Pits.
- No mostrar paneles secundarios en dos columnas comprimidas.

---

## 6. Lenguaje visual

### 6.1 Paleta propuesta

La paleta es un punto de partida visual para revisar; los valores finales se deben comprobar con contraste WCAG AA en componentes reales.

| Token | Valor propuesto | Uso |
|---|---|---|
| `bg.canvas` | `#0D0E12` | Fondo principal |
| `bg.sidebar` | `#12141A` | Navegación |
| `surface.1` | `#171A21` | Paneles principales |
| `surface.2` | `#1E222B` | Campos, panel elevado |
| `surface.3` | `#252A35` | Hover/selección |
| `border.subtle` | `#2D323D` | Separadores y bordes |
| `text.primary` | `#F3F4F7` | Texto principal |
| `text.secondary` | `#A5AAB6` | Metadatos importantes |
| `text.muted` | `#747B89` | Texto auxiliar |
| `accent.primary` | `#9B7BFF` | Acción primaria, foco, enlaces |
| `accent.surface` | `#2D2545` | Selección y fondo de acento |
| `status.live` | `#65D6A2` | Estado activo / en curso cuando corresponda |
| `status.warning` | `#E6B76C` | Reconexión / advertencia |
| `status.error` | `#EF7E87` | Error / acción destructiva |

Reglas:
- Violeta identifica interacción, no todos los contenedores.
- Verde no es un color decorativo general; se reserva para estado activo o en curso cuando la etiqueta lo haga inequívoco.
- No recolorear portadas para forzarlas a la paleta.
- Los colores de marcas de providers solo aparecen en badges pequeños cuando una integración real lo justifique.
- No usar gradientes de alto impacto en cada card, blur/glass o glow decorativo por defecto.

### 6.2 Tipografía

- Una familia sans-serif principal (Inter o equivalente `system-ui`).
- Pesos 400, 500, 600 y 700.
- Escala: 12 / 14 / 16 / 20 / 24 / 30 / 36 px.
- Títulos de página 28–32 px desktop y 24–28 px mobile.
- Metadatos no deben ser el texto más pequeño e ilegible del diseño; objetivo mínimo 12 px en uso normal.
- No mezclar una fuente monoespaciada para todos los metadatos: reservarla para códigos, IDs o estados técnicos puntuales.

### 6.3 Espaciado, radios y densidad

- Base de espaciado de 4 px; valores comunes 8, 12, 16, 24 y 32 px.
- Densidad **balanced**: filas musicales de aproximadamente 60–68 px, carátulas de 40–48 px en filas, 88–112 px en tarjetas de colección.
- Radios: 8 px para controles, 10–14 px para paneles.
- Bordes de 1 px, sombras mínimas o inexistentes.
- Evitar tanto listas excesivamente apretadas como grandes espacios vacíos sin propósito.

### 6.4 Iconografía y movimiento

- Un único set de iconos lineales (Lucide o equivalente), tamaño habitual 18–20 px.
- Iconos siempre acompañados de texto en acciones importantes; no depender solo del icono para invitar, eliminar o finalizar un Pit.
- Animaciones cortas y funcionales para selección, apertura de menús y cambios de estado.
- Respetar `prefers-reduced-motion`.
- No usar una animación permanente para simular actividad cuando no hay reproducción real.

---

## 7. Definición de pantallas y wireframes

Los SVG incluidos son **wireframes estructurales de baja fidelidad con tokens oscuros de referencia**. No son diseños finales de producción ni incluyen arte de álbumes real.

### 7.1 Inicio

**Objetivo:** que la persona retome su actividad o cree una nueva experiencia musical.

Orden visual:
1. Saludo y contexto personal breve.
2. Acciones rápidas `Crear Setlist` y `Crear un Pit`.
3. Pits activos (prioridad sobre historial).
4. Setlists recientes.
5. Historial reciente, cuando haya espacio.

No incluir métricas de vanidad, gráficos ni una gran ilustración hero. El contenido musical debe ocupar la pantalla.

**Acciones:** volver a un Pit, abrir un Setlist, crear una colección, crear un Pit vacío.

**Vacío:** mostrar un mensaje corto y las dos acciones principales. No mostrar paneles vacíos ni placeholders de actividad ficticios.

Wireframes:
- Desktop: `wireframes/desktop-home.svg`
- Mobile: `wireframes/mobile-home.svg`

### 7.2 Explorar

**Objetivo:** encontrar música y elegir explícitamente dónde agregarla.

Orden visual:
1. Búsqueda prominente.
2. Filtros por tipo de resultado: Todo, Canciones, Álbumes, Artistas.
3. Resultados como filas musicales reconocibles (portada, título, artista, duración si existe).
4. Acción `Agregar` o menú `Agregar a…`.
5. Destinos recientes: Setlists propios y Live Set de un Pit activo cuando el usuario tenga permiso.

No crear un catálogo local espejo de Spotify/YouTube. La búsqueda externa será federada/on-demand a través de adapters, como establece el Product & Engineering Blueprint.

**Alcance D1:** no hay búsqueda real multi-provider. La pantalla de D1 solo puede mostrar el catálogo de demostración/test tracks y debe indicarlo con claridad. No debe simular resultados de proveedores reales.

**Acciones:** agregar a Setlist, agregar a Live Set, abrir detalle de artista/álbum cuando haya datos.

Wireframes:
- Desktop: `wireframes/desktop-explore.svg`
- Mobile: `wireframes/mobile-explore.svg`

### 7.3 Biblioteca de Setlists

Esta pantalla lista los Setlists persistentes del usuario. Cada fila/tarjeta debe comunicar portada/composición, nombre, cantidad de canciones y propiedad/visibilidad cuando ese dato esté disponible.

Acciones principales: crear Setlist, abrir, buscar/ordenar biblioteca. No confundir esta biblioteca con historial de Pits.

La lista de Setlists colaborativos se incorporará cuando existan permisos y colaboración de Setlists (D5); D1 muestra solo Setlists privados del propietario.

### 7.4 Detalle de Setlist

**Objetivo:** entender una colección, modificarla y convertirla en una experiencia compartida.

Header:
- Portada o collage de portadas.
- Nombre y descripción.
- Propietario y visibilidad.
- Acción primaria `Crear un Pit`.
- Acciones secundarias: editar detalles y menú contextual.

Contenido:
- Lista ordenada de canciones.
- Filas con portada, título, artista, duración y menú.
- Reordenamiento accesible (drag handle cuando esté implementado; controles arriba/abajo como fallback accesible).
- Acción `Agregar música` abre búsqueda/selector en un panel o drawer contextual.

Crear un Pit desde este detalle debe ser explícito. La UI debe explicar de forma breve que se crea un Live Set independiente a partir de la selección actual.

**D1:** controles de reorder/add/remove según el rol de propietario; el catálogo es de prueba. Compartir Setlists con colaboradores queda fuera de D1.

Wireframes:
- Desktop: `wireframes/desktop-setlist.svg`
- Mobile: `wireframes/mobile-setlist.svg`

### 7.5 Pits — listado e historial

Página con tabs `Activos` y `Historial`.

Cada Pit muestra nombre, estado, cantidad de miembros y cantidad de canciones en su Live Set, si estos datos están disponibles. La acción principal de un Pit activo es `Entrar`; en historial es `Ver historial`.

Acciones de página:
- `Crear Pit` (desde un Setlist o vacío).
- `Unirme con invitación`.
- Filtrar/buscar Pits propios.

### 7.6 Sala de Pit

**Objetivo:** hacer evidente la selección musical que el grupo está construyendo y quién participa.

Desktop:
- Header con breadcrumb, nombre del Pit, estado, rol y acción `Invitar`.
- Columna principal: área `Ahora / Reproducción` (o estado vacío), seguida del Live Set.
- Panel secundario: Crowd, invitaciones según permiso y detalles de la sesión.
- Lista de canciones: orden, portada, título, artista, duración y controles según rol.
- Estado realtime discreto: Conectado / Reconectando / Sin conexión.

Mobile:
- Header compacto con retorno a Pits, nombre y acción de invitar.
- Indicador del Pit y del rol.
- Tabs internas `Live Set`, `Crowd`, `Detalles`.
- Live Set como tab inicial.
- No hacer que el panel de Crowd empuje toda la cola debajo de una lista muy larga.

**Roles visibles:**
- Admin: puede invitar, finalizar Pit y administrar Live Set.
- Crowd: puede agregar, quitar y reordenar Live Set según política D1.
- Viewer: puede leer el contenido; no se muestran controles de edición. Una etiqueta `Solo lectura` explica el límite.

La UI oculta acciones no permitidas para facilitar la comprensión, pero esto no reemplaza la autorización server-side.

**Playback en D1:** `PlaybackSession` existe como estado persistente, pero no hay reproducción de audio real. La pantalla debe mostrar un estado neutral como `Reproducción aún no disponible en esta demo` o `Sesión en pausa`; no mostrar controles play/pause/next activos ni simular un track sonando.

**Pit finalizado:** modo de solo lectura con estado `Finalizado` y mensaje de historial conservado. No mostrar acciones de edición/invitación para un Pit terminado.

**Chat:** no forma parte de D1 ni se debe añadir solo porque una referencia lo tenga.

Wireframes:
- Desktop: `wireframes/desktop-pit.svg`
- Mobile: `wireframes/mobile-pit.svg`

---

## 8. Componentes reutilizables

### Navegación y shell

- `AppShell`
- `SidebarNavigation`
- `MobileNavigation`
- `TopBar`
- `GlobalSearchTrigger`
- `UserMenu`
- `PageHeader`
- `Breadcrumbs`

### Música

- `AlbumArtwork` (con variantes y fallback estable)
- `TrackRow`
- `TrackList`
- `TrackContextMenu`
- `AddMusicPanel` / `AddMusicDrawer`
- `SetlistCard`
- `SetlistHeader`
- `SearchResultRow`
- `AddToDestinationMenu`

### Pits

- `PitCard`
- `PitStatusBadge`
- `PitHeader`
- `LiveSetQueue`
- `CrowdMemberRow`
- `CrowdAvatarStack`
- `InviteDialog`
- `PitRoleBadge`
- `RealtimeStatusIndicator`
- `PlaybackStatusPanel`

### Feedback y estado

- `Toast`
- `InlineError`
- `EmptyState`
- `SkeletonRow` / `SkeletonPanel`
- `ConfirmDialog`
- `PermissionNotice`

Los componentes de presentación reciben datos y callbacks. No deben contener lógica de dominio ni crear reglas paralelas a las del backend.

---

## 9. Estados que toda pantalla debe contemplar

| Estado | Comportamiento UX |
|---|---|
| Cargando | Skeleton con geometría cercana al contenido final; no bloquear toda la aplicación si solo carga un panel |
| Vacío | Explicar qué falta y ofrecer una acción relevante |
| Error | Mensaje concreto, contexto y reintento cuando sea seguro |
| Sin conexión | Mantener visible el último snapshot conocido con estado de conexión claro; no aceptar comandos como exitosos sin confirmación del servidor |
| Reconectando | Indicador discreto; al reconectar, recuperar snapshot y reconciliar revisión |
| Actualizando | Feedback localizado en la acción afectada, no toast constante |
| Sin permiso | Mostrar lectura y explicar el rol; ocultar controles de mutación |
| Pit finalizado | Vista de historial, solo lectura |
| Invitación vencida/consumida | Explicar que el código ya no es válido y ofrecer volver a pedir una invitación |

### Realtime y snapshot

- La UI debe suscribirse a eventos del Pit y aplicar el estado conforme a revisión/eventos.
- Obtener snapshot al entrar, al recuperar conexión, ante gap de revisión o cuando la lógica de reconciliación lo requiera.
- **No implementar polling permanente de snapshots como sustituto del realtime.**
- La pantalla no debe realizar refetch a intervalos agresivos solo por permanecer abierta.
- La presentación de `Conectado` debe reflejar el estado real de la suscripción, no solo la emisión exitosa de un JWT.

---

## 10. Accesibilidad y calidad

- Contraste WCAG AA para texto normal y controles.
- Foco visible en navegación por teclado.
- Semántica de encabezados y landmarks.
- Labels accesibles para icon-only controls.
- Áreas táctiles de mínimo 44 × 44 px en móvil.
- No comunicar rol, estado ni selección solo mediante color.
- Soportar `prefers-reduced-motion`.
- Inputs en móvil con tamaño de texto de al menos 16 px para evitar zoom inesperado en navegadores móviles.
- Confirmación para acciones destructivas como finalizar un Pit.

---

## 11. Alcance visual por entrega

### D1 — Core Sharing Foundation

Implementar las pantallas y flujos mínimos para validar:

- Shell y navegación principal.
- Biblioteca y detalle básico de Setlists privados.
- Catálogo de test tracks claramente etiquetado.
- Crear Pit desde Setlist o vacío.
- Sala Pit con Live Set compartido.
- Crowd y roles Admin/Crowd/Viewer.
- Invitaciones y estado de conexión.
- Vista de Pit finalizado.
- Loading, empty, error y read-only states.

No incluir:
- Búsqueda real de providers.
- Portadas reales garantizadas.
- Playback real ni barra de transporte funcional.
- Chat, votaciones o Stage Playback.
- Colaboración avanzada de Setlists.

### D5 / D7 / versiones posteriores

- D5: Setlist collaborators, compartir biblioteca y colaboración avanzada.
- D7: Explorar con búsqueda federada real y adapters.
- D2–D6: enriquecer estados del Playback panel y las experiencias Individual/Stage conforme existan contratos y playback real.
- Versiones futuras: chat/reacciones solo si se aprueban como producto y se definen contratos/alcance.

---

## 12. Criterios de aceptación del UI Blueprint

La dirección base fue aprobada y el frontend D1 ya la implementa. La verificación completa en navegador todavía requiere revisión desktop/tablet/mobile. Los criterios que deben mantenerse son:

1. Navegación principal con Inicio, Explorar, Setlists y Pits.
2. Composición de Inicio, Explorar, Setlist y Pit coherente con sus wireframes.
3. Navegación móvil propia, con tabs internas en la sala Pit y retorno claro a Pits.
4. Separación entre alcance D1 y funcionalidades posteriores.
5. Dark mode y densidad balanced; paleta y detalles finos ajustables tras UAT.
6. Estados de permisos, realtime, reconexión e historial.

Durante los siguientes ajustes:

- Los cambios deben mantener los contratos del Product & Engineering Blueprint.
- No se altera identidad, autorización o modelo de dominio para acomodar una pantalla.
- Cada pantalla debe funcionar con datos reales del backend o mostrar claramente que usa test fixtures.
- Entregar capturas desktop y mobile para revisión visual.
- No declarar aprobado un componente solo porque compile; revisar jerarquía, accesibilidad y responsive.

---

## 13. Wireframes incluidos

| Pantalla | Desktop | Mobile |
|---|---|---|
| Inicio | `wireframes/desktop-home.svg` | `wireframes/mobile-home.svg` |
| Explorar | `wireframes/desktop-explore.svg` | `wireframes/mobile-explore.svg` |
| Detalle de Setlist | `wireframes/desktop-setlist.svg` | `wireframes/mobile-setlist.svg` |
| Sala de Pit | `wireframes/desktop-pit.svg` | `wireframes/mobile-pit.svg` |

Ver `wireframes/index.html` para una galería de todos los wireframes.

---

## 14. Relación con el Product & Engineering Blueprint

Este documento desarrolla la capa de experiencia y presentación del `PRODUCT_ENGINEERING_BLUEPRINT_v0.1.md`. No reemplaza sus decisiones sobre:

- Setlist / SetlistItem;
- Pit / membership / roles;
- LiveSet / LiveSetItem;
- PlaybackSession / PlaybackEndpoint;
- PostgreSQL como fuente de verdad;
- Centrifugo como transporte realtime;
- permisos server-side, revisiones e idempotencia.

Si una propuesta visual requiere cambiar una de esas responsabilidades, debe revisarse primero a nivel de producto y arquitectura y registrarse como decisión, no resolverse dentro del frontend.


## 15. Implementación frontend D1 (2026-11-16)

El frontend D1 se implementó sobre las rutas y contratos existentes. Incluye Inicio, Explorar con test tracks, biblioteca/detalle de Setlists privados, lista de Pits Activos/Historial, sala Pit, Live Set, Crowd, roles, invitaciones, aceptación por enlace/código y perfil guest. Las rutas profundas permiten recuperación de sala/Setlist al recargar.

La implementación respeta los no-objetivos: no crea búsqueda real de providers, audio, MiniPlayer, chat, voting, Setlist collaboration ni Stage Playback. El estado de PlaybackSession se presenta de forma neutral.

El código pasó transpilación sintáctica de todos los TS/TSX y un typecheck auxiliar estricto con stubs locales. El build oficial con dependencias reales y la verificación en navegador desktop/mobile todavía deben ejecutarse en el entorno Windows de desarrollo.
