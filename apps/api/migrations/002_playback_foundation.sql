-- D2 Playback Foundation.
-- Each endpoint is one identity + runtime executing locally for a Pit's
-- shared PlaybackSession. Endpoint-local failures never change session state.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'playback_sessions_id_pit_live_set_unique'
      AND conrelid = 'playback_sessions'::regclass
  ) THEN
    ALTER TABLE playback_sessions
      ADD CONSTRAINT playback_sessions_id_pit_live_set_unique
      UNIQUE (id, pit_id, live_set_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS playback_endpoints (
  id UUID PRIMARY KEY,
  pit_id UUID NOT NULL,
  playback_session_id UUID NOT NULL,
  live_set_id UUID NOT NULL,
  identity_id UUID NOT NULL,
  client_instance_id UUID NOT NULL,
  provider_key VARCHAR(80),
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'resolving', 'ready', 'playing', 'paused', 'unavailable', 'error')),
  capabilities JSONB NOT NULL DEFAULT '{"canPlay":false,"canPause":false,"canSeek":false,"canStop":false,"canPrepare":false,"canReportPosition":false}'::jsonb
    CHECK (jsonb_typeof(capabilities) = 'object'),
  current_live_set_item_id UUID,
  position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
  failure_code TEXT
    CHECK (failure_code IS NULL OR failure_code IN (
      'provider_unavailable', 'track_unavailable', 'resolution_failed',
      'playback_failed', 'authorization_required', 'unsupported_operation', 'unknown'
    )),
  failure_message VARCHAR(300),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (playback_session_id, pit_id, live_set_id)
    REFERENCES playback_sessions(id, pit_id, live_set_id) ON DELETE CASCADE,
  FOREIGN KEY (pit_id, identity_id)
    REFERENCES pit_memberships(pit_id, identity_id) ON DELETE CASCADE,
  FOREIGN KEY (current_live_set_item_id, live_set_id)
    REFERENCES live_set_items(id, live_set_id) ON DELETE SET NULL (current_live_set_item_id),
  UNIQUE (playback_session_id, identity_id, client_instance_id),
  CHECK (
    (status IN ('unavailable', 'error') AND failure_code IS NOT NULL)
    OR (status NOT IN ('unavailable', 'error') AND failure_code IS NULL AND failure_message IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS playback_endpoints_pit_status_idx
  ON playback_endpoints(pit_id, status, last_reported_at DESC);
CREATE INDEX IF NOT EXISTS playback_endpoints_identity_idx
  ON playback_endpoints(identity_id, last_reported_at DESC);
