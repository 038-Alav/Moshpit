# Inbound / Outbound Realtime Contract — D1 baseline

## Directions and authority

### Client → Fastify over HTTP

All state-changing commands enter Fastify over HTTP:

- Create/update Setlists and their items.
- Create/end Pits, accept invitations and manage membership through authorized flows.
- Mutate Live Sets.
- Register PlaybackEndpoints and report endpoint-local state.
- Future shared Playback commands.

The server derives identity from the guest bearer session. The client cannot provide another identity ID as an authority claim.

### Fastify → clients through Centrifugo

Only events written to `event_outbox` in the same PostgreSQL transaction as the corresponding domain change may be published. The outbox worker publishes after commit and retries failures. Centrifugo is transport, not source of truth.

Clients have no direct publication rights on `pit:*` or `identity:*` channels. They receive a short-lived Centrifugo connection JWT and a channel-specific subscription JWT from Fastify. Pit subscription tokens are issued only after server-side membership validation.

### Client → Fastify through Centrifugo RPC Proxy

Not enabled in D1. Reserved for playback endpoint observations/acknowledgements in later demos.

## Command contract

Every state-changing command:

- Derives identity from the authenticated guest session.
- Validates authorization in the module owning the aggregate.
- Requires `Idempotency-Key` to prevent retrying the same command twice.
- Requires `expectedRevision` for aggregate mutations.
- Returns the committed result and revision.
- Commits domain rows and outbox event rows atomically.

A reused idempotency key with a different command or request body returns a conflict. A repeated identical command returns its previously committed response.

## Event envelope

```ts
interface RealtimeEvent<TPayload> {
  eventId: string;
  schemaVersion: number;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateRevision: number;
  occurredAt: string;
  payload: TPayload;
}
```

Events may be delivered more than once (for example, when a publisher crashes after Centrifugo accepts a message but before the outbox row is marked published). Consumers must treat `eventId` as a deduplication key. Aggregate revisions are monotonic within the relevant aggregate. PlaybackEndpoint events use `aggregateType=playback_endpoint` and the endpoint's own revision; they do not increment PlaybackSession revision.

## Recovery

HTTP snapshots are authoritative. The D1 web client fetches a fresh Pit snapshot on initial subscription, reconnection/subscription restoration and every publication. This is intentionally conservative and avoids depending on Centrifugo recovery history while the event contract is young.

The server returns the current Pit, membership, members, Live Set/items, PlaybackSession and the latest PlaybackEndpoint reports. Clients should not infer missing state from an event stream. A future optimized client may use revisions to detect gaps and request snapshots selectively.

## D2 PlaybackEndpoint events

D2 publishes `playback.endpoint_registered` and `playback.endpoint_state_changed` after endpoint persistence commits. These events describe one runtime's local execution state; they are observations, not commands. A failed endpoint does not change shared PlaybackSession state or instruct other endpoints to stop.

## RPC Proxy future

Candidate methods:

- `playback.endpoint.ready`
- `playback.endpoint.observation`
- `playback.endpoint.buffering`
- `playback.endpoint.failure`

Each method requires an explicit schema and authorization. An observation does not execute `play`, `pause`, `seek`, `next` or mutate a Live Set.
