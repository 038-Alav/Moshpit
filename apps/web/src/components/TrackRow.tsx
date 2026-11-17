import type { SetlistItem, TestTrack } from "../types";
import { Artwork } from "./Artwork";
import { Icon } from "./Icon";

export function formatDuration(value: number | null | undefined) {
  if (!value) return "—";
  return `${Math.floor(value / 60000)}:${String(Math.floor((value % 60000) / 1000)).padStart(2, "0")}`;
}

export function TrackRow({ track, index, variant = "default", canEdit = false, busy = false, onMove, onRemove, onAdd }: {
  track: SetlistItem | TestTrack;
  index?: number;
  variant?: "default" | "compact" | "search";
  canEdit?: boolean;
  busy?: boolean;
  onMove?: (direction: -1 | 1) => void;
  onRemove?: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className={`track-row track-row-${variant}`}>
      {index !== undefined && <span className="track-position">{String(index + 1).padStart(2, "0")}</span>}
      <Artwork seed={(index ?? track.title.length) + track.title.charCodeAt(0)} size="small"/>
      <div className="track-info"><strong>{track.title}</strong><span>{track.artist ?? "Artista desconocido"}{track.album ? ` · ${track.album}` : ""}</span></div>
      {variant === "search" && <span className="test-track-tag">DEMO</span>}
      <span className="track-duration">{formatDuration(track.durationMs)}</span>
      {canEdit && (
        <div className="track-row-actions">
          {onMove && <>
            <button className="icon-button icon-button-xs icon-button-quiet" onClick={() => onMove(-1)} disabled={busy} aria-label={`Mover ${track.title} arriba`}><Icon name="arrow-up" size={15}/></button>
            <button className="icon-button icon-button-xs icon-button-quiet" onClick={() => onMove(1)} disabled={busy} aria-label={`Mover ${track.title} abajo`}><Icon name="arrow-down" size={15}/></button>
          </>}
          {onRemove && <button className="icon-button icon-button-xs icon-button-quiet destructive-hover" onClick={onRemove} disabled={busy} aria-label={`Quitar ${track.title}`}><Icon name="trash" size={15}/></button>}
        </div>
      )}
      {onAdd && <button className="add-track-action" onClick={onAdd} disabled={busy}><Icon name="plus" size={16}/><span>Agregar</span></button>}
    </div>
  );
}
