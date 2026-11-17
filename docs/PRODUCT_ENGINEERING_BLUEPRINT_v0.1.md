# Moshpit v0.1 — Product & Engineering Blueprint

**Status:** Working baseline for Phase 1 / Demo 1  
**Version:** 0.1-draft  
**Product direction:** Sharing-first; Setlists, Pits and Live Sets are first-class domain concepts.

## 1. Product definition

Moshpit is a collaborative music platform. People discover and organize music in Moshpit-owned Setlists, share that music inside Pits, and collaboratively shape a Live Set that powers the session's listening experience.

The product must not require a pre-existing Spotify, YouTube or YouTube Music library or playlist before someone can participate. External services are content discovery, metadata and playback sources—not the owner of Moshpit's social graph, Setlists or session state.

### Core concepts

- **Setlist:** persistent, Moshpit-owned collection of track references. It can be private or shared according to its own permissions. It exists independently of any Pit.
- **Pit:** social context in which participants gather, receive roles and share a music experience. Ended Pits remain in history.
- **Live Set:** active, collaborative track selection for a Pit. It is not the source Setlist and does not mutate it implicitly.
- **PlaybackSession:** authoritative shared playback intent/state for a Pit's Live Set. It is not an audio player.
- **PlaybackEndpoint:** a participant/device's independent local execution state. Endpoint failures must not interrupt other endpoints or rewrite shared current-track state.

### Primary product journey

1. A person creates a Setlist directly in Moshpit, including by adding tracks found through Moshpit search when provider integrations are available.
2. The person creates a Pit from that Setlist, or starts with an empty Pit.
3. Moshpit creates an independent Live Set using a snapshot/copy of the selected Setlist's items.
4. Pit members contribute to the Live Set according to Pit permissions.
5. Playback is coordinated through a PlaybackSession and one or more PlaybackEndpoints.
6. When the Pit ends, its final Live Set and session history are retained. The user may later create a new Setlist from that material.

## 2. Music data and library scale

### Decision

**Moshpit will not ingest or mirror the complete catalogs of external music providers.** Provider catalogs can be enormous, change frequently and have provider-specific licensing, availability and API constraints.

PostgreSQL stores Moshpit-owned objects and the subset of music metadata needed by those objects:

- Setlists and their ordered items;
- Live Sets and their ordered items;
- CanonicalTrack records referenced by those items;
- ProviderMappings discovered or verified for those tracks;
- limited, expiring search/metadata cache where permitted and useful.

Search is federated/on-demand through provider adapters. Search results are transient until a user selects a result or Moshpit otherwise needs to retain a canonical reference. Cache policy, retention and provider terms must be adapter-specific. Never scrape or bulk-copy a provider catalog by default.

### Local device libraries

Local device data is **not** the canonical seed or source of truth for a Setlist or Live Set. Moshpit must not silently scan a device library or require one to exist.

A future explicitly authorized local-library/import adapter may let a user select local tracks and import references into a Moshpit Setlist. A device may also cache user-authorized data for performance/offline UX. Such local data is not authoritative and must reconcile with server state. Local-file playback is a separate capability and must not be assumed for web clients.

### Seeding a Live Set from a Setlist

Creating a Pit from a Setlist creates a new Live Set and copies its ordered track references (CanonicalTrack IDs plus relevant source/provenance metadata) in one server-side operation. The Live Set records the originating Setlist ID and source revision for provenance. After creation:

- edits to the Live Set do not mutate the Setlist;
- edits to the Setlist do not silently rewrite an existing Live Set;
- later refresh/replace operations, if introduced, must be explicit commands with authorization and a defined conflict policy.

## 3. Domain contracts (conceptual baseline)

The following is the initial domain shape. Exact runtime schemas, constraints and command payloads are to be implemented and tested in the owning modules.

### Setlist

- `id: UUID`
- `ownerIdentityId: UUID`
- `name: string`
- `description?: string`
- `visibility: private | unlisted | shared` (proposed; final sharing semantics require an ADR)
- `revision: integer`
- `createdAt`, `updatedAt`
- optional `archivedAt`

Setlist ownership and collaborator permissions are independent of Pit membership and Pit roles.

### SetlistItem

