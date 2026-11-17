# Playback module

Playback owns the shared `PlaybackSession`, per-runtime `PlaybackEndpoint` state and the policy that turns shared intent into endpoint-specific directives.

## D1 baseline

D1 creates one persisted PlaybackSession per Pit. It starts in `mode=individual`, `desiredState=paused`, with no current Live Set item and position zero. It is shared intent/state, not an audio player and not a device's actual player state.

## D2 — Playback Foundation

D2 introduces:

- `PlaybackEndpoint`: one authenticated identity + client runtime executing locally for a Pit's PlaybackSession.
- Endpoint-local status (`idle`, `resolving`, `ready`, `playing`, `paused`, `unavailable`, `error`), position and failure details.
- Effective endpoint capabilities, provider-neutral provider/driver contracts and a pure `PlaybackCoordinator` planner.
- HTTP registration, state-reporting and read endpoints. A member may report only their own endpoint. Viewer may report local execution state but receives no additional permission to alter the shared Pit/Live Set.
- PostgreSQL integrity constraints tying the endpoint to the same Pit, PlaybackSession, Live Set, membership and optional Live Set item.
- Outbox events for endpoint lifecycle changes. Endpoint events have their own aggregate identity/revision and do not increment PlaybackSession revision.

### Isolation invariant

A provider, catalog, resolution or playback failure is local to the affected PlaybackEndpoint. It must not pause, stop, skip, replace or otherwise mutate the shared PlaybackSession or other endpoints. The coordinator skips an unavailable/failed endpoint while still planning directives for healthy endpoints.

Endpoint capabilities are client-reported routing hints, not authorization. An actual adapter/driver must enforce its own capabilities before executing an operation. `lastReportedAt` is an endpoint report timestamp, not a PresenceLease and not proof that a user is currently online.

### Current D2 boundary

D2 does not execute audio, call provider SDKs, dispatch directives to clients, implement Stage Playback, perform track resolution, coordinate a preparation barrier, synchronize clocks or correct drift. The coordinator currently produces a deterministic plan only. Dispatch, navigation, retries/reconciliation and timing coordination belong to later demos/phases.

## API

- `POST /api/pits/:pitId/playback/endpoints` — register/refresh the current identity's runtime endpoint. Requires `Idempotency-Key`, `clientInstanceId`, `capabilities`, and optional `providerKey`.
- `GET /api/pits/:pitId/playback/endpoints` — list endpoint-local states visible to Pit members.
- `PATCH /api/pits/:pitId/playback/endpoints/:endpointId/state` — report a complete local state. Requires `Idempotency-Key` and `expectedRevision`. `unavailable` and `error` require a `failureCode`.

A `clientInstanceId` is stable for one client runtime/tab and scoped to the authenticated identity + PlaybackSession. Re-registering the same runtime resets its local report to `idle`; the client must reconcile/re-report its actual state. This does not create a PresenceLease.
