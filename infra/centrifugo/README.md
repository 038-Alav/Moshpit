# Centrifugo

Centrifugo es infraestructura realtime independiente del monolito Fastify. No es un servicio de dominio ni una fuente de verdad.

- Versión fijada para el scaffold: `v6.10.3`.
- Windows/Linux nativo: ejecutar el binario `centrifugo` con `infra/centrifugo/config.json`.
- Docker/Podman: la imagen `centrifugo/centrifugo:v6.10.3` se declara en `infra/docker-compose.yml`.
- El navegador se conecta al endpoint WebSocket `ws://localhost:8000/connection/websocket` en desarrollo local.
- Fastify utiliza la API HTTP de Centrifugo para publicar eventos mediante el puerto interno `RealtimePublisher`.
- Los JWT de conexión/suscripción deben ser emitidos por Fastify.
- El namespace `pit` no permite suscripción abierta ni publicación desde clientes.
- No se habilita RPC Proxy en este scaffold.

Los valores `local-dev-*` son exclusivamente para desarrollo. No deben reutilizarse en producción. La configuración nativa local usa los valores de desarrollo definidos en `config.json`; si se cambian, deben mantenerse sincronizados con `.env`. En Compose, las variables de entorno sobrescriben esos valores.