- `id: UUID`
- `setlistId: UUID`
- `canonicalTrackId: UUID`
- `position` (stable ordering key or integer position governed by aggregate revision)
- `addedByIdentityId: UUID`
- `addedAt`
- optional user-authored note

A SetlistItem references a CanonicalTrack; it does not duplicate provider-specific IDs as its identity.

### CanonicalTrack

- `id: UUID`
- normalized core metadata: title, artists, optional album, duration and release information
- optional ISRC and other external identifiers
- metadata provenance/confidence and timestamps

CanonicalTrack is Moshpit's logical identity for a recording/track candidate. Matching, deduplication and conflict resolution are a later music-intelligence capability; do not overclaim identity certainty in Demo 1.

### ProviderMapping

- `id: UUID`
- `canonicalTrackId: UUID`
- `provider` and provider-specific item type
- `providerItemId`
- optional region/market scope
- availability/verification metadata and timestamps

A provider mapping is a correspondence, not the identity of the song. Uniqueness constraints must account for provider, item type and any required market scope.

### LiveSet and LiveSetItem

- `LiveSet`: `id`, `pitId`, `revision`, lifecycle status, `seededFromSetlistId?`, `seededFromSetlistRevision?`, timestamps.
- `LiveSetItem`: `id`, `liveSetId`, `canonicalTrackId`, ordering key, `addedByIdentityId`, timestamp, optional `sourceSetlistItemId`.

A Pit has one active Live Set in the initial product model unless a later explicit product decision introduces multiple sets per Pit.

### Pit and PlaybackSession

Pit owns its lifecycle, memberships and roles. Live Set is a distinct domain aggregate/module associated with the Pit. PlaybackSession is associated with the Pit and its active Live Set; it stores shared playback intent and revision, not endpoint-specific player state.

### Identity and permissions

- Internal IDs are UUIDs and do not depend on provider IDs or device IDs.
- Pit roles (`admin`, `crowd`, `viewer`) govern Pit/session participation only.
- Setlist owner/collaborator permissions govern persistent Setlist operations only.
- The server derives identity from the authenticated session; clients cannot nominate another identity in commands.

## 4. Architecture baseline

- TypeScript monorepo using pnpm workspaces.
- Node.js 24 and Fastify modular monolith.
- React + TypeScript web client; Vite is current tooling, not a product constraint.
- PostgreSQL is the source of truth.
- Centrifugo is an independent realtime transport process, not a domain microservice or source of truth.
- State-changing commands use HTTP to Fastify.
- Fastify authorizes and validates commands, commits domain changes and outbox records in one PostgreSQL transaction, then an outbox dispatcher publishes committed events to Centrifugo.
- Client direct publication to authoritative Pit channels remains disabled.
- Clients recover through HTTP snapshots and revision-aware event processing.
- Docker/Podman are optional runtime/packaging choices. Native Windows development remains supported.

### Proposed module ownership

- `identity`: guest/account identity and authenticated session boundary.
- `setlists`: Setlist aggregate, SetlistItem, ownership and collaborator authorization.
- `pits`: Pit lifecycle, membership, Pit roles and Pit-specific policy.
- `live-sets`: LiveSet aggregate, LiveSetItem and collaboration commands.
- `playback`: PlaybackSession and PlaybackEndpoint contracts/coordinator.
- `music-catalog` (later): CanonicalTrack, ProviderMapping, provider search and matching.
- `realtime`: event envelope, outbox dispatch port and Centrifugo adapter.
- `shared`: technical infrastructure only; no domain rules.

Modules communicate through application interfaces and explicit contracts. Avoid cross-module repository mutation and avoid putting all domain behavior in a single Pit service.

## 5. Consistency, commands and events

- PostgreSQL transactions protect aggregate state and related outbox records.
- Aggregate revisions support optimistic concurrency (`expectedRevision`).
- Idempotency keys protect retryable commands from duplicate effects.
- Realtime events are emitted only after commit via the transactional outbox.
- Event envelopes include `eventId`, `schemaVersion`, `eventType`, `aggregateType`, `aggregateId`, `aggregateRevision`, `occurredAt` and payload.
- Clients deduplicate by event ID and detect revision gaps; snapshots are fetched over HTTP.
- Reordering items must be atomic and revisioned. Define deterministic ordering and conflict behavior in the Setlist/Live Set module contracts.

