# Phase 2 — Playback Foundation (D2 implementation baseline)

**Status:** D2 foundation implemented; target-environment verification pending.  
**Scope:** provider-neutral playback contracts, endpoint independence and coordinator planning. No audio playback is shipped.

## 1. Domain separation

### PlaybackSession — shared state

One persisted PlaybackSession belongs to a Pit and its active Live Set. It expresses the common playback intent/state:

- mode (`individual` or future `stage`)
- desired state (`playing` or `paused`)
- current Live Set item
- shared position anchor
- aggregate revision

It is not a player instance. Endpoint-local failures must never mutate this aggregate.

### PlaybackEndpoint — local execution

One endpoint represents one authenticated identity + client runtime in a Pit. Multiple browsers, tabs or devices can have independent endpoint records. It reports:

- provider selection (optional in D2)
- effective local capabilities
- local status
- locally reported current Live Set item and position
- local failure code/message
- endpoint revision and last report timestamp

Endpoint state is not PresenceLease. `lastReportedAt` must not be used as authoritative online/offline presence. A future PresenceLease policy is separate and remains open.

### PlaybackCoordinator — policy / planning

The D2 `PlaybackCoordinator` is a deterministic planner. It reads one shared PlaybackSession and a set of PlaybackEndpoints, then creates one directive or skip reason per endpoint.

For Individual Playback:

- a failed/unavailable endpoint is skipped independently;
- a healthy endpoint can still receive a directive;
- an endpoint already playing the shared item is not redundantly instructed to play;
- an endpoint playing a different item can be directed to the shared current item;
- unsupported capabilities and endpoints still resolving are skipped with explicit reasons.

D2 does not dispatch the plan, execute audio or implement timing. Stage mode produces an explicit `stage_mode_not_supported` skip until the Stage Playback milestone.

## 2. Provider-neutral contracts

`packages/contracts/src/index.ts` now defines:

- `PlaybackCapabilities`
- `PlaybackEndpointStatus` and `PlaybackEndpointFailureCode`
- `PlaybackEndpoint`, registration and state-report contracts
- endpoint directives and playback plans
- `PlaybackProviderDescriptor`, `PlaybackProviderAdapter` and track-resolution contracts
- `PlaybackEndpointDriver`, the device-local execution port

The provider adapter is responsible for resolving a CanonicalTrack for one provider. The endpoint driver is responsible for executing locally on one endpoint. Neither owns PlaybackSession or Pit membership. No concrete provider adapter or driver is included in D2.

## 3. Persistence

Migration `002_playback_foundation.sql` adds `playback_endpoints` and the composite key required to guarantee that an endpoint's session/Pit/Live Set combination is valid.

Foreign keys also ensure:

- endpoint identity is a member of that Pit;
- the endpoint is associated with that Pit's PlaybackSession and Live Set;
- a reported current item belongs to that same Live Set.

Endpoint state has an independent revision. Reports produce `playback.endpoint_registered` or `playback.endpoint_state_changed` outbox events under the Pit channel, with `aggregateType=playback_endpoint`. They do not increment `playback_sessions.revision` and do not update desired state, shared current item or shared position.

## 4. HTTP surface

All endpoints require a valid Moshpit session token.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/pits/:pitId/playback/endpoints` | Register or refresh the authenticated identity's runtime endpoint |
| GET | `/api/pits/:pitId/playback/endpoints` | Read the endpoint states of Pit members |
| PATCH | `/api/pits/:pitId/playback/endpoints/:endpointId/state` | Report the caller's own endpoint-local state |

Registration and state reports require `Idempotency-Key`. State reports require `expectedRevision`. An endpoint can only be updated by the identity that owns it. Pit membership is required; Viewer can report its own device-local state but still cannot modify the shared Live Set or shared playback controls.

A registration uses `(playbackSessionId, identityId, clientInstanceId)` as runtime uniqueness. Re-registering a runtime resets the endpoint's local status to `idle`, clears previous local failure details and increments its endpoint revision so that the client can reconcile and report fresh state.

Registration body example:

```json
{
  "clientInstanceId": "<runtime-uuid>",
  "providerKey": null,
  "capabilities": {
    "canPlay": true,
    "canPause": true,
    "canSeek": true,
    "canStop": true,
    "canPrepare": true,
    "canReportPosition": true
  }
}
```

State-report body example:

```json
{
  "status": "error",
  "currentLiveSetItemId": "<live-set-item-uuid>",
  "positionMs": 0,
  "failureCode": "track_unavailable",
  "failureMessage": "Track not available for this endpoint.",
  "expectedRevision": 1
}
```

For non-failure states, `failureCode` and `failureMessage` must both be `null`. For `unavailable` and `error`, a failure code is required. A reported current item must belong to the endpoint's own Live Set.

## 5. D2 non-goals

- No real audio playback or player SDK.
- No Spotify, YouTube or YouTube Music adapters.
- No server-side track resolution implementation.
- No shared play/pause/next/previous commands yet.
- No directive dispatch to browser/device drivers.
- No preparation barrier, start scheduling, clock synchronization or drift correction.
- No Stage Playback / Boss device.
- No PresenceLease or Admin succession.

These are reserved for later demos/phases and remain governed by the Product & Engineering Blueprint.

## 6. Verification

Unit tests cover deterministic planning and endpoint isolation. PostgreSQL integration coverage registers endpoints for two identities, reports a local error for one while the other remains playing, validates endpoint ownership and proves `playback_sessions` is not mutated by endpoint-state reports.

Run in the target Windows environment:

```powershell
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Set `MOSHPIT_TEST_DATABASE_URL` to a dedicated PostgreSQL test database to run the integration tests (including the D2 endpoint test). The implementation environment could not download pnpm/dependencies or connect to PostgreSQL, so the official workspace typecheck/build and database integration result remain unverified here. In this environment, the `@moshpit/contracts` package typecheck passed, a strict scoped TypeScript check of the new playback API/coordinator and shared dependencies passed using temporary external type declarations, all 39 project TypeScript/TSX files passed syntax transpilation, and all 6 coordinator unit tests passed.
