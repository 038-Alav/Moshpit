import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticateIdentity } from "../../shared/http/authentication.js";
import {
  assertOwnerOrPitMember,
  DomainError,
  enqueueRealtimeEvent,
  executeIdempotentCommand,
  requireExpectedRevision,
  requireUuid
} from "../../shared/application/command.js";

async function loadLiveSet(client: import("pg").PoolClient, pitId: string) {
  const result = await client.query("SELECT id, pit_id, revision FROM live_sets WHERE pit_id = $1 FOR UPDATE", [pitId]);
  if (!result.rowCount) throw new DomainError("Live Set not found.", 404, "live_set_not_found");
  return result.rows[0] as { id: string; pit_id: string; revision: number };
}

export function registerLiveSetRoutes(app: FastifyInstance, dependencies: { pool: Pool }) {
  const { pool } = dependencies;

  app.post<{ Params: { pitId: string } }>("/api/pits/:pitId/live-set/items", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const body = (request.body ?? {}) as { trackId?: unknown; expectedRevision?: unknown };
    const trackId = requireUuid(body.trackId, "trackId");
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "live-set.items.add", requestBody: { pitId, trackId, expectedRevision },
      execute: async (client) => {
        await assertOwnerOrPitMember(client, identity.id, pitId, ["admin", "crowd"]);
        const liveSet = await loadLiveSet(client, pitId);
        if (liveSet.revision !== expectedRevision) throw new DomainError("Live Set revision is outdated.", 409, "revision_conflict", { currentRevision: liveSet.revision });
        const track = await client.query("SELECT id FROM canonical_tracks WHERE id = $1", [trackId]);
        if (!track.rowCount) throw new DomainError("Track not found.", 404, "track_not_found");
        const positionResult = await client.query("SELECT COALESCE(MAX(position) + 1, 0)::int AS position FROM live_set_items WHERE live_set_id = $1", [liveSet.id]);
        const itemId = randomUUID();
        await client.query(
          `INSERT INTO live_set_items(id, live_set_id, canonical_track_id, position, added_by_identity_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [itemId, liveSet.id, trackId, positionResult.rows[0].position, identity.id]
        );
        const updated = await client.query("UPDATE live_sets SET revision = revision + 1, updated_at = NOW() WHERE id = $1 RETURNING revision", [liveSet.id]);
        await enqueueRealtimeEvent({ client, channel: `pit:${pitId}`, eventType: "live_set.item_added",
          aggregateType: "live_set", aggregateId: liveSet.id, aggregateRevision: updated.rows[0].revision,
          payload: { pitId, liveSetId: liveSet.id, itemId, trackId } });
        return { statusCode: 201, body: { itemId, liveSetRevision: updated.rows[0].revision } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.delete<{ Params: { pitId: string; itemId: string } }>("/api/pits/:pitId/live-set/items/:itemId", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const itemId = requireUuid(request.params.itemId, "itemId");
    const body = (request.body ?? {}) as { expectedRevision?: unknown };
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "live-set.items.remove", requestBody: { pitId, itemId, expectedRevision },
      execute: async (client) => {
        await assertOwnerOrPitMember(client, identity.id, pitId, ["admin", "crowd"]);
        const liveSet = await loadLiveSet(client, pitId);
        if (liveSet.revision !== expectedRevision) throw new DomainError("Live Set revision is outdated.", 409, "revision_conflict", { currentRevision: liveSet.revision });
        const removed = await client.query("DELETE FROM live_set_items WHERE id = $1 AND live_set_id = $2 RETURNING id", [itemId, liveSet.id]);
        if (!removed.rowCount) throw new DomainError("Live Set item not found.", 404, "live_set_item_not_found");
        const rows = await client.query("SELECT id FROM live_set_items WHERE live_set_id = $1 ORDER BY position", [liveSet.id]);
        const offsetResult = await client.query(
          "SELECT COALESCE(MAX(position), -1) + 1 AS position_offset FROM live_set_items WHERE live_set_id = $1", [liveSet.id]
        );
        await client.query("UPDATE live_set_items SET position = position + $2 WHERE live_set_id = $1", [liveSet.id, offsetResult.rows[0].position_offset]);
        for (let index = 0; index < rows.rows.length; index++) {
          await client.query("UPDATE live_set_items SET position = $3 WHERE id = $1 AND live_set_id = $2", [rows.rows[index].id, liveSet.id, index]);
        }
        const updated = await client.query("UPDATE live_sets SET revision = revision + 1, updated_at = NOW() WHERE id = $1 RETURNING revision", [liveSet.id]);
        await enqueueRealtimeEvent({ client, channel: `pit:${pitId}`, eventType: "live_set.item_removed",
          aggregateType: "live_set", aggregateId: liveSet.id, aggregateRevision: updated.rows[0].revision,
          payload: { pitId, liveSetId: liveSet.id, itemId } });
        return { statusCode: 200, body: { liveSetRevision: updated.rows[0].revision } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  app.patch<{ Params: { pitId: string } }>("/api/pits/:pitId/live-set/items/reorder", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const body = (request.body ?? {}) as { itemIds?: unknown; expectedRevision?: unknown };
    const expectedRevision = requireExpectedRevision(body.expectedRevision);
    if (!Array.isArray(body.itemIds) || body.itemIds.some((value) => typeof value !== "string")) throw new DomainError("itemIds must be an array of item UUIDs.", 400, "invalid_item_order");
    const itemIds = body.itemIds.map((value) => requireUuid(value, "itemIds[]"));
    if (new Set(itemIds).size !== itemIds.length) throw new DomainError("itemIds cannot contain duplicates.", 400, "invalid_item_order");
    const result = await executeIdempotentCommand({
      pool, identityId: identity.id, idempotencyKey: request.headers["idempotency-key"],
      commandName: "live-set.items.reorder", requestBody: { pitId, itemIds, expectedRevision },
      execute: async (client) => {
        await assertOwnerOrPitMember(client, identity.id, pitId, ["admin", "crowd"]);
        const liveSet = await loadLiveSet(client, pitId);
        if (liveSet.revision !== expectedRevision) throw new DomainError("Live Set revision is outdated.", 409, "revision_conflict", { currentRevision: liveSet.revision });
        const current = await client.query("SELECT id FROM live_set_items WHERE live_set_id = $1 ORDER BY position", [liveSet.id]);
        const currentIds = current.rows.map((row) => row.id as string);
        if (itemIds.length !== currentIds.length || itemIds.some((id) => !currentIds.includes(id))) throw new DomainError("Reorder must include every current item exactly once.", 422, "invalid_item_order");
        const offsetResult = await client.query(
          "SELECT COALESCE(MAX(position), -1) + 1 AS position_offset FROM live_set_items WHERE live_set_id = $1", [liveSet.id]
        );
        await client.query("UPDATE live_set_items SET position = position + $2 WHERE live_set_id = $1", [liveSet.id, offsetResult.rows[0].position_offset]);
        for (let index = 0; index < itemIds.length; index++) {
          await client.query("UPDATE live_set_items SET position = $3 WHERE id = $1 AND live_set_id = $2", [itemIds[index], liveSet.id, index]);
        }
        const updated = await client.query("UPDATE live_sets SET revision = revision + 1, updated_at = NOW() WHERE id = $1 RETURNING revision", [liveSet.id]);
        await enqueueRealtimeEvent({ client, channel: `pit:${pitId}`, eventType: "live_set.reordered",
          aggregateType: "live_set", aggregateId: liveSet.id, aggregateRevision: updated.rows[0].revision,
          payload: { pitId, liveSetId: liveSet.id, itemIds } });
        return { statusCode: 200, body: { liveSetRevision: updated.rows[0].revision, itemIds } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