## 6. Roadmap: product phases

### Phase 0 — Product Discovery & Architecture

Product definition, reference audit, domain model, architecture contracts, demo plan and acceptance criteria. This Blueprint consolidates the working baseline; the ZIP audit and any remaining open decisions are tracked separately.

### Phase 1 — Core Sharing Experience

Identity; persistent Setlists and ownership; Pit creation and invitations; memberships and roles; Live Sets seeded from Setlists or created empty; collaborative Live Set editing; persistence and realtime. Sharing in this first experience primarily happens through Pits and their Live Sets. Setlist collaborator access is intentionally introduced later (D5), while the Setlist aggregate and its ownership/persistence exist from D1. This is the first product experience, not a later playlist add-on.

### Phase 2 — Playback Foundation

Playback contracts, coordinator, independent endpoints and provider-neutral playback abstractions. D2 establishes `PlaybackEndpoint` as one identity/runtime's local execution state, separates it from shared `PlaybackSession`, defines provider-adapter and endpoint-driver ports, persists endpoint-local reports, and adds deterministic Individual Playback planning. It does not yet execute audio, dispatch directives, implement real provider adapters or Stage Playback.

### Phase 3 — Playback Coordination & Resilience

Dispatching coordinator directives to real endpoint drivers; provider-specific track resolution; prepared-endpoint start coordination; reconciliation, snapshots, late joiners, reconnect, manual navigation, endpoint retry/recovery, clock coordination and drift handling. D2's deterministic planner and endpoint-state persistence are foundations only; they do not dispatch or execute audio.

### Phase 4 — Collaboration & Social Experience

Collaborative Setlist editing, voting, richer contribution/moderation rules, Pit History, re-invitation and presence/Admin succession.

### Phase 5 — Stage Playback

Boss device, centralized output and remote controls, without implying audio retransmission to every participant.

### Phase 6 — Music Intelligence & Provider Ecosystem

CanonicalTrack matching, ProviderMappings, federated provider search, metadata/availability, real adapters, import/export and external synchronization. Spotify, YouTube and YouTube Music are distinct integrations with distinct capabilities and constraints.

### Phase 7 — Productization & Universal Platform

Web, mobile, desktop and potential automotive experiences; security, accessibility, observability, scale, distribution and release engineering.

## 7. Eight demos toward v0.1

1. **D1 Core Sharing Foundation:** guest identity; minimal persistent Setlist; create Pit from Setlist or empty; membership and Admin/Crowd/Viewer; independent Live Set; test tracks A/B/C; persistent PlaybackSession; PostgreSQL; HTTP commands; realtime events via outbox; revision/idempotency; snapshots and two-client validation. No real audio, real provider adapters, voting or clock synchronization.
2. **D2 Playback Foundation:** provider-neutral playback contracts, PlaybackEndpoint persistence/reporting, endpoint-driver/provider-adapter ports and deterministic non-dispatching Individual Playback plans.
3. **D3 Playback Coordinator:** Dispatch the shared intent to endpoint drivers, resolve provider targets for each endpoint, isolate provider/catalog/resolution/playback failures, and implement independent retry/recovery while preserving the shared session.
4. **D4 Resilience & Navigation:** reconnect, snapshots, late joiners, recovery and manual navigation.
5. **D5 Voting & Collaboration:** voting, richer collaboration, Setlist permissions and contribution rules.
6. **D6 Stage Playback:** Boss device and remote controls, initially using a test provider.
7. **D7 Music Providers:** CanonicalTrack, ProviderMappings, federated search, identification, metadata and real adapters where supported.
8. **D8 Product Integration & Release:** integrated UX, security, persistence, E2E, provider capability validation and v0.1 release.

The demos are incremental deliverables and do not map one-to-one to the seven product phases.

## 8. D1 acceptance criteria

