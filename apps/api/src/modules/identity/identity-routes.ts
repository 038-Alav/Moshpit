import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticateIdentity } from "../../shared/http/authentication.js";
import { DomainError, requireString } from "../../shared/application/command.js";

function signJwt(claims: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

export function registerIdentityRoutes(app: FastifyInstance, dependencies: { pool: Pool; tokenSecret: string }) {
  const { pool, tokenSecret } = dependencies;

  app.post("/api/identity/guest", async (request, reply) => {
    const body = (request.body ?? {}) as { displayName?: unknown };
    const displayName = body.displayName === undefined
      ? `Guest-${randomBytes(2).toString("hex").toUpperCase()}`
      : requireString(body.displayName, "displayName", 40, 2);
    const identityId = randomUUID();
    const sessionId = randomUUID();
    const sessionToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO identities(id, display_name, identity_type) VALUES ($1, $2, 'guest')`,
        [identityId, displayName]
      );
      await client.query(
        `INSERT INTO identity_sessions(id, identity_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
        [sessionId, identityId, tokenHash]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    return reply.code(201).send({
      identity: { id: identityId, displayName, identityType: "guest" },
      sessionToken,
      expiresInSeconds: 30 * 24 * 60 * 60
    });
  });

  app.get("/api/me", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    return { identity };
  });

  app.get("/api/realtime/connection-token", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    if (!tokenSecret) throw new DomainError("Realtime token signing is not configured.", 503, "realtime_not_configured");
    const now = Math.floor(Date.now() / 1000);
    return {
      token: signJwt({ sub: identity.id, iat: now, exp: now + 15 * 60 }, tokenSecret),
      expiresInSeconds: 15 * 60
    };
  });
}
