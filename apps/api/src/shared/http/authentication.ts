import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { DomainError } from "../application/command.js";

export interface AuthenticatedIdentity {
  id: string;
  displayName: string;
  identityType: "guest" | "account";
}

export async function authenticateIdentity(pool: Pool, request: FastifyRequest): Promise<AuthenticatedIdentity> {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 200) throw new DomainError("Authentication required.", 401, "unauthorized");

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const result = await pool.query<AuthenticatedIdentity>(
    `SELECT i.id, i.display_name AS "displayName", i.identity_type AS "identityType"
     FROM identity_sessions s
     JOIN identities i ON i.id = s.identity_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW() AND i.status = 'active'`,
    [tokenHash]
  );
  const identity = result.rows[0];
  if (!identity) throw new DomainError("Session expired or invalid. Create a new guest session.", 401, "session_invalid");

  await pool.query(
    `UPDATE identity_sessions SET last_seen_at = NOW(), expires_at = NOW() + INTERVAL '30 days'
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return identity;
}
