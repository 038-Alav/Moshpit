import "./config/load-env.js";
import { buildApp } from "./app.js";
import { closeDatabaseConnection, databasePool } from "./shared/infrastructure/database.js";
import { runMigrations } from "./shared/infrastructure/migrations.js";
import { env } from "./config/env.js";
import { CentrifugoRealtimePublisher } from "./modules/realtime/centrifugo-realtime-publisher.js";
import { startOutboxDispatcher } from "./modules/realtime/outbox-dispatcher.js";

await runMigrations(databasePool);
const app = buildApp();
const stopOutbox = startOutboxDispatcher(databasePool, new CentrifugoRealtimePublisher());

try {
  await app.listen({ host: env.host, port: env.port });
} catch (error) {
  app.log.error(error);
  await stopOutbox();
  await closeDatabaseConnection();
  process.exit(1);
}

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down Moshpit API");
  await app.close();
  await stopOutbox();
  await closeDatabaseConnection();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
