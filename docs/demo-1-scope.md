# Demo 1 — Core Sharing Foundation

## Objective

Deliver the first real Moshpit journey: persistent Moshpit Setlist → Pit → independent collaborative Live Set. The demos extend this same codebase; they are not disposable prototypes.

## Implemented in the first vertical slice

1. Guest identity and hashed bearer session.
2. Private Setlists: create, list, retrieve, rename/describe, add/remove/reorder fixture track references.
3. Create a Pit from a Setlist or empty.
4. Creating from a Setlist copies its ordered items and captures source Setlist ID/revision.
5. Pit membership, one-use invitations, and Admin/Crowd/Viewer authorization.
6. Live Set: add/remove/reorder fixture tracks. Viewer is read-only.
7. Persisted PlaybackSession attached to Pit and Live Set, initialized paused.
8. PostgreSQL schema migrations and transactional repositories/operations using `pg`.
9. HTTP commands with idempotency and optimistic concurrency.
10. Transactional outbox, retrying dispatcher, and post-commit Centrifugo publishing.
11. HTTP snapshot endpoint and private connection/subscription JWT endpoints.
12. Web UI for the first journey and joining a Pit.
13. Unit/API tests and optional PostgreSQL integration test.

## D1 acceptance items still requiring target-environment verification or follow-up

- Run typecheck, test, build on Node.js 24 / pnpm 10.34.9.
- Apply migrations against PostgreSQL 17 on Windows.
- Validate realtime delivery with two browser clients through Centrifugo 6.10.3.
- Validate reconnect, snapshot refresh and revision-gap recovery.
- Add concurrent-command stress tests and verify idempotency under competing requests.

## Out of scope

- Bulk import/mirroring of provider catalogs.
- Real federated provider search, Spotify/YouTube/YouTube Music adapters.
- Automatic local-device library scanning or local seeding.
- Actual audio playback, clock synchronization or drift correction.
- Voting, Stage Playback, advanced Setlist collaboration and PresenceLease/Admin succession.

## Independence rule

A Live Set created from a Setlist is a snapshot. Later edits to either aggregate do not mutate the other automatically.
