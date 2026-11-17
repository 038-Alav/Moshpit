import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { runMigrations } from "../src/shared/infrastructure/migrations.js";

const connectionString = process.env.MOSHPIT_TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const { Pool } = pg;

integrationTest("D2 endpoints keep local failures independent from shared PlaybackSession", async () => {
  const pool = new Pool({ connectionString });
  await runMigrations(pool);
  const app = buildApp({ pool, tokenSecret: "playback-foundation-test-secret", logger: false });
  try {
    async function guest(displayName: string) {
      const response = await app.inject({
        method: "POST", url: "/api/identity/guest", payload: { displayName }
      });
      assert.equal(response.statusCode, 201);
      return response.json() as { identity: { id: string }; sessionToken: string };
    }
    const owner = await guest(`PlaybackOwner-${randomUUID().slice(0, 6)}`);
    const viewer = await guest(`PlaybackViewer-${randomUUID().slice(0, 6)}`);
    const auth = (token: string, idempotencyKey?: string) => ({
      authorization: `Bearer ${token}`,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
    });

    const createPit = await app.inject({
      method: "POST", url: "/api/pits", headers: auth(owner.sessionToken, randomUUID()),
      payload: { name: "Playback Foundation Pit" }
    });
    assert.equal(createPit.statusCode, 201);
    const pitId = createPit.json().pit.id as string;

    const addTrack = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/live-set/items`,
      headers: auth(owner.sessionToken, randomUUID()),
      payload: { trackId: "00000000-0000-4000-8000-00000000000a", expectedRevision: 1 }
    });
    assert.equal(addTrack.statusCode, 201);
    const liveSetItemId = addTrack.json().itemId as string;

    const invite = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/invitations`,
      headers: auth(owner.sessionToken, randomUUID()), payload: { role: "viewer" }
    });
    assert.equal(invite.statusCode, 201);
    const accepted = await app.inject({
      method: "POST", url: "/api/pit-invitations/accept",
      headers: auth(viewer.sessionToken, randomUUID()), payload: { token: invite.json().token }
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.json().role, "viewer");

    const capabilities = {
      canPlay: true, canPause: true, canSeek: true,
      canStop: true, canPrepare: true, canReportPosition: true
    };
    const ownerRegistration = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/playback/endpoints`,
      headers: auth(owner.sessionToken, randomUUID()),
      payload: { clientInstanceId: randomUUID(), providerKey: null, capabilities }
    });
    assert.equal(ownerRegistration.statusCode, 201);
    const ownerEndpointId = ownerRegistration.json().endpoint.id as string;

    // A Viewer may report their own local execution state without gaining
    // permission to control the shared Live Set or PlaybackSession.
    const viewerRegistration = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/playback/endpoints`,
      headers: auth(viewer.sessionToken, randomUUID()),
      payload: { clientInstanceId: randomUUID(), providerKey: "example-provider", capabilities }
    });
    assert.equal(viewerRegistration.statusCode, 201);
    const viewerEndpointId = viewerRegistration.json().endpoint.id as string;

    const ownerState = await app.inject({
      method: "PATCH", url: `/api/pits/${pitId}/playback/endpoints/${ownerEndpointId}/state`,
      headers: auth(owner.sessionToken, randomUUID()),
      payload: {
        status: "playing", currentLiveSetItemId: liveSetItemId, positionMs: 1_200,
        failureCode: null, failureMessage: null, expectedRevision: 1
      }
    });
    assert.equal(ownerState.statusCode, 200);
    assert.equal(ownerState.json().endpoint.status, "playing");

    const viewerFailure = await app.inject({
      method: "PATCH", url: `/api/pits/${pitId}/playback/endpoints/${viewerEndpointId}/state`,
      headers: auth(viewer.sessionToken, randomUUID()),
      payload: {
        status: "error", currentLiveSetItemId: liveSetItemId, positionMs: 0,
        failureCode: "track_unavailable", failureMessage: "Track not available for this endpoint.",
        expectedRevision: 1
      }
    });
    assert.equal(viewerFailure.statusCode, 200);
    assert.equal(viewerFailure.json().endpoint.status, "error");

    const ownerCannotReportViewerEndpoint = await app.inject({
      method: "PATCH", url: `/api/pits/${pitId}/playback/endpoints/${viewerEndpointId}/state`,
      headers: auth(owner.sessionToken, randomUUID()),
      payload: {
        status: "ready", currentLiveSetItemId: liveSetItemId, positionMs: 0,
        failureCode: null, failureMessage: null, expectedRevision: 2
      }
    });
    assert.equal(ownerCannotReportViewerEndpoint.statusCode, 404);

    const endpointList = await app.inject({
      method: "GET", url: `/api/pits/${pitId}/playback/endpoints`, headers: auth(owner.sessionToken)
    });
    assert.equal(endpointList.statusCode, 200);
    const endpoints = endpointList.json().endpoints as Array<{ id: string; status: string }>;
    assert.equal(endpoints.length, 2);
    assert.equal(endpoints.find((endpoint) => endpoint.id === ownerEndpointId)?.status, "playing");
    assert.equal(endpoints.find((endpoint) => endpoint.id === viewerEndpointId)?.status, "error");

    const sharedSession = await pool.query(
      `SELECT desired_state, current_live_set_item_id, revision FROM playback_sessions WHERE pit_id = $1`, [pitId]
    );
    assert.equal(sharedSession.rows[0].desired_state, "paused");
    assert.equal(sharedSession.rows[0].current_live_set_item_id, null);
    assert.equal(sharedSession.rows[0].revision, 1, "endpoint-local reports must not mutate PlaybackSession");

    const outboxEvents = await pool.query(
      `SELECT COUNT(*)::int AS count FROM event_outbox
       WHERE channel = $1 AND event_type = 'playback.endpoint_state_changed'`, [`pit:${pitId}`]
    );
    assert.equal(outboxEvents.rows[0].count, 2);
  } finally {
    await app.close();
    await pool.end();
  }
});
