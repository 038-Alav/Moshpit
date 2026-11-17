import type { Pool } from "pg";
import type { RealtimeEvent, RealtimePublisher } from "@moshpit/contracts";

interface OutboxRow {
  event_id: string;
  channel: string;
  payload: RealtimeEvent;
  attempts: number;
}

export function startOutboxDispatcher(pool: Pool, publisher: RealtimePublisher, intervalMs = 1_000) {
  let stopped = false;
  let running = false;

  async function processBatch() {
    if (stopped || running) return;
    running = true;
    try {
      const client = await pool.connect();
      let rows: OutboxRow[] = [];
      try {
        await client.query("BEGIN");
        const selected = await client.query<OutboxRow>(
          `SELECT event_id, channel, payload, attempts
           FROM event_outbox
           WHERE published_at IS NULL AND next_attempt_at <= NOW()
             AND (locked_until IS NULL OR locked_until < NOW())
           ORDER BY occurred_at
           LIMIT 50
           FOR UPDATE SKIP LOCKED`
        );
        rows = selected.rows;
        if (rows.length) {
          await client.query(
            `UPDATE event_outbox SET locked_until = NOW() + INTERVAL '30 seconds'
             WHERE event_id = ANY($1::uuid[])`,
            [rows.map((row) => row.event_id)]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      for (const row of rows) {
        try {
          await publisher.publish(row.channel, row.payload);
          await pool.query(
            `UPDATE event_outbox SET published_at = NOW(), locked_until = NULL, last_error = NULL
             WHERE event_id = $1`, [row.event_id]
          );
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 2_000) : "Unknown publish error";
          await pool.query(
            `UPDATE event_outbox
             SET attempts = attempts + 1,
                 next_attempt_at = NOW() + (LEAST(300, POWER(2, LEAST(attempts + 1, 8))) * INTERVAL '1 second'),
                 locked_until = NULL, last_error = $2
             WHERE event_id = $1`, [row.event_id, message]
          );
        }
      }
    } catch (error) {
      // A later poll retries infrastructure failures. Domain commands are already committed.
      console.error("Moshpit outbox dispatcher error", error);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void processBatch(), intervalMs);
  timer.unref();
  void processBatch();

  return async function stop() {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((resolve) => setTimeout(resolve, 25));
  };
}
