import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticateIdentity } from "../../shared/http/authentication.js";
import {
  DomainError,
  enqueueRealtimeEvent,
  executeIdempotentCommand,
  requireExpectedRevision,
  requireString,
  requireUuid
} from "../../shared/application/command.js";

const trackSelect = `SELECT i.id AS "itemId", i.position,
  t.id AS "canonicalTrackId", t.title, t.artist, t.album, t.duration_ms AS "durationMs"
  FROM setlist_items i JOIN canonical_tracks t ON t.id = i.canonical_track_id`;

async function loadOwnedSetlist(client: Pick<PoolClient, "query">, identityId: string, setlistId: string, lock = false) {
  const result = await client.query(
    `SELECT id, owner_identity_id AS "ownerIdentityId", name, description, visibility,
       revision, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM setlists WHERE id = $1 AND owner_identity_id = $2 AND archived_at IS NULL ${lock ? "FOR UPDATE" : ""}`,
    [setlistId, identityId]
  );
  const setlist = result.rows[0];
  if (!setlist) throw new DomainError("Setlist not found.", 404, "setlist_not_found");
  return setlist;
}

async function loadSetlistItems(client: Pick<PoolClient, "query">, setlistId: string) {
  const result = await client.query(
    `${trackSelect}
     WHERE i.setlist_id = $1 ORDER BY i.position ASC`,
    [setlistId]
  );
  return result.rows;
}

