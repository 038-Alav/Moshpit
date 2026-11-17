import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { RealtimeEvent } from "@moshpit/contracts";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export interface CommandResult<T = unknown> {
  statusCode: number;
  body: T;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function executeIdempotentCommand<T>(input: {
  pool: Pool;
  identityId: string;
  idempotencyKey: string | string[] | undefined;
  commandName: string;
  requestBody: unknown;
  execute: (client: PoolClient) => Promise<CommandResult<T>>;
}): Promise<CommandResult<T>> {
  const idempotencyKey = Array.isArray(input.idempotencyKey)
    ? input.idempotencyKey.length === 1 ? input.idempotencyKey[0] : undefined
    : input.idempotencyKey;
  if (!idempotencyKey || idempotencyKey.length > 128) {
    throw new DomainError("A valid Idempotency-Key header is required.", 400, "idempotency_key_required");
  }

  const requestHash = createHash("sha256").update(stableJson(input.requestBody)).digest("hex");
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO idempotency_records
        (identity_id, idempotency_key, command_name, request_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (identity_id, idempotency_key) DO NOTHING
       RETURNING identity_id`,
      [input.identityId, idempotencyKey, input.commandName, requestHash]
    );

    if (inserted.rowCount === 0) {
      const existing = await client.query<{
        command_name: string;
        request_hash: string;
        response_status: number | null;
        response_body: T | null;
      }>(
        `SELECT command_name, request_hash, response_status, response_body
         FROM idempotency_records
         WHERE identity_id = $1 AND idempotency_key = $2
         FOR UPDATE`,
        [input.identityId, idempotencyKey]
      );
      const record = existing.rows[0];
      if (!record || record.command_name !== input.commandName || record.request_hash !== requestHash) {
        throw new DomainError("This idempotency key was already used for a different command.", 409, "idempotency_key_conflict");
      }
      if (record.response_status === null || record.response_body === null) {
        throw new DomainError("The previous command is still being processed. Retry shortly.", 409, "command_in_progress");
      }
      await client.query("COMMIT");
      return { statusCode: record.response_status, body: record.response_body };
    }

    const result = await input.execute(client);
    await client.query(
      `UPDATE idempotency_records
       SET response_status = $3, response_body = $4::jsonb, completed_at = NOW()
       WHERE identity_id = $1 AND idempotency_key = $2`,
      [input.identityId, idempotencyKey, result.statusCode, JSON.stringify(result.body)]
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function enqueueRealtimeEvent<TPayload>(input: {
  client: PoolClient;
  channel: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateRevision: number;
  payload: TPayload;
}): Promise<void> {
  const event: RealtimeEvent<TPayload> = {
    eventId: randomUUID(),
    schemaVersion: 1,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateRevision: input.aggregateRevision,
    occurredAt: new Date().toISOString(),
    payload: input.payload
  };

  await input.client.query(
    `INSERT INTO event_outbox
      (event_id, channel, event_type, schema_version, aggregate_type, aggregate_id,
       aggregate_revision, payload, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
    [event.eventId, input.channel, event.eventType, event.schemaVersion, event.aggregateType,
      event.aggregateId, event.aggregateRevision, JSON.stringify(event), event.occurredAt]
  );
}

export function requireExpectedRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new DomainError("expectedRevision must be a positive integer.", 400, "invalid_expected_revision");
  }
  return Number(value);
}

export function requireString(value: unknown, field: string, maxLength: number, minLength = 1): string {
  if (typeof value !== "string") throw new DomainError(`${field} must be a string.`, 400, "invalid_request");
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new DomainError(`${field} must contain between ${minLength} and ${maxLength} characters.`, 400, "invalid_request");
  }
  return normalized;
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new DomainError(`${field} must be a valid UUID.`, 400, "invalid_request");
  }
  return value;
}

export async function assertOwnerOrPitMember(client: PoolClient, identityId: string, pitId: string, allowedRoles?: string[]) {
  const result = await client.query<{ role: string; pit_status: string }>(
    `SELECT pm.role, p.status AS pit_status
     FROM pit_memberships pm JOIN pits p ON p.id = pm.pit_id
     WHERE pm.pit_id = $1 AND pm.identity_id = $2
     FOR SHARE OF p`,
    [pitId, identityId]
  );
  const membership = result.rows[0];
  if (!membership) throw new DomainError("Pit not found or access denied.", 404, "pit_not_found");
  if (membership.pit_status !== "active") throw new DomainError("This Pit has ended.", 409, "pit_ended");
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new DomainError("You do not have permission to perform this action.", 403, "forbidden");
  }
  return membership.role;
}
