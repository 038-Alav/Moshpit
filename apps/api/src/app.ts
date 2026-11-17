import Fastify from "fastify";
import type { Pool } from "pg";
import { env } from "./config/env.js";
import { databasePool, checkDatabaseConnection } from "./shared/infrastructure/database.js";
import { DomainError } from "./shared/application/command.js";
import { registerIdentityRoutes } from "./modules/identity/identity-routes.js";
import { registerSetlistRoutes } from "./modules/setlists/setlist-routes.js";
import { registerPitRoutes } from "./modules/pits/pit-routes.js";
import { registerLiveSetRoutes } from "./modules/live-sets/live-set-routes.js";
import { registerPlaybackRoutes } from "./modules/playback/playback-routes.js";

export function buildApp(options: { pool?: Pool; tokenSecret?: string; logger?: boolean } = {}) {
  const pool = options.pool ?? databasePool;
  const app = Fastify({ logger: options.logger ?? true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: { code: "internal_error", message: "An unexpected error occurred." } });
  });

  app.get("/api/health", async () => ({ status: "ok", service: "moshpit-api" }));

  app.get("/api/ready", async (_request, reply) => {
    try {
      await (options.pool ? pool.query("SELECT 1") : checkDatabaseConnection());
      return { status: "ready", dependencies: { postgres: "up" } };
    } catch {
      return reply.code(503).send({ status: "not_ready", dependencies: { postgres: "unavailable" } });
    }
  });

  registerIdentityRoutes(app, { pool, tokenSecret: options.tokenSecret ?? env.centrifugoTokenHmacSecretKey });
  registerSetlistRoutes(app, { pool });
  registerPitRoutes(app, { pool, tokenSecret: options.tokenSecret ?? env.centrifugoTokenHmacSecretKey });
  registerLiveSetRoutes(app, { pool });
  registerPlaybackRoutes(app, { pool });

  return app;
}