- A guest can create/recover an identity under the selected session policy.
- An identity can create a Setlist and add/reorder/remove test tracks.
- A user can create a Pit from a Setlist or create an empty Pit.
- Creating a Pit from a Setlist copies the current ordered items into an independent Live Set and records source provenance.
- Mutating either object does not implicitly mutate the other.
- Pit memberships and Admin/Crowd/Viewer permissions are enforced server-side; Viewer is read-only.
- Authorized members see Live Set changes in another client through realtime events.
- PlaybackSession persists as shared Pit state; no actual audio playback is required.
- Commands support idempotency and optimistic concurrency where applicable.
- Domain writes and outbox events commit atomically; events publish only after commit.
- Reconnect/snapshot recovery restores an authoritative revision.
- Integration tests cover persistence, authorization, concurrency, outbox and two-client event flow.

## 9. Explicit non-goals for D1

- Bulk import or mirroring of provider catalogs.
- Real provider search or playback adapters.
- Local-device library scanning or automatic local seeding.
- Audio playback, clock synchronization or drift correction.
- Voting, advanced moderation or Stage Playback.
- Admin succession until PresenceLease policy is validated and implemented as its own tested contract.

## 10. Open decisions to resolve before their implementation

1. Setlist visibility model and exact collaborator roles/invitation semantics.
2. Whether Setlist deletion is hard delete, archive or tombstone, and how references from historical Live Sets behave.
3. Exact ordering strategy and conflict policy for concurrent reorder operations.
4. Guest identity recovery/session persistence and account-linking migration.
5. Whether a Pit may eventually contain multiple Live Sets; initial assumption is one active Live Set.
6. PlaybackSession exact fields and lifecycle; it belongs to Pit/active Live Set, not directly to a persistent Setlist.
7. Presence heartbeat/TTL values remain proposals until tested and approved.
8. Migration tool/strategy and runtime validation library remain unselected.
9. Provider-specific cache retention, market scoping and licensing constraints must be decided per adapter.

## 11. Reference strategy

- **CoJam:** learn shared-session authority, queue collaboration and realtime patterns; do not copy its product identity or assume its room queue is a persistent Setlist.
- **Trackhop:** learn adapter boundaries, external library import/synchronization; review AGPL-3.0-only implications before any code reuse.
- **SongMirror:** learn matching, reconciliation and identity correspondence; review its MIT license and implementation independently.
- **Metrolist / metroserver:** learn client playback and listen-together coordination/recovery patterns.
- **SuvMusic:** learn local playback architecture and separation of player responsibilities; local device libraries remain optional, never required for Moshpit participation.
- **YouTube Music V2:** reference for desktop/plugin integration patterns only; non-official integration approaches require separate policy, reliability and licensing review.

References inform engineering choices; Moshpit's domain model, contracts, UX and implementation remain its own.

## 12. Change control

This document is the working baseline for v0.1. A change to product semantics, aggregate ownership, persistence authority, playback responsibilities or demo scope must be recorded in `docs/decisions.md` with rationale, impact and migration implications. Proposals are not treated as approved decisions until explicitly accepted.

## 13. Phase 1 implementation checkpoint (2026-11-16)

The first D1 vertical slice has been added to the repository: guest identity, private Setlists and item commands, Pit creation from a Setlist or empty, one-use Crowd/Viewer invitations, an independent Live Set snapshot, persisted paused PlaybackSession, revision/idempotency handling, SQL migrations, transactional outbox and Centrifugo token/publication plumbing, plus the initial React workflow.

This is **not** a claim that D1 is complete. The implementation checkpoint adds a transactional repeatable-read snapshot, complete Setlist/Live Set reorder commands, aggregate-local revisions, and database constraints that bind a PlaybackSession to the Live Set and current item belonging to its own Pit. The environment used to prepare the code did not have the project dependencies or a PostgreSQL service available. Node.js 24 / pnpm 10.34.9 typecheck, tests, build, PostgreSQL migrations and two-browser Centrifugo delivery still need to be verified on the target Windows development environment or CI. The exact current checkpoint and remaining verification are tracked in `docs/phase1-implementation-status.md`.

For D1 specifically, the following working decisions are now explicit rather than blockers: Setlists are private and owner-managed; Setlist collaboration/sharing permissions are deferred to D5; one Live Set belongs to each Pit; Pit invitation links are one-use, expire after seven days and grant either Crowd or Viewer; reorder commands require a complete item-ID permutation and `expectedRevision`. Broader product policy (public/unlisted Setlists, collaborator roles, deletion/archive semantics and account recovery) remains open for the appropriate later milestone.
