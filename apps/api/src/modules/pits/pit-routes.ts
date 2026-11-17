import { createHash, createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticateIdentity } from "../../shared/http/authentication.js";
import {
  assertOwnerOrPitMember,
  DomainError,
  enqueueRealtimeEvent,
  executeIdempotentCommand,
  requireExpectedRevision,
  requireString,
  requireUuid
} from "../../shared/application/command.js";

function signJwt(claims: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createInvitationToken(secret: string, identityId: string, idempotencyKey: string, pitId: string, role: string): string {
  // Deterministic for this command key so a safe idempotent retry can return
  // the same invite without storing the plaintext token in idempotency_records.
  return createHmac("sha256", secret)
    .update(`moshpit:pit-invitation:v1:${identityId}:${idempotencyKey}:${pitId}:${role}`)
    .digest("base64url");
}

export function registerPitRoutes(app: FastifyInstance, dependencies: { pool: Pool; tokenSecret: string }) {
  const { pool, tokenSecret } = dependencies;

  app.get("/api/pits", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    const result = await pool.query(
      `SELECT p.id, p.name, p.status, p.revision, p.created_at AS "createdAt",
         pm.role, ls.id AS "liveSetId", ls.revision AS "liveSetRevision"
       FROM pit_memberships pm JOIN pits p ON p.id = pm.pit_id
       JOIN live_sets ls ON ls.pit_id = p.id
       WHERE pm.identity_id = $1 ORDER BY p.created_at DESC`,
      [identity.id]
    );
    return { pits: result.rows };
  });

  app.post("/api/pits", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const body = (request.body ?? {}) as { name?: unknown; setlistId?: unknown; sourceSetlistRevision?: unknown };
    const name = requireString(body.name, "name", 80);
    const setlistId = body.setlistId === undefined || body.setlistId === null
      ? null : requireUuid(body.setlistId, "setlistId");
    const sourceSetlistRevision = setlistId === null ? null : requireExpectedRevision(body.sourceSetlistRevision);

    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "pits.create", requestBody: { name, setlistId, sourceSetlistRevision },
      execute: async (client) => {
        let sourceRevision: number | null = null;
        if (setlistId) {
          const source = await client.query(
            `SELECT id, revision FROM setlists
             WHERE id = $1 AND owner_identity_id = $2 AND archived_at IS NULL FOR SHARE`,
            [setlistId, identity.id]
          );
          if (!source.rowCount) throw new DomainError("Source Setlist not found.", 404, "setlist_not_found");
          sourceRevision = source.rows[0].revision;
          if (sourceRevision !== sourceSetlistRevision) throw new DomainError("Source Setlist changed. Refresh it before creating the Pit.", 409, "revision_conflict", { currentRevision: sourceRevision });
        }

        const pitId = randomUUID();
        const liveSetId = randomUUID();
        const playbackSessionId = randomUUID();
        await client.query(
          `INSERT INTO pits(id, created_by_identity_id, name, source_setlist_id)
           VALUES ($1, $2, $3, $4)`,
          [pitId, identity.id, name, setlistId]
        );
        await client.query(
          `INSERT INTO pit_memberships(pit_id, identity_id, role) VALUES ($1, $2, 'admin')`,
          [pitId, identity.id]
        );
        await client.query(
          `INSERT INTO live_sets(id, pit_id, source_setlist_id, source_setlist_revision)
           VALUES ($1, $2, $3, $4)`,
          [liveSetId, pitId, setlistId, sourceRevision]
        );
        if (setlistId) {
          const sourceItems = await client.query(
            `SELECT id, canonical_track_id, position FROM setlist_items WHERE setlist_id = $1 ORDER BY position`,
            [setlistId]
          );
          for (const item of sourceItems.rows) {
            await client.query(
              `INSERT INTO live_set_items(id, live_set_id, canonical_track_id, source_setlist_item_id, position, added_by_identity_id)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [randomUUID(), liveSetId, item.canonical_track_id, item.id, item.position, identity.id]
            );
          }
        }
        await client.query(
          `INSERT INTO playback_sessions(id, pit_id, live_set_id) VALUES ($1, $2, $3)`,
          [playbackSessionId, pitId, liveSetId]
        );
        const itemResult = await client.query(
          `SELECT COUNT(*)::int AS count FROM live_set_items WHERE live_set_id = $1`, [liveSetId]
        );
        await enqueueRealtimeEvent({ client, channel: `pit:${pitId}`, eventType: "pit.created",
          aggregateType: "pit", aggregateId: pitId, aggregateRevision: 1,
          payload: { pitId, name, createdByIdentityId: identity.id, sourceSetlistId: setlistId } });
        await enqueueRealtimeEvent({ client, channel: `pit:${pitId}`, eventType: "live_set.created",
          aggregateType: "live_set", aggregateId: liveSetId, aggregateRevision: 1,
          payload: { pitId, liveSetId, sourceSetlistId: setlistId, itemCount: itemResult.rows[0].count } });
        return {
          statusCode: 201,
          body: { pit: { id: pitId, name, status: "active", revision: 1 }, liveSetId, playbackSessionId, sourceSetlistRevision: sourceRevision }
        };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.get<{ Params: { pitId: string } }>("/api/pits/:pitId/snapshot", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const client = await pool.connect();
    try {
      // A snapshot must describe one consistent database view. Without this
      // transaction, a concurrent command could make the Pit revision and its
      // Live Set / Playback data come from different commits.
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const membership = await client.query(
        `SELECT role FROM pit_memberships WHERE pit_id = $1 AND identity_id = $2`, [pitId, identity.id]
      );
      if (!membership.rowCount) throw new DomainError("Pit not found or access denied.", 404, "pit_not_found");
      const pitResult = await client.query(
        `SELECT id, name, status, revision, source_setlist_id AS "sourceSetlistId",
           created_at AS "createdAt", ended_at AS "endedAt" FROM pits WHERE id = $1`, [pitId]
      );
      if (!pitResult.rowCount) throw new DomainError("Pit not found.", 404, "pit_not_found");
      const liveSetResult = await client.query(
        `SELECT id, source_setlist_id AS "sourceSetlistId", source_setlist_revision AS "sourceSetlistRevision",
           revision, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM live_sets WHERE pit_id = $1`, [pitId]
      );
      if (!liveSetResult.rowCount) throw new DomainError("Live Set not found.", 404, "live_set_not_found");
      const liveSet = liveSetResult.rows[0];
      const itemsResult = await client.query(
        `SELECT i.id AS "itemId", i.position, i.source_setlist_item_id AS "sourceSetlistItemId",
           t.id AS "canonicalTrackId", t.title, t.artist, t.album, t.duration_ms AS "durationMs"
         FROM live_set_items i JOIN canonical_tracks t ON t.id = i.canonical_track_id
         WHERE i.live_set_id = $1 ORDER BY i.position`, [liveSet.id]
      );
      const playbackResult = await client.query(
        `SELECT id, mode, desired_state AS "desiredState", current_live_set_item_id AS "currentLiveSetItemId",
           position_ms AS "positionMs", revision, updated_at AS "updatedAt"
         FROM playback_sessions WHERE pit_id = $1`, [pitId]
      );
      if (!playbackResult.rowCount) throw new DomainError("PlaybackSession not found.", 404, "playback_session_not_found");
      const membersResult = await client.query(
        `SELECT i.id AS "identityId", i.display_name AS "displayName", pm.role,
           pm.joined_at AS "joinedAt"
         FROM pit_memberships pm JOIN identities i ON i.id = pm.identity_id
         WHERE pm.pit_id = $1 ORDER BY pm.joined_at`, [pitId]
      );
      const playbackEndpointsResult = await client.query(
        `SELECT id, identity_id AS "identityId", client_instance_id AS "clientInstanceId",
           provider_key AS "providerKey", status, capabilities,
           current_live_set_item_id AS "currentLiveSetItemId", position_ms AS "positionMs",
           failure_code AS "failureCode", failure_message AS "failureMessage", revision,
           last_reported_at AS "lastReportedAt"
         FROM playback_endpoints WHERE pit_id = $1 ORDER BY created_at, id`, [pitId]
      );
      await client.query("COMMIT");
      return {
        revision: pitResult.rows[0].revision,
        pit: pitResult.rows[0],
        membership: { role: membership.rows[0].role },
        members: membersResult.rows,
        liveSet: { ...liveSet, items: itemsResult.rows },
        playbackSession: playbackResult.rows[0],
        playbackEndpoints: playbackEndpointsResult.rows
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });

  app.post<{ Params: { pitId: string } }>("/api/pits/:pitId/invitations", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const body = (request.body ?? {}) as { role?: unknown };
    const role = body.role === "viewer" ? "viewer" : body.role === "crowd" || body.role === undefined ? "crowd" : null;
    if (!role) throw new DomainError("Invitation role must be crowd or viewer.", 400, "invalid_invitation_role");
    const headerKey = request.headers["idempotency-key"];
    const idempotencyKey = Array.isArray(headerKey)
      ? headerKey.length === 1 ? requireString(headerKey[0], "Idempotency-Key", 128) : ""
      : requireString(headerKey, "Idempotency-Key", 128);
    const token = createInvitationToken(tokenSecret, identity.id, idempotencyKey, pitId, role);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey,
      commandName: "pits.invitations.create", requestBody: { pitId, role },
      execute: async (client) => {
        await assertOwnerOrPitMember(client, identity.id, pitId, ["admin"]);
        const invitationId = randomUUID();
        await client.query(
          `INSERT INTO pit_invitations(id, pit_id, token_hash, role, created_by_identity_id, expires_at)
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
          [invitationId, pitId, sha256(token), role, identity.id]
        );
        return { statusCode: 201, body: { invitationId, role, expiresInSeconds: 7 * 24 * 60 * 60 } };
      }
    });
    return reply.code(result.statusCode).send({ ...result.body as object, token });
  });

  app.post("/api/pit-invitations/accept", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const body = (request.body ?? {}) as { token?: unknown };
    const token = requireString(body.token, "token", 100);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "pits.invitations.accept", requestBody: { tokenHash: sha256(token) },
      execute: async (client) => {
        const inviteResult = await client.query(
          `SELECT id, pit_id AS "pitId", role, expires_at AS "expiresAt", accepted_at AS "acceptedAt"
           FROM pit_invitations WHERE token_hash = $1 FOR UPDATE`, [sha256(token)]
        );
        const invitation = inviteResult.rows[0];
        if (!invitation || invitation.acceptedAt || new Date(invitation.expiresAt).getTime() <= Date.now()) {
          throw new DomainError("Invitation is invalid, expired or already used.", 404, "invitation_unavailable");
        }
        const pit = await client.query("SELECT status FROM pits WHERE id = $1 FOR UPDATE", [invitation.pitId]);
        if (!pit.rowCount || pit.rows[0].status !== "active") throw new DomainError("This Pit is no longer active.", 409, "pit_ended");
        await client.query(
          `INSERT INTO pit_memberships(pit_id, identity_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (pit_id, identity_id) DO NOTHING`,
          [invitation.pitId, identity.id, invitation.role]
        );
        await client.query(
          `UPDATE pit_invitations SET accepted_at = NOW(), accepted_by_identity_id = $2 WHERE id = $1`,
          [invitation.id, identity.id]
        );
        const membership = await client.query(
          `SELECT role FROM pit_memberships WHERE pit_id = $1 AND identity_id = $2`, [invitation.pitId, identity.id]
        );
        const pitRevision = await client.query(
          `UPDATE pits SET revision = revision + 1 WHERE id = $1 RETURNING revision`, [invitation.pitId]
        );
        await enqueueRealtimeEvent({ client, channel: `pit:${invitation.pitId}`, eventType: "pit.member_joined",
          aggregateType: "pit", aggregateId: invitation.pitId, aggregateRevision: pitRevision.rows[0].revision,
          payload: { pitId: invitation.pitId, identityId: identity.id, role: membership.rows[0].role } });
        return { statusCode: 200, body: { pitId: invitation.pitId, role: membership.rows[0].role } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.get<{ Params: { pitId: string } }>("/api/pits/:pitId/realtime-token", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const member = await pool.query("SELECT 1 FROM pit_memberships WHERE pit_id = $1 AND identity_id = $2", [pitId, identity.id]);
    if (!member.rowCount) throw new DomainError("Pit not found or access denied.", 404, "pit_not_found");
    if (!tokenSecret) throw new DomainError("Realtime token signing is not configured.", 503, "realtime_not_configured");
    const now = Math.floor(Date.now() / 1000);
    const channel = `pit:${pitId}`;
    return {
      channel,
      token: signJwt({ sub: identity.id, channel, iat: now, exp: now + 15 * 60 }, tokenSecret),
      expiresInSeconds: 15 * 60
    };
  });

  app.post<{ Params: { pitId: string } }>("/api/pits/:pitId/end", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const body = (request.body ?? {}) as { expectedRevision?: unknown };
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "pits.end", requestBody: { pitId, expectedRevision },
      execute: async (client) => {
        await assertOwnerOrPitMember(client, identity.id, pitId, ["admin"]);
        const current = await client.query("SELECT revision, status FROM pits WHERE id = $1 FOR UPDATE", [pitId]);
        if (current.rows[0].revision !== expectedRevision) throw new DomainError("Pit revision is outdated.", 409, "revision_conflict", { currentRevision: current.rows[0].revision });
        if (current.rows[0].status === "ended") throw new DomainError("Pit has already ended.", 409, "pit_ended");
        const updated = await client.query(
          `UPDATE pits SET status = 'ended', revision = revision + 1, ended_at = NOW() WHERE id = $1
           RETURNING revision, ended_at AS "endedAt"`, [pitId]
        );
        await client.query("UPDATE playback_sessions SET desired_state = 'paused', revision = revision + 1, updated_at = NOW() WHERE pit_id = $1", [pitId]);
        await enqueueRealtimeEvent({ client, channel: `pit:${pitId}`, eventType: "pit.ended",
          aggregateType: "pit", aggregateId: pitId, aggregateRevision: updated.rows[0].revision,
          payload: { pitId, endedAt: updated.rows[0].endedAt } });
        return { statusCode: 200, body: { pitId, status: "ended", revision: updated.rows[0].revision } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
