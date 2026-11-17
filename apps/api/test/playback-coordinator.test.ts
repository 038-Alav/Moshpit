import assert from "node:assert/strict";
import test from "node:test";
import type { PlaybackEndpoint, PlaybackSession } from "@moshpit/contracts";
import { PlaybackCoordinator } from "../src/modules/playback/playback-coordinator.js";

const session: PlaybackSession = {
  id: "10000000-0000-4000-8000-000000000001",
  pitId: "10000000-0000-4000-8000-000000000002",
  liveSetId: "10000000-0000-4000-8000-000000000003",
  mode: "individual",
  desiredState: "playing",
  currentLiveSetItemId: "10000000-0000-4000-8000-000000000004",
  positionMs: 12_500,
  revision: 7,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z"
};

function endpoint(overrides: Partial<PlaybackEndpoint> = {}): PlaybackEndpoint {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    pitId: session.pitId,
    playbackSessionId: session.id,
    liveSetId: session.liveSetId,
    identityId: "30000000-0000-4000-8000-000000000001",
    clientInstanceId: "40000000-0000-4000-8000-000000000001",
    providerKey: null,
    status: "ready",
    capabilities: {
      canPlay: true,
      canPause: true,
      canSeek: true,
      canStop: true,
      canPrepare: true,
      canReportPosition: true
    },
    currentLiveSetItemId: null,
    positionMs: 0,
    failureCode: null,
    failureMessage: null,
    revision: 1,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    lastReportedAt: "2026-11-16T00:00:00.000Z",
    ...overrides
  };
}

test("one failed individual endpoint does not block directives for healthy endpoints", () => {
  const coordinator = new PlaybackCoordinator();
  const failed = endpoint({ id: "20000000-0000-4000-8000-000000000002", status: "error", failureCode: "track_unavailable" });
  const healthy = endpoint({ id: "20000000-0000-4000-8000-000000000003", status: "ready" });

  const plan = coordinator.plan(session, [failed, healthy]);

  assert.equal(plan.directives.length, 1);
  assert.equal(plan.directives[0].endpointId, healthy.id);
  assert.equal(plan.directives[0].action, "play");
  assert.deepEqual(plan.skipped, [{ endpointId: failed.id, reason: "endpoint_error" }]);
  assert.equal(session.desiredState, "playing", "planning must not mutate shared session state");
});

test("unavailable endpoint is isolated from other participants", () => {
  const coordinator = new PlaybackCoordinator();
  const unavailable = endpoint({ id: "20000000-0000-4000-8000-000000000002", status: "unavailable", failureCode: "provider_unavailable" });
  const healthy = endpoint({ id: "20000000-0000-4000-8000-000000000003", status: "paused" });

  const plan = coordinator.plan(session, [unavailable, healthy]);

  assert.deepEqual(plan.directives.map((directive) => directive.endpointId), [healthy.id]);
  assert.deepEqual(plan.skipped, [{ endpointId: unavailable.id, reason: "endpoint_unavailable" }]);
});

test("coordinator switches an endpoint playing a different item to shared current item", () => {
  const coordinator = new PlaybackCoordinator();
  const endpointOnDifferentTrack = endpoint({
    status: "playing",
    currentLiveSetItemId: "20000000-0000-4000-8000-000000000099"
  });

  const plan = coordinator.plan(session, [endpointOnDifferentTrack]);

  assert.equal(plan.directives.length, 1);
  assert.equal(plan.directives[0].liveSetItemId, session.currentLiveSetItemId);
});

test("coordinator skips endpoints already playing the shared item", () => {
  const coordinator = new PlaybackCoordinator();
  const alreadyPlaying = endpoint({ status: "playing", currentLiveSetItemId: session.currentLiveSetItemId });

  const plan = coordinator.plan(session, [alreadyPlaying]);

  assert.equal(plan.directives.length, 0);
  assert.deepEqual(plan.skipped, [{ endpointId: alreadyPlaying.id, reason: "already_in_target_state" }]);
});

test("coordinator does not plan unsupported Stage Playback in D2", () => {
  const coordinator = new PlaybackCoordinator();
  const stageSession: PlaybackSession = { ...session, mode: "stage" };
  const endpointA = endpoint();

  const plan = coordinator.plan(stageSession, [endpointA]);

  assert.equal(plan.directives.length, 0);
  assert.deepEqual(plan.skipped, [{ endpointId: endpointA.id, reason: "stage_mode_not_supported" }]);
});


test("coordinator rejects an endpoint from another session", () => {
  const coordinator = new PlaybackCoordinator();
  const foreignEndpoint = endpoint({ playbackSessionId: "10000000-0000-4000-8000-000000000099" });

  const plan = coordinator.plan(session, [foreignEndpoint]);

  assert.equal(plan.directives.length, 0);
  assert.deepEqual(plan.skipped, [{ endpointId: foreignEndpoint.id, reason: "endpoint_session_mismatch" }]);
});