export function registerSetlistRoutes(app: FastifyInstance, dependencies: { pool: Pool }) {
  const { pool } = dependencies;

  app.get("/api/music/test-tracks", async (request) => {
    await authenticateIdentity(pool, request);
    const result = await pool.query(
      `SELECT id, title, artist, album, duration_ms AS "durationMs"
       FROM canonical_tracks WHERE metadata->>'kind' = 'demo_fixture' ORDER BY title`
    );
    return { tracks: result.rows };
  });

  app.get("/api/setlists", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    const result = await pool.query(
      `SELECT s.id, s.name, s.description, s.visibility, s.revision,
         s.created_at AS "createdAt", s.updated_at AS "updatedAt",
         COUNT(i.id)::int AS "trackCount"
       FROM setlists s LEFT JOIN setlist_items i ON i.setlist_id = s.id
       WHERE s.owner_identity_id = $1 AND s.archived_at IS NULL
       GROUP BY s.id ORDER BY s.updated_at DESC`,
      [identity.id]
    );
    return { setlists: result.rows };
  });

  app.post("/api/setlists", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const body = (request.body ?? {}) as { name?: unknown; description?: unknown };
    const name = requireString(body.name, "name", 80);
    const description = body.description === undefined || body.description === null
      ? null : requireString(body.description, "description", 500, 0);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "setlists.create", requestBody: { name, description },
      execute: async (client) => {
        const id = randomUUID();
        const inserted = await client.query(
          `INSERT INTO setlists(id, owner_identity_id, name, description)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, description, visibility, revision,
             created_at AS "createdAt", updated_at AS "updatedAt"`,
          [id, identity.id, name, description]
        );
        await enqueueRealtimeEvent({
          client, channel: `identity:${identity.id}`, eventType: "setlist.created",
          aggregateType: "setlist", aggregateId: id, aggregateRevision: 1,
          payload: { setlistId: id, name }
        });
        return { statusCode: 201, body: { setlist: inserted.rows[0], items: [] } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.get<{ Params: { setlistId: string } }>("/api/setlists/:setlistId", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    const setlistId = requireUuid(request.params.setlistId, "setlistId");
    const setlist = await loadOwnedSetlist(pool, identity.id, setlistId);
    const items = await loadSetlistItems(pool, setlistId);
    return { setlist, items };
  });

  app.patch<{ Params: { setlistId: string } }>("/api/setlists/:setlistId", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const setlistId = requireUuid(request.params.setlistId, "setlistId");
    const body = (request.body ?? {}) as { name?: unknown; description?: unknown; expectedRevision?: unknown };
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    const name = body.name === undefined ? undefined : requireString(body.name, "name", 80);
    const description = body.description === undefined ? undefined : body.description === null
      ? null : requireString(body.description, "description", 500, 0);
    if (name === undefined && description === undefined) throw new DomainError("Provide a name or description to update.", 400, "empty_update");
    const commandBody = { setlistId, expectedRevision, name, description };
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "setlists.update", requestBody: commandBody,
      execute: async (client) => {
        const current = await loadOwnedSetlist(client, identity.id, setlistId, true);
        if (current.revision !== expectedRevision) throw new DomainError("Setlist revision is outdated.", 409, "revision_conflict", { currentRevision: current.revision });
        const updated = await client.query(
          `UPDATE setlists SET name = COALESCE($3, name), description = CASE WHEN $4::boolean THEN $5 ELSE description END,
             revision = revision + 1, updated_at = NOW()
           WHERE id = $1 AND owner_identity_id = $2
           RETURNING id, name, description, visibility, revision, updated_at AS "updatedAt"`,
          [setlistId, identity.id, name ?? null, description !== undefined, description ?? null]
        );
        const setlist = updated.rows[0];
        await enqueueRealtimeEvent({ client, channel: `identity:${identity.id}`, eventType: "setlist.updated",
          aggregateType: "setlist", aggregateId: setlistId, aggregateRevision: setlist.revision,
          payload: { setlistId, revision: setlist.revision } });
        return { statusCode: 200, body: { setlist } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.post<{ Params: { setlistId: string } }>("/api/setlists/:setlistId/items", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const setlistId = requireUuid(request.params.setlistId, "setlistId");
    const body = (request.body ?? {}) as { trackId?: unknown; expectedRevision?: unknown };
    const trackId = requireUuid(body.trackId, "trackId");
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "setlists.items.add", requestBody: { setlistId, trackId, expectedRevision },
      execute: async (client) => {
        const setlist = await loadOwnedSetlist(client, identity.id, setlistId, true);
        if (setlist.revision !== expectedRevision) throw new DomainError("Setlist revision is outdated.", 409, "revision_conflict", { currentRevision: setlist.revision });
        const track = await client.query("SELECT id FROM canonical_tracks WHERE id = $1", [trackId]);
        if (!track.rowCount) throw new DomainError("Track not found.", 404, "track_not_found");
        const positionResult = await client.query("SELECT COALESCE(MAX(position) + 1, 0)::int AS position FROM setlist_items WHERE setlist_id = $1", [setlistId]);
        const itemId = randomUUID();
        await client.query(
          `INSERT INTO setlist_items(id, setlist_id, canonical_track_id, position, added_by_identity_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [itemId, setlistId, trackId, positionResult.rows[0].position, identity.id]
        );
        const updated = await client.query("UPDATE setlists SET revision = revision + 1, updated_at = NOW() WHERE id = $1 RETURNING revision", [setlistId]);
        const items = await loadSetlistItems(client, setlistId);
        await enqueueRealtimeEvent({ client, channel: `identity:${identity.id}`, eventType: "setlist.item_added",
          aggregateType: "setlist", aggregateId: setlistId, aggregateRevision: updated.rows[0].revision,
          payload: { setlistId, itemId, trackId } });
        return { statusCode: 201, body: { revision: updated.rows[0].revision, items } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.delete<{ Params: { setlistId: string; itemId: string } }>("/api/setlists/:setlistId/items/:itemId", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const setlistId = requireUuid(request.params.setlistId, "setlistId");
    const itemId = requireUuid(request.params.itemId, "itemId");
    const body = (request.body ?? {}) as { expectedRevision?: unknown };
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "setlists.items.remove", requestBody: { setlistId, itemId, expectedRevision },
      execute: async (client) => {
        const setlist = await loadOwnedSetlist(client, identity.id, setlistId, true);
        if (setlist.revision !== expectedRevision) throw new DomainError("Setlist revision is outdated.", 409, "revision_conflict", { currentRevision: setlist.revision });
        const removed = await client.query("DELETE FROM setlist_items WHERE id = $1 AND setlist_id = $2 RETURNING id", [itemId, setlistId]);
        if (!removed.rowCount) throw new DomainError("Setlist item not found.", 404, "setlist_item_not_found");
        const rows = await client.query("SELECT id FROM setlist_items WHERE setlist_id = $1 ORDER BY position", [setlistId]);
        for (let index = 0; index < rows.rows.length; index++) {
          await client.query("UPDATE setlist_items SET position = $3 WHERE id = $1 AND setlist_id = $2", [rows.rows[index].id, setlistId, index]);
        }
        const updated = await client.query("UPDATE setlists SET revision = revision + 1, updated_at = NOW() WHERE id = $1 RETURNING revision", [setlistId]);
        const items = await loadSetlistItems(client, setlistId);
        await enqueueRealtimeEvent({ client, channel: `identity:${identity.id}`, eventType: "setlist.item_removed",
          aggregateType: "setlist", aggregateId: setlistId, aggregateRevision: updated.rows[0].revision,
          payload: { setlistId, itemId } });
        return { statusCode: 200, body: { revision: updated.rows[0].revision, items } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.patch<{ Params: { setlistId: string } }>("/api/setlists/:setlistId/items/reorder", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const setlistId = requireUuid(request.params.setlistId, "setlistId");
    const body = (request.body ?? {}) as { itemIds?: unknown; expectedRevision?: unknown };
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    if (!Array.isArray(body.itemIds) || body.itemIds.some((id) => typeof id !== "string")) throw new DomainError("itemIds must be an array of item UUIDs.", 400, "invalid_item_order");
    const itemIds = body.itemIds.map((id) => requireUuid(id, "itemIds[]"));
    if (new Set(itemIds).size !== itemIds.length) throw new DomainError("itemIds cannot contain duplicates.", 400, "invalid_item_order");
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "setlists.items.reorder", requestBody: { setlistId, itemIds, expectedRevision },
      execute: async (client) => {
        const setlist = await loadOwnedSetlist(client, identity.id, setlistId, true);
        if (setlist.revision !== expectedRevision) throw new DomainError("Setlist revision is outdated.", 409, "revision_conflict", { currentRevision: setlist.revision });
        const current = await client.query("SELECT id FROM setlist_items WHERE setlist_id = $1 ORDER BY position", [setlistId]);
        const currentIds = current.rows.map((row) => row.id as string);
        if (itemIds.length !== currentIds.length || itemIds.some((id) => !currentIds.includes(id))) throw new DomainError("Reorder must include every current item exactly once.", 422, "invalid_item_order");
        const offsetResult = await client.query(
          "SELECT COALESCE(MAX(position), -1) + 1 AS position_offset FROM setlist_items WHERE setlist_id = $1", [setlistId]
        );
        await client.query("UPDATE setlist_items SET position = position + $2 WHERE setlist_id = $1", [setlistId, offsetResult.rows[0].position_offset]);
        for (let index = 0; index < itemIds.length; index++) {
          await client.query("UPDATE setlist_items SET position = $3 WHERE id = $1 AND setlist_id = $2", [itemIds[index], setlistId, index]);
        }
        const updated = await client.query("UPDATE setlists SET revision = revision + 1, updated_at = NOW() WHERE id = $1 RETURNING revision", [setlistId]);
        const items = await loadSetlistItems(client, setlistId);
        await enqueueRealtimeEvent({ client, channel: `identity:${identity.id}`, eventType: "setlist.reordered",
          aggregateType: "setlist", aggregateId: setlistId, aggregateRevision: updated.rows[0].revision,
          payload: { setlistId, itemIds } });
        return { statusCode: 200, body: { revision: updated.rows[0].revision, items } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
