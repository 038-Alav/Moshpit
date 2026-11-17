import { useState } from "react";
import type { PitSnapshot, PitRole, SetlistItem, TestTrack } from "../types";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";
import { TrackRow } from "../components/TrackRow";

export function PitRoomPage({ snapshot, tracks, busy, realtimeStatus, inviteToken, onBack, onRefresh, onAddTrack, onMoveTrack, onRemoveTrack, onCreateInvitation, onCopyInvite, onEndPit }: {
  snapshot: PitSnapshot;
  tracks: TestTrack[];
  busy: boolean;
  realtimeStatus: string;
  inviteToken: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onAddTrack: (id: string) => void;
  onMoveTrack: (item: SetlistItem, direction: -1 | 1) => void;
  onRemoveTrack: (item: SetlistItem) => void;
  onCreateInvitation: (role: "crowd" | "viewer") => void;
  onCopyInvite: () => void;
  onEndPit: () => void;
}) {
  const [mobileTab, setMobileTab] = useState<"live-set" | "crowd" | "details">("live-set");
  const canEdit = snapshot.pit.status === "active" && snapshot.membership.role !== "viewer";
  const isAdmin = snapshot.pit.status === "active" && snapshot.membership.role === "admin";
  const availableTracks = tracks.filter((track) => !snapshot.liveSet.items.some((item) => item.canonicalTrackId === track.id));
  const roleLabel = (role: PitRole) => role === "admin" ? "Admin" : role === "crowd" ? "Crowd" : "Viewer";

  return (
    <div className="page-stack pit-room-page">
      <div className="pit-room-topline"><button className="back-link" onClick={onBack}><Icon name="chevron-left" size={16}/> Todos los Pits</button><div className={`realtime-status ${realtimeStatus === "Conectado" ? "realtime-online" : realtimeStatus.includes("Reconect") || realtimeStatus.includes("Conectando") ? "realtime-pending" : ""}`}><span/> {realtimeStatus}</div></div>
      <section className="pit-room-header">
        <div className="pit-room-header-art"><Artwork seed={snapshot.pit.name.length + 9} size="large"/></div>
        <div className="pit-room-title"><div className="pit-room-status-row"><span className={`pit-state-pill ${snapshot.pit.status}`}>{snapshot.pit.status === "active" ? <><i/> PIT ACTIVO</> : "PIT FINALIZADO"}</span><span className="role-pill">{roleLabel(snapshot.membership.role)}</span></div><h1>{snapshot.pit.name}</h1><p>{snapshot.pit.status === "active" ? "La música se construye entre todos." : "Esta sesión terminó. Su Live Set quedó guardado en el historial."}</p><div className="pit-room-meta"><span><Icon name="users" size={14}/>{snapshot.members.length} {snapshot.members.length === 1 ? "miembro" : "miembros"}</span><span><Icon name="list-music" size={14}/>{snapshot.liveSet.items.length} canciones</span></div></div>
        <div className="pit-room-head-actions">{isAdmin && <button className="button button-primary" onClick={() => onCreateInvitation("crowd")}><Icon name="link" size={16}/> Invitar</button>}<button className="icon-button icon-button-quiet" onClick={onRefresh} disabled={busy} aria-label="Actualizar sesión" title="Actualizar sesión"><Icon name="refresh"/></button></div>
      </section>

      {snapshot.pit.status === "ended" && <div className="ended-banner"><Icon name="history"/><span><strong>Este Pit ya terminó.</strong> Puedes consultar su Live Set, pero ya no admite cambios ni nuevas invitaciones.</span></div>}
      {snapshot.pit.status === "active" && snapshot.membership.role === "viewer" && <div className="readonly-banner"><Icon name="eye"/><span><strong>Estás en modo lectura.</strong> Puedes seguir el Live Set y ver quién participa, pero no modificar la selección.</span></div>}

      <div className="pit-room-mobile-tabs" role="tablist" aria-label="Contenido del Pit">
        <button role="tab" aria-selected={mobileTab === "live-set"} className={mobileTab === "live-set" ? "is-selected" : ""} onClick={() => setMobileTab("live-set")}>Live Set <span>{snapshot.liveSet.items.length}</span></button>
        <button role="tab" aria-selected={mobileTab === "crowd"} className={mobileTab === "crowd" ? "is-selected" : ""} onClick={() => setMobileTab("crowd")}>Crowd <span>{snapshot.members.length}</span></button>
        <button role="tab" aria-selected={mobileTab === "details"} className={mobileTab === "details" ? "is-selected" : ""} onClick={() => setMobileTab("details")}>Detalles</button>
      </div>

      <div className="pit-room-grid">
        <section className={`pit-room-main ${mobileTab !== "live-set" ? "mobile-hidden" : ""}`}>
          <div className="playback-status-card">
            <div className="playback-status-art"><Icon name="headphones" size={24}/></div>
            <div className="playback-status-copy"><p className="eyebrow">ESTADO DE REPRODUCCIÓN</p><strong>La reproducción llegará pronto</strong><span>El Live Set ya está compartido. La reproducción real se incorpora en las próximas demos.</span></div>
            <span className="playback-state-pill">NO DISPONIBLE</span>
          </div>

          <section className="live-set-section">
            <div className="section-heading live-set-heading"><div><p className="eyebrow">LA COLA COMPARTIDA</p><h2>Live Set <span>{snapshot.liveSet.items.length}</span></h2></div></div>
            {snapshot.liveSet.items.length === 0 ? <div className="empty-card live-set-empty"><span className="empty-illustration"><Icon name="list-music" size={27}/></span><div><strong>El Live Set está vacío</strong><p>{canEdit ? "Agrega una canción y empieza a construir la selección con tu Crowd." : "Cuando el grupo agregue canciones, aparecerán aquí."}</p></div></div> : <div className="track-list-card">
              {snapshot.liveSet.items.map((item, index) => <TrackRow key={item.itemId} track={item} index={index} canEdit={canEdit} busy={busy} onMove={(direction) => onMoveTrack(item, direction)} onRemove={() => onRemoveTrack(item)}/>)}
            </div>}
          </section>

          {canEdit && <section className="add-live-set-section"><div className="section-heading section-heading-tight"><div><p className="eyebrow">CATÁLOGO D1</p><h2>Agregar al Live Set</h2></div><span className="catalog-demo-badge">TEST TRACKS</span></div>
            {availableTracks.length === 0 ? <p className="subtle-copy">Todas las canciones de prueba están en este Live Set.</p> : <div className="add-track-grid-full">{availableTracks.map((track, index) => <div className="add-track-tile" key={track.id}><Artwork seed={index + 11} size="medium"/><span><strong>{track.title}</strong><small>{track.artist ?? "Artista de prueba"}</small></span><button className="icon-button icon-button-accent" onClick={() => onAddTrack(track.id)} disabled={busy} aria-label={`Agregar ${track.title}`}><Icon name="plus" size={17}/></button></div>)}</div>}
          </section>}
        </section>

        <aside className={`pit-room-aside ${mobileTab === "live-set" ? "mobile-hidden" : ""}`}>
          <section className={`pit-side-card crowd-card ${mobileTab === "details" ? "mobile-hidden" : ""}`}>
            <div className="side-card-heading"><div><p className="eyebrow">QUIÉNES ESTÁN AQUÍ</p><h3>Crowd <span>{snapshot.members.length}</span></h3></div><Icon name="users" size={19}/></div>
            <div className="crowd-list">{snapshot.members.map((member, index) => <div className="crowd-member" key={member.identityId}><span className={`avatar crowd-avatar crowd-avatar-${index % 5}`}>{member.displayName.trim().charAt(0).toUpperCase()}</span><span className="crowd-member-copy"><strong>{member.displayName}</strong><small>{roleLabel(member.role)}</small></span>{member.role === "admin" && <span className="admin-mark">ADMIN</span>}</div>)}</div>
            <p className="crowd-footnote">Miembros del Pit. El estado de presencia se incorporará en una demo posterior.</p>
          </section>

          <section className={`pit-side-card pit-details-card ${mobileTab === "crowd" ? "mobile-hidden" : ""}`}>
            <div className="side-card-heading"><div><p className="eyebrow">INFORMACIÓN</p><h3>Detalles del Pit</h3></div><Icon name="radio" size={19}/></div>
            <div className="detail-pair"><span>Tu rol</span><strong>{roleLabel(snapshot.membership.role)}</strong></div>
            <div className="detail-pair"><span>Estado</span><strong>{snapshot.pit.status === "active" ? "Activo" : "Finalizado"}</strong></div>
            
            <div className="detail-pair"><span>Origen</span><strong>{snapshot.liveSet.sourceSetlistId ? "Setlist" : "Pit vacío"}</strong></div>
            <div className="detail-pair"><span>Reproducción</span><strong>No disponible en D1</strong></div>
          </section>

          {isAdmin && <section className={`pit-side-card invite-side-card ${mobileTab === "crowd" ? "mobile-hidden" : ""}`}>
            <div className="side-card-heading"><div><p className="eyebrow">HAZLO COMPARTIDO</p><h3>Invita a tu gente</h3></div><Icon name="send" size={18}/></div>
            <p>Genera una invitación para que alguien se una a este Pit.</p>
            <div className="invite-quick-actions"><button className="button button-primary button-full" onClick={() => onCreateInvitation("crowd")} disabled={busy}>Invitar como Crowd</button><button className="button button-secondary button-full" onClick={() => onCreateInvitation("viewer")} disabled={busy}>Invitar como Viewer</button></div>
            <small className="invite-expiry-note">Cada código se puede usar una sola vez y vence en 7 días.</small>
            {inviteToken && <div className="invite-generated"><div><span>INVITACIÓN GENERADA</span><code>{inviteToken}</code></div><button className="button button-secondary button-small" onClick={onCopyInvite}><Icon name="copy" size={14}/> Copiar enlace</button></div>}
            {snapshot.pit.status === "active" && <button className="text-danger-button" onClick={onEndPit} disabled={busy}><Icon name="x" size={15}/> Finalizar Pit</button>}
          </section>}
        </aside>
      </div>
    </div>
  );
}
