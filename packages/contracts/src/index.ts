export type IdentityType = "guest" | "account";
export type IdentityStatus = "active" | "deleted";

export interface MoshpitIdentity {
  id: string;
  displayName: string;
  identityType: IdentityType;
  status: IdentityStatus;
  createdAt: string;
}

export type SetlistVisibility = "private";

export interface Setlist {
  id: string;
  ownerIdentityId: string;
  name: string;
  description: string | null;
  visibility: SetlistVisibility;
  revision: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface CanonicalTrack {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
}

export interface ProviderMapping {
  id: string;
  canonicalTrackId: string;
  provider: string;
  providerTrackId: string;
  externalUrl: string | null;
  matchMethod: string | null;
  confidence: number | null;
  verifiedAt: string | null;
}

export interface SetlistItem {
  id: string;
  setlistId: string;
  canonicalTrackId: string;
  position: number;
  addedByIdentityId: string;
  createdAt: string;
}

export type PitRole = "admin" | "crowd" | "viewer";
export type PitStatus = "active" | "ended";

export interface PitMembership {
  pitId: string;
  identityId: string;
  role: PitRole;
  joinedAt: string;
}

export interface Pit {
  id: string;
  createdByIdentityId: string;
  name: string;
  status: PitStatus;
  sourceSetlistId: string | null;
  revision: number;
  createdAt: string;
  endedAt: string | null;
}

export interface LiveSet {
  id: string;
  pitId: string;
  sourceSetlistId: string | null;
  sourceSetlistRevision: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveSetItem {
  id: string;
  liveSetId: string;
  canonicalTrackId: string;
  sourceSetlistItemId: string | null;
  position: number;
  addedByIdentityId: string;
  createdAt: string;
}

export interface PresenceLease {
  id: string;
  pitId: string;
  identityId: string;
  clientInstanceId: string;
  createdAt: string;
  lastHeartbeatAt: string;
  expiresAt: string;
  releasedAt: string | null;
}

// Proposal only. This policy is not implemented or approved for D1.
export const PRESENCE_POLICY_PROPOSAL = {
  heartbeatIntervalMs: 15_000,
  leaseTtlMs: 45_000,
  adminSuccessionGraceMs: 180_000
} as const;

export type PlaybackMode = "individual" | "stage";
export type PlaybackDesiredState = "playing" | "paused";

/** Shared, server-authoritative playback intent for one Pit / Live Set. */
export interface PlaybackSession {
  id: string;
  pitId: string;
  liveSetId: string;
  mode: PlaybackMode;
  desiredState: PlaybackDesiredState;
  currentLiveSetItemId: string | null;
  positionMs: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Effective capabilities reported by a concrete device/provider combination.
 * They are routing hints, not an authorization boundary; server-side adapters
 * must still verify their own capabilities before executing a command.
 */
export interface PlaybackCapabilities {
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  canStop: boolean;
  canPrepare: boolean;
  canReportPosition: boolean;
}

export type PlaybackEndpointStatus =
  | "idle"
  | "resolving"
  | "ready"
  | "playing"
  | "paused"
  | "unavailable"
  | "error";

export type PlaybackEndpointFailureCode =
  | "provider_unavailable"
  | "track_unavailable"
  | "resolution_failed"
  | "playback_failed"
  | "authorization_required"
  | "unsupported_operation"
  | "unknown";

/** Local execution state for one identity + client runtime in a Pit. */
export interface PlaybackEndpoint {
  id: string;
  pitId: string;
  playbackSessionId: string;
  liveSetId: string;
  identityId: string;
  clientInstanceId: string;
  providerKey: string | null;
  status: PlaybackEndpointStatus;
  capabilities: PlaybackCapabilities;
  currentLiveSetItemId: string | null;
  positionMs: number;
  failureCode: PlaybackEndpointFailureCode | null;
  failureMessage: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastReportedAt: string;
}

export interface PlaybackEndpointRegistration {
  clientInstanceId: string;
  providerKey: string | null;
  capabilities: PlaybackCapabilities;
}

/** Full state report. The endpoint revision protects concurrent local reports. */
export interface PlaybackEndpointStateReport {
  status: PlaybackEndpointStatus;
  currentLiveSetItemId: string | null;
  positionMs: number;
  failureCode: PlaybackEndpointFailureCode | null;
  failureMessage: string | null;
  expectedRevision: number;
}

export type PlaybackEndpointCommandAction = "play" | "pause";
export type PlaybackPlanSkipReason =
  | "stage_mode_not_supported"
  | "endpoint_unavailable"
  | "endpoint_error"
  | "no_current_item"
  | "endpoint_busy"
  | "already_in_target_state"
  | "operation_unsupported"
  | "endpoint_session_mismatch";

export interface PlaybackEndpointDirective {
  endpointId: string;
  action: PlaybackEndpointCommandAction;
  liveSetItemId: string;
  positionMs: number;
  playbackSessionRevision: number;
}

export interface PlaybackEndpointPlanSkip {
  endpointId: string;
  reason: PlaybackPlanSkipReason;
}

export interface PlaybackPlan {
  playbackSessionId: string;
  playbackSessionRevision: number;
  mode: PlaybackMode;
  directives: PlaybackEndpointDirective[];
  skipped: PlaybackEndpointPlanSkip[];
}

/** Provider-side catalog/resolution contract; no real adapters ship in D2. */
export interface PlaybackProviderDescriptor {
  providerKey: string;
  displayName: string;
  capabilities: PlaybackCapabilities;
}

export interface PlaybackTrackResolutionRequest {
  canonicalTrackId: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
  preferredProviderTrackId?: string;
}

export type PlaybackTrackResolution =
  | {
      status: "resolved";
      providerKey: string;
      providerTrackId: string;
      canonicalTrackId: string;
      /** Opaque reference understood only by the matching endpoint driver. */
      playbackReference: string;
    }
  | {
      status: "unavailable";
      providerKey: string;
      canonicalTrackId: string;
      failureCode: PlaybackEndpointFailureCode;
      message?: string;
    };

/** Provider adapter resolves a Moshpit track reference for one provider. */
export interface PlaybackProviderAdapter {
  readonly descriptor: PlaybackProviderDescriptor;
  resolveTrack(request: PlaybackTrackResolutionRequest): Promise<PlaybackTrackResolution>;
}

/** Device-local execution port. It does not own shared session state. */
export interface PlaybackEndpointDriver {
  readonly capabilities: PlaybackCapabilities;
  prepare(resolution: PlaybackTrackResolution & { status: "resolved" }): Promise<void>;
  play(input: { positionMs: number }): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  stop(): Promise<void>;
  getPositionMs?(): Promise<number>;
}

export interface RealtimeEvent<TPayload = unknown> {
  eventId: string;
  schemaVersion: number;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateRevision: number;
  occurredAt: string;
  payload: TPayload;
}

export interface CommandMetadata {
  idempotencyKey: string;
  expectedRevision?: number;
}

export interface RealtimePublisher {
  publish<TPayload>(channel: string, event: RealtimeEvent<TPayload>): Promise<void>;
}
