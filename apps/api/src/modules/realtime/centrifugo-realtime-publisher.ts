import type {
  RealtimeEvent,
  RealtimePublisher
} from "@moshpit/contracts";
import { env } from "../../config/env.js";

/**
 * Infrastructure adapter only.
 * Domain modules depend on the RealtimePublisher port, never on Centrifugo.
 */
export class CentrifugoRealtimePublisher implements RealtimePublisher {
  async publish<TPayload>(
    channel: string,
    event: RealtimeEvent<TPayload>
  ): Promise<void> {
    const response = await fetch(`${env.centrifugoUrl}/api/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.centrifugoApiKey
      },
      body: JSON.stringify({
        channel,
        data: event
      })
    });

    const responseBody = await response.json().catch(() => null) as
      | { error?: { code?: number; message?: string } }
      | null;
    if (!response.ok || responseBody?.error) {
      throw new Error(
        `Centrifugo publish failed (${response.status}): ${responseBody?.error?.message ?? "unexpected response"}`
      );
    }
  }
}
