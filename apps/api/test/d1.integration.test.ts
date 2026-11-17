import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { runMigrations } from "../src/shared/infrastructure/migrations.js";

const connectionString = process.env.MOSHPIT_TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const { Pool } = pg;

integrationTest("D1 sharing journey: Setlist -> independent Pit Live Set -> invitation and role enforcement", async () => {
  const pool = new Pool({ connectionString });
  await runMigrations(pool);
  const app = buildApp({ pool, tokenSecret: "integration-test-secret", logger: false });
  try {
    async function guest(displayName: string) {
      const response = await app.inject({ method: "POST", url: "/api/identity/guest", payload: { displayName } });
      assert.equal(response.statusCode, 201);
      return response.json() as { identity: { id: string }; sessionToken: string };
    }
    function auth(sessionToken: string, idempotencyKey?: string) {
      return {
        authorization: `Bearer ${sessionToken}`,
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
      };
    }

    const owner = await guest(`Owner-${randomUUID().slice(0, 6)}`);
    const setlistKey = randomUUID();
    const createSetlist = await app.inject({
      method: "POST", url: "/api/setlists", headers: auth(owner.sessionToken, setlistKey),
      payload: { name: "D1 acceptance Setlist" }
    });
    assert.equal(createSetlist.statusCode, 201);
    const createdSetlist = createSetlist.json().setlist as { id: string; revision: number };

    const duplicateSetlist = await app.inject({
      method: "POST", url: "/api/setlists", headers: auth(owner.sessionToken, setlistKey),
      payload: { name: "D1 acceptance Setlist" }
    });
    assert.equal(duplicateSetlist.statusCode, 201);
    assert.equal(duplicateSetlist.json().setlist.id, createdSetlist.id);

    const trackA = "00000000-0000-4000-8000-00000000000a";
    const addTrack = await app.inject({
      method: "POST", url: `/api/setlists/${createdSetlist.id}/items`,
      headers: auth(owner.sessionToken, randomUUID()), payload: { trackId: trackA, expectedRevision: 1 }
    });
    assert.equal(addTrack.statusCode, 201);
    const addTrackB = await app.inject({
      method: "POST", url: `/api/setlists/${createdSetlist.id}/items`,
      headers: auth(owner.sessionToken, randomUUID()), payload: { trackId: "00000000-0000-4000-8000-00000000000b", expectedRevision: 2 }
    });
    assert.equal(addTrackB.statusCode, 201);
    const setlistBeforeReorder = await app.inject({
      method: "GET", url: `/api/setlists/${createdSetlist.id}`, headers: auth(owner.sessionToken)
    });
    const setlistItemIds = (setlistBeforeReorder.json().items as Array<{ itemId: string }>).map((item) => item.itemId);
    const reorderSetlist = await app.inject({
      method: "PATCH", url: `/api/setlists/${createdSetlist.id}/items/reorder`,
      headers: auth(owner.sessionToken, randomUUID()), payload: { itemIds: [...setlistItemIds].reverse(), expectedRevision: 3 }
    });
    assert.equal(reorderSetlist.statusCode, 200);

    const createPit = await app.inject({
      method: "POST", url: "/api/pits", headers: auth(owner.sessionToken, randomUUID()),
      payload: { name: "D1 acceptance Pit", setlistId: createdSetlist.id, sourceSetlistRevision: 4 }
    });
    assert.equal(createPit.statusCode, 201);
    const pitId = createPit.json().pit.id as string;

    const snapshotBefore = await app.inject({ method: "GET", url: `/api/pits/${pitId}/snapshot`, headers: auth(owner.sessionToken) });
    assert.equal(snapshotBefore.statusCode, 200);
    assert.equal(snapshotBefore.json().liveSet.items.length, 2);
    const liveSetId = snapshotBefore.json().liveSet.id as string;
    const copiedTrackTitles = (snapshotBefore.json().liveSet.items as Array<{ title: string }>).map((item) => item.title);
    assert.deepEqual(copiedTrackTitles, ["Test Track B", "Test Track A"], "Pit creation should preserve the source Setlist ordering");
    const initialLiveItemIds = (snapshotBefore.json().liveSet.items as Array<{ itemId: string }>).map((item) => item.itemId);
    const reorderLiveSet = await app.inject({
      method: "PATCH", url: `/api/pits/${pitId}/live-set/items/reorder`,
      headers: auth(owner.sessionToken, randomUUID()), payload: { itemIds: [...initialLiveItemIds].reverse(), expectedRevision: 1 }
    });
    assert.equal(reorderLiveSet.statusCode, 200);
    const sourceAfterLiveSetEdit = await app.inject({
      method: "GET", url: `/api/setlists/${createdSetlist.id}`, headers: auth(owner.sessionToken)
    });
    assert.deepEqual(
      (sourceAfterLiveSetEdit.json().items as Array<{ title: string }>).map((item) => item.title),
      ["Test Track B", "Test Track A"],
      "Live Set edits must not mutate the source Setlist"
    );

    const addToSourceSetlist = await app.inject({
      method: "POST", url: `/api/setlists/${createdSetlist.id}/items`,
      headers: auth(owner.sessionToken, randomUUID()), payload: { trackId: "00000000-0000-4000-8000-00000000000c", expectedRevision: 4 }
    });
    assert.equal(addToSourceSetlist.statusCode, 201);
    const snapshotAfter = await app.inject({ method: "GET", url: `/api/pits/${pitId}/snapshot`, headers: auth(owner.sessionToken) });
    assert.equal(snapshotAfter.json().liveSet.items.length, 2, "Live Set must not mirror later Setlist edits");
    assert.equal(snapshotAfter.json().liveSet.id, liveSetId);
    assert.deepEqual(
      (snapshotAfter.json().liveSet.items as Array<{ title: string }>).map((item) => item.title),
      ["Test Track A", "Test Track B"],
      "The Live Set should retain its own reordered state after the source Setlist changes"
    );

    const inviteKey = randomUUID();
    const invite = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/invitations`, headers: auth(owner.sessionToken, inviteKey),
      payload: { role: "viewer" }
    });
    assert.equal(invite.statusCode, 201);
    const inviteRetry = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/invitations`, headers: auth(owner.sessionToken, inviteKey),
      payload: { role: "viewer" }
    });
    assert.equal(inviteRetry.statusCode, 201);
    assert.equal(inviteRetry.json().token, invite.json().token, "idempotent invite retries should return the same token");
    const cachedInviteResponse = await pool.query(
      `SELECT response_body FROM idempotency_records WHERE identity_id = $1 AND idempotency_key = $2`,
      [owner.identity.id, inviteKey]
    );
    assert.equal(cachedInviteResponse.rows[0].response_body.token, undefined, "plaintext invite tokens must not be stored in idempotency response bodies");
    const viewer = await guest(`Viewer-${randomUUID().slice(0, 6)}`);
    const accept = await app.inject({
      method: "POST", url: "/api/pit-invitations/accept", headers: auth(viewer.sessionToken, randomUUID()),
      payload: { token: invite.json().token }
    });
    assert.equal(accept.statusCode, 200);
    assert.equal(accept.json().role, "viewer");

    const viewerWrite = await app.inject({
      method: "POST", url: `/api/pits/${pitId}/live-set/items`, headers: auth(viewer.sessionToken, randomUUID()),
      payload: { trackId: "00000000-0000-4000-8000-00000000000c", expectedRevision: 1 }
    });
    assert.equal(viewerWrite.statusCode, 403);

    const outbox = await pool.query("SELECT COUNT(*)::int AS count FROM event_outbox WHERE channel = $1", [`pit:${pitId}`]);
    assert.ok(outbox.rows[0].count >= 3, "Pit creation and membership events should be committed to the outbox");
  } finally {
    await app.close();
    await pool.end();
  }
});
