import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type {
  PlaybackCapabilities,
  PlaybackEndpointFailureCode,
  PlaybackEndpointStatus
} from "@moshpit/contracts";
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

const endpointStatuses = new Set<PlaybackEndpointStatus>([
  "idle", "resolving", "ready", "playing", "paused", "unavailable", "error"
]);
const failureCodes = new Set<PlaybackEndpointFailureCode>([
  "provider_unavailable", "track_unavailable", "resolution_failed", "playback_failed",
  "authorization_required", "unsupported_operation", "unknown"
]);
const capabilityKeys: Array<keyof PlaybackCapabilities> = [
  "canPlay", "canPause", "canSeek", "canStop", "canPrepare", "canReportPosition"
];

function requireCapabilities(value: unknown): PlaybackCapabilities {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError("capabilities must be an object.", 400, "invalid_playback_capabilities");
  }
  const record = value as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !capabilityKeys.includes(key as keyof PlaybackCapabilities));
  if (unknownKeys.length || capabilityKeys.some((key) => typeof record[key] !== "boolean")) {
    throw new DomainError(
      "capabilities must contain boolean canPlay, canPause, canSeek, canStop, canPrepare and canReportPosition fields only.",
      400,
      "invalid_playback_capabilities"
    );
  }
  return Object.fromEntries(capabilityKeys.map((key) => [key, record[key]])) as unknown as PlaybackCapabilities;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new DomainError(`${field} must be a non-negative safe integer.`, 400, "invalid_playback_endpoint_state");
  }
  return value;
}

function requireEndpointStatus(value: unknown): PlaybackEndpointStatus {
  if (typeof value !== "string" || !endpointStatuses.has(value as PlaybackEndpointStatus)) {
    throw new DomainError("Unsupported PlaybackEndpoint status.", 400, "invalid_playback_endpoint_state");
  }
  return value as PlaybackEndpointStatus;
}

function requireFailureCode(value: unknown): PlaybackEndpointFailureCode | null {
  if (value === null) return null;
  if (typeof value !== "string" || !failureCodes.has(value as PlaybackEndpointFailureCode)) {
    throw new DomainError("Unsupported PlaybackEndpoint failure code.", 400, "invalid_playback_endpoint_state");
  }
  return value as PlaybackEndpointFailureCode;
}

function mapEndpoint(row: Record<string, unknown>) {
  return {
    id: row.id,
    pitId: row.pitId,
    playbackSessionId: row.playbackSessionId,
    liveSetId: row.liveSetId,
    identityId: row.identityId,
    clientInstanceId: row.clientInstanceId,
    providerKey: row.providerKey,
    status: row.status,
    capabilities: row.capabilities,
    currentLiveSetItemId: row.currentLiveSetItemId,
    positionMs: row.positionMs,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastReportedAt: row.lastReportedAt
  };
}

const endpointReturning = `
  id,
  pit_id AS "pitId",
  playback_session_id AS "playbackSessionId",
  live_set_id AS "liveSetId",
  identity_id AS "identityId",
  client_instance_id AS "clientInstanceId",
  provider_key AS "providerKey",
  status,
  capabilities,
  current_live_set_item_id AS "currentLiveSetItemId",
  position_ms AS "positionMs",
  failure_code AS "failureCode",
  failure_message AS "failureMessage",
  revision,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  last_reported_at AS "lastReportedAt"`;

