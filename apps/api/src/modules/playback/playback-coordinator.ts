import type {
  PlaybackEndpoint,
  PlaybackPlan,
  PlaybackSession
} from "@moshpit/contracts";

/**
 * Builds endpoint-specific directives from shared playback intent.
 * It deliberately does not execute adapters or mutate PlaybackSession; dispatch,
 * retries, preparation barriers and timing coordination belong to later demos.
 */
export class PlaybackCoordinator {
  plan(session: PlaybackSession, endpoints: PlaybackEndpoint[]): PlaybackPlan {
    const plan: PlaybackPlan = {
      playbackSessionId: session.id,
      playbackSessionRevision: session.revision,
      mode: session.mode,
      directives: [],
      skipped: []
    };

    for (const endpoint of endpoints) {
      const skip = (reason: PlaybackPlan["skipped"][number]["reason"]) => {
        plan.skipped.push({ endpointId: endpoint.id, reason });
      };

      if (endpoint.playbackSessionId !== session.id || endpoint.pitId !== session.pitId || endpoint.liveSetId !== session.liveSetId) {
        skip("endpoint_session_mismatch");
        continue;
      }
      if (session.mode !== "individual") {
        skip("stage_mode_not_supported");
        continue;
      }
      if (endpoint.status === "unavailable") {
        skip("endpoint_unavailable");
        continue;
      }
      if (endpoint.status === "error") {
        skip("endpoint_error");
        continue;
      }
      if (!session.currentLiveSetItemId) {
        skip("no_current_item");
        continue;
      }
      if (endpoint.status === "resolving") {
        skip("endpoint_busy");
        continue;
      }

      if (session.desiredState === "playing") {
        if (endpoint.status === "playing" && endpoint.currentLiveSetItemId === session.currentLiveSetItemId) {
          skip("already_in_target_state");
          continue;
        }
        if (!endpoint.capabilities.canPlay) {
          skip("operation_unsupported");
          continue;
        }
        plan.directives.push({
          endpointId: endpoint.id,
          action: "play",
          liveSetItemId: session.currentLiveSetItemId,
          positionMs: session.positionMs,
          playbackSessionRevision: session.revision
        });
        continue;
      }

      if (endpoint.status !== "playing") {
        skip("already_in_target_state");
        continue;
      }
      if (!endpoint.capabilities.canPause) {
        skip("operation_unsupported");
        continue;
      }
      plan.directives.push({
        endpointId: endpoint.id,
        action: "pause",
        liveSetItemId: session.currentLiveSetItemId,
        positionMs: session.positionMs,
        playbackSessionRevision: session.revision
      });
    }

    return plan;
  }
}
