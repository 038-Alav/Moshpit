# D1 — Recuperación de navegación al recargar

## Comportamiento

- La identidad guest continúa persistida mediante el bearer token del navegador.
- La ruta `/pits/:pitId` identifica la sala que debe reabrirse al recargar o entrar mediante un deep link.
- El último Pit cargado se registra también por pestaña en `sessionStorage` (`moshpit.activePit`), como protección para descartar respuestas tardías; ese valor no es una credencial ni sustituye la ruta.
- Tras validar la identidad mediante `GET /api/me`, el cliente solicita un snapshot nuevo del Pit indicado por la ruta.
- El backend vuelve a comprobar la membresía y devuelve el rol actual. El estado almacenado en el navegador nunca concede acceso por sí solo.
- Volver a la lista mediante `leavePit` o abrir un Setlist elimina la selección recordada. Navegar a Inicio no revoca la membresía ni cambia el recurso visible en la URL actual.
- La selección se guarda por pestaña para evitar que dos pestañas que estén trabajando en Pits distintos se sobrescriban entre sí.
- Las solicitudes de navegación se versionan en el cliente para que una recuperación lenta no sobrescriba una selección posterior del usuario.

## Validación manual

1. Abrir un Pit como Admin o Crowd.
2. Confirmar que el snapshot y el Live Set están visibles.
3. Recargar la pestaña.
4. Confirmar que vuelve a abrirse el mismo Pit con el rol y el contenido cargados desde el servidor.
5. Abrir otro Pit en una segunda pestaña y comprobar que recargar cada pestaña restaura su Pit correspondiente.
6. Volver a `Todos los Pits` desde la sala, confirmar que la URL cambia a `/pits` y recargar: no debe reabrirse la sala anterior.
7. Repetir como Viewer y comprobar que sigue siendo read-only después de recargar.