export function registerPlaybackRoutes(app: FastifyInstance, dependencies: { pool: Pool }) {
  const { pool } = dependencies;

  /** Register or refresh one runtime-specific endpoint for the authenticated identity. */
  app.post<{ Params: { pitId: string } }>("/api/pits/:pitId/playback/endpoints", async (request, reply) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const body = (request.body ?? {}) as {
      clientInstanceId?: unknown;
      providerKey?: unknown;
      capabilities?: unknown;
    };
    const clientInstanceId = requireUuid(body.clientInstanceId, "clientInstanceId");
    const providerKey = body.providerKey === undefined || body.providerKey === null
      ? null : requireString(body.providerKey, "providerKey", 80);
    const capabilities = requireCapabilities(body.capabilities);

    const result = await executeIdempotentCommand({
      pool,
      identityId: identity.id,
      idempotencyKey: request.headers["idempotency-key"],
      commandName: "playback.endpoints.register",
      requestBody: { pitId, clientInstanceId, providerKey, capabilities },
      execute: async (client) => {
        await assertOwnerOrPitMember(client, identity.id, pitId);
        const session = await client.query<{ id: string; live_set_id: string }>(
          `SELECT id, live_set_id FROM playback_sessions WHERE pit_id = $1 FOR SHARE`, [pitId]
        );
        if (!session.rowCount) throw new DomainError("PlaybackSession not found.", 404, "playback_session_not_found");

        const endpoint = await client.query(
          `INSERT INTO playback_endpoints
             (id, pit_id, playback_session_id, live_set_id, identity_id, client_instance_id,
              provider_key, capabilities)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           ON CONFLICT (playback_session_id, identity_id, client_instance_id)
           DO UPDATE SET provider_key = EXCLUDED.provider_key,
             capabilities = EXCLUDED.capabilities,
             status = 'idle', current_live_set_item_id = NULL, position_ms = 0,
             failure_code = NULL, failure_message = NULL,
             last_reported_at = NOW(), updated_at = NOW(),
             revision = playback_endpoints.revision + 1
           RETURNING ${endpointReturning}`,
          [randomUUID(), pitId, session.rows[0].id, session.rows[0].live_set_id, identity.id,
            clientInstanceId, providerKey, JSON.stringify(capabilities)]
        );
        const mapped = mapEndpoint(endpoint.rows[0]);
        await enqueueRealtimeEvent({
          client,
          channel: `pit:${pitId}`,
          eventType: "playback.endpoint_registered",
          aggregateType: "playback_endpoint",
          aggregateId: mapped.id as string,
          aggregateRevision: mapped.revision as number,
          payload: { pitId, endpointId: mapped.id, identityId: identity.id, status: mapped.status }
        });
        return { statusCode: 201, body: { endpoint: mapped } };
      }
    });
    return reply.code(result.statusCode).send(result.body);
  });

  /** List endpoint-local states visible to members of the Pit. */
  app.get<{ Params: { pitId: string } }>("/api/pits/:pitId/playback/endpoints", async (request) => {
    const identity = await authenticateIdentity(pool, request);
    const pitId = requireUuid(request.params.pitId, "pitId");
    const membership = await pool.query(
      "SELECT 1 FROM pit_memberships WHERE pit_id = $1 AND identity_id = $2", [pitId, identity.id]
    );
    if (!membership.rowCount) throw new DomainError("Pit not found or access denied.", 404, "pit_not_found");
    const result = await pool.query(
      `SELECT ${endpointReturning} FROM playback_endpoints
       WHERE pit_id = $1 ORDER BY created_at, id`, [pitId]
    );
    return { endpoints: result.rows.map((row) => mapEndpoint(row)) };
  });

  /** Report only this runtime's local state; it never mutates PlaybackSession. */
  app.patch<{ Params: { pitId: string; endpointId: string } }>(
    "/api/pits/:pitId/playback/endpoints/:endpointId/state",
    async (request, reply) => {
      const identity = await authenticateIdentity(pool, request);
      const pitId = requireUuid(request.params.pitId, "pitId");
      const endpointId = requireUuid(request.params.endpointId, "endpointId");
      const body = (request.body ?? {}) as {
        status?: unknown;
        currentLiveSetItemId?: unknown;
        positionMs?: unknown;
        failureCode?: unknown;
        failureMessage?: unknown;
        expectedRevision?: unknown;
      };
      const status = requireEndpointStatus(body.status);
      const currentLiveSetItemId = body.currentLiveSetItemId === null
        ? null : requireUuid(body.currentLiveSetItemId, "currentLiveSetItemId");
      const positionMs = requireNonNegativeInteger(body.positionMs, "positionMs");
      const failureCode = requireFailureCode(body.failureCode);
      const failureMessage = body.failureMessage === null
        ? null : requireString(body.failureMessage, "failureMessage", 300);
      const expectedRevision = requireExpectedRevision(body.expectedRevision);
      const isFailure = status === "unavailable" || status === "error";
      if (isFailure && !failureCode) {
        throw new DomainError("Failure states require a failureCode.", 400, "invalid_playback_endpoint_state");
      }
      if (!isFailure && (failureCode || failureMessage)) {
        throw new DomainError("Only unavailable/error states may include failure details.", 400, "invalid_playback_endpoint_state");
      }

      const result = await executeIdempotentCommand({
        pool,
        identityId: identity.id,
        idempotencyKey: request.headers["idempotency-key"],
        commandName: "playback.endpoints.report_state",
        requestBody: { pitId, endpointId, status, currentLiveSetItemId, positionMs, failureCode, failureMessage, expectedRevision },
        execute: async (client) => {
          await assertOwnerOrPitMember(client, identity.id, pitId);
          const current = await client.query<{
            live_set_id: string;
            revision: number;
          }>(
            `SELECT live_set_id, revision FROM playback_endpoints
             WHERE id = $1 AND pit_id = $2 AND identity_id = $3 FOR UPDATE`,
            [endpointId, pitId, identity.id]
          );
          const endpoint = current.rows[0];
          if (!endpoint) throw new DomainError("PlaybackEndpoint not found or access denied.", 404, "playback_endpoint_not_found");
          if (endpoint.revision !== expectedRevision) {
            throw new DomainError("PlaybackEndpoint revision is outdated.", 409, "revision_conflict", { currentRevision: endpoint.revision });
          }
          if (currentLiveSetItemId) {
            const item = await client.query(
              "SELECT 1 FROM live_set_items WHERE id = $1 AND live_set_id = $2",
              [currentLiveSetItemId, endpoint.live_set_id]
            );
            if (!item.rowCount) throw new DomainError("The reported item does not belong to this endpoint's Live Set.", 422, "invalid_playback_endpoint_item");
          }
          const updated = await client.query(
            `UPDATE playback_endpoints
             SET status = $4, current_live_set_item_id = $5, position_ms = $6,
                 failure_code = $7, failure_message = $8,
                 revision = revision + 1, last_reported_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND pit_id = $2 AND identity_id = $3
             RETURNING ${endpointReturning}`,
            [endpointId, pitId, identity.id, status, currentLiveSetItemId, positionMs,
              failureCode, failureMessage]
          );
          const mapped = mapEndpoint(updated.rows[0]);
          await enqueueRealtimeEvent({
            client,
            channel: `pit:${pitId}`,
            eventType: "playback.endpoint_state_changed",
            aggregateType: "playback_endpoint",
            aggregateId: endpointId,
            aggregateRevision: mapped.revision as number,
            payload: {
              pitId,
              endpointId,
              identityId: identity.id,
              status,
              currentLiveSetItemId,
              positionMs,
              failureCode
            }
          });
          return { statusCode: 200, body: { endpoint: mapped } };
        }
      });
      return reply.code(result.statusCode).send(result.body);
    }
  );
}
