export type Identity = { id: string; displayName: string; identityType: "guest" | "account" };

export type Track = {
  id?: string;
  canonicalTrackId?: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
};

export type TestTrack = Track & { id: string };
export type SetlistItem = Track & { itemId: string; position: number; sourceSetlistItemId?: string | null };
export type Setlist = {
  id: string;
  name: string;
  description: string | null;
  visibility?: string;
  revision: number;
  trackCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PitRole = "admin" | "crowd" | "viewer";
export type PitSummary = {
  id: string;
  name: string;
  status: "active" | "ended";
  role: PitRole;
  liveSetId: string;
  liveSetRevision: number;
  createdAt?: string;
};

export type PitSnapshot = {
  revision?: number;
  pit: {
    id: string;
    name: string;
    status: "active" | "ended";
    revision: number;
    sourceSetlistId: string | null;
    createdAt?: string;
    endedAt?: string | null;
  };
  membership: { role: PitRole };
  members: Array<{ identityId: string; displayName: string; role: PitRole; joinedAt?: string }>;
  liveSet: {
    id: string;
    revision: number;
    sourceSetlistId: string | null;
    sourceSetlistRevision: number | null;
    items: SetlistItem[];
  };
  playbackSession: {
    id: string;
    mode: string;
    desiredState: string;
    currentLiveSetItemId?: string | null;
    positionMs?: number;
    revision: number;
  };
};

export type ApiError = { error?: { message?: string; details?: { currentRevision?: number } } };
export type Page = "home" | "explore" | "setlists" | "setlist-detail" | "pits" | "pit-room" | "profile" | "join";
