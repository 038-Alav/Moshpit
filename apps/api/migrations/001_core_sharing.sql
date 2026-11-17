CREATE TABLE IF NOT EXISTS identities (
  id UUID PRIMARY KEY,
  display_name VARCHAR(40) NOT NULL,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('guest', 'account')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_sessions (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS identity_sessions_identity_idx ON identity_sessions(identity_id);
CREATE INDEX IF NOT EXISTS identity_sessions_expiry_idx ON identity_sessions(expires_at) WHERE revoked_at IS NULL;

-- Only tracks referenced by Moshpit-owned Setlists/Live Sets are stored here.
-- The table is not a mirror of any provider's catalogue.
CREATE TABLE IF NOT EXISTS canonical_tracks (
  id UUID PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  artist VARCHAR(300),
  album VARCHAR(300),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_mappings (
  id UUID PRIMARY KEY,
  canonical_track_id UUID NOT NULL REFERENCES canonical_tracks(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_track_id TEXT NOT NULL,
  external_url TEXT,
  match_method TEXT,
  confidence NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_track_id),
  UNIQUE(canonical_track_id, provider, provider_track_id)
);
CREATE INDEX IF NOT EXISTS provider_mappings_track_idx ON provider_mappings(canonical_track_id);

CREATE TABLE IF NOT EXISTS setlists (
  id UUID PRIMARY KEY,
  owner_identity_id UUID NOT NULL REFERENCES identities(id),
  name VARCHAR(80) NOT NULL,
  description VARCHAR(500),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS setlists_owner_updated_idx ON setlists(owner_identity_id, updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS setlist_items (
  id UUID PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  canonical_track_id UUID NOT NULL REFERENCES canonical_tracks(id),
  position INTEGER NOT NULL CHECK (position >= 0),
  added_by_identity_id UUID NOT NULL REFERENCES identities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(setlist_id, position)
);
CREATE INDEX IF NOT EXISTS setlist_items_setlist_position_idx ON setlist_items(setlist_id, position);

CREATE TABLE IF NOT EXISTS pits (
  id UUID PRIMARY KEY,
  created_by_identity_id UUID NOT NULL REFERENCES identities(id),
  name VARCHAR(80) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  source_setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pits_creator_created_idx ON pits(created_by_identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pit_memberships (
  pit_id UUID NOT NULL REFERENCES pits(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'crowd', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(pit_id, identity_id)
);
CREATE INDEX IF NOT EXISTS pit_memberships_identity_idx ON pit_memberships(identity_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS pit_invitations (
  id UUID PRIMARY KEY,
  pit_id UUID NOT NULL REFERENCES pits(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('crowd', 'viewer')),
  created_by_identity_id UUID NOT NULL REFERENCES identities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_identity_id UUID REFERENCES identities(id)
);
CREATE INDEX IF NOT EXISTS pit_invitations_pit_idx ON pit_invitations(pit_id);

CREATE TABLE IF NOT EXISTS live_sets (
  id UUID PRIMARY KEY,
  pit_id UUID NOT NULL UNIQUE REFERENCES pits(id) ON DELETE CASCADE,
  source_setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  source_setlist_revision INTEGER,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Required as the referenced key for playback_sessions(live_set_id, pit_id).
  -- PostgreSQL needs a unique key matching the complete referenced column list.
  UNIQUE (id, pit_id)
);

CREATE TABLE IF NOT EXISTS live_set_items (
  id UUID PRIMARY KEY,
  live_set_id UUID NOT NULL REFERENCES live_sets(id) ON DELETE CASCADE,
  canonical_track_id UUID NOT NULL REFERENCES canonical_tracks(id),
  source_setlist_item_id UUID,
  position INTEGER NOT NULL CHECK (position >= 0),
  added_by_identity_id UUID NOT NULL REFERENCES identities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(live_set_id, position),
  UNIQUE(id, live_set_id)
);
CREATE INDEX IF NOT EXISTS live_set_items_live_set_position_idx ON live_set_items(live_set_id, position);

CREATE TABLE IF NOT EXISTS playback_sessions (
  id UUID PRIMARY KEY,
  pit_id UUID NOT NULL UNIQUE REFERENCES pits(id) ON DELETE CASCADE,
  live_set_id UUID NOT NULL,
  FOREIGN KEY (live_set_id, pit_id) REFERENCES live_sets(id, pit_id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'individual' CHECK (mode IN ('individual', 'stage')),
  desired_state TEXT NOT NULL DEFAULT 'paused' CHECK (desired_state IN ('playing', 'paused')),
  current_live_set_item_id UUID,
  FOREIGN KEY (current_live_set_item_id, live_set_id)
    REFERENCES live_set_items(id, live_set_id) ON DELETE SET NULL (current_live_set_item_id),
  position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) NOT NULL,
  command_name VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(identity_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idempotency_records_created_idx ON idempotency_records(created_at);

CREATE TABLE IF NOT EXISTS event_outbox (
  event_id UUID PRIMARY KEY,
  channel VARCHAR(255) NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_revision INTEGER NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS event_outbox_pending_idx ON event_outbox(next_attempt_at, occurred_at)
  WHERE published_at IS NULL;

-- Small, deterministic fixtures for D1. These are canonical references, not a
-- provider catalogue and not a device-local library import.
INSERT INTO canonical_tracks (id, title, artist, album, duration_ms, metadata)
VALUES
  ('00000000-0000-4000-8000-00000000000a', 'Test Track A', 'Moshpit Demo', 'Foundation', 180000, '{"kind":"demo_fixture"}'),
  ('00000000-0000-4000-8000-00000000000b', 'Test Track B', 'Moshpit Demo', 'Foundation', 195000, '{"kind":"demo_fixture"}'),
  ('00000000-0000-4000-8000-00000000000c', 'Test Track C', 'Moshpit Demo', 'Foundation', 210000, '{"kind":"demo_fixture"}')
ON CONFLICT (id) DO NOTHING;
