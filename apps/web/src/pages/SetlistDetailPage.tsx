import type { Setlist, SetlistItem, TestTrack } from "../types";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";
import { TrackRow } from "../components/TrackRow";

export function SetlistDetailPage({ setlist, items, tracks, busy, onBack, onExplore, onCreatePit, onEdit, onAddTrack, onRemoveTrack, onMoveTrack }: {
  setlist: Setlist;
  items: SetlistItem[];
  tracks: TestTrack[];
  busy: boolean;
  onBack: () => void;
  onExplore: () => void;
  onCreatePit: () => void;
  onEdit: () => void;
  onAddTrack: (id: string) => void;
  onRemoveTrack: (item: SetlistItem) => void;
  onMoveTrack: (item: SetlistItem, direction: -1 | 1) => void;
}) {
  const availableTracks = tracks.filter((track) => !items.some((item) => item.canonicalTrackId === track.id));
  return (
    <div className="page-stack setlist-detail-page">
      <button className="back-link" onClick={onBack}><Icon name="chevron-left" size={16}/> Tu biblioteca</button>
      <section className="setlist-hero-card">
        <Artwork seed={setlist.name.length + 5} size="hero" className="setlist-hero-art"/>
        <div className="setlist-hero-copy"><p className="eyebrow">SETLIST PRIVADO</p><h1>{setlist.name}</h1><p>{setlist.description || "Tu selección musical, guardada en Moshpit."}</p><div className="setlist-hero-meta"><span><Icon name="music" size={14}/>{items.length} {items.length === 1 ? "canción" : "canciones"}</span><span><Icon name="lock" size={14}/>Solo tú</span></div>
          <div className="setlist-hero-actions"><button className="button button-primary" onClick={onCreatePit}><Icon name="users" size={16}/> Crear un Pit</button><button className="button button-secondary" onClick={onEdit}><Icon name="edit" size={15}/> Editar detalles</button></div>
        </div>
        <div className="setlist-hero-orb" aria-hidden="true">♫</div>
      </section>

      <section className="content-section setlist-tracks-section">
        <div className="section-heading"><div><p className="eyebrow">TU SELECCIÓN</p><h2>Canciones</h2></div><button className="button button-secondary button-small" onClick={onExplore}><Icon name="plus" size={15}/> Explorar música</button></div>
        {items.length === 0 ? <div className="empty-card"><span className="empty-illustration"><Icon name="music"/></span><div><strong>Este Setlist está esperando su primera canción</strong><p>Explora el catálogo de prueba y agrega tracks a tu colección.</p></div><button className="button button-primary button-small" onClick={onExplore}>Explorar canciones</button></div> : <div className="track-list-card">
          <div className="track-table-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span>DURACIÓN</span><span/></div>
          {items.map((item, index) => <TrackRow key={item.itemId} track={item} index={index} canEdit busy={busy} onMove={(direction) => onMoveTrack(item, direction)} onRemove={() => onRemoveTrack(item)}/>)}
        </div>}
      </section>

      <section className="content-section catalog-section">
        <div className="section-heading"><div><p className="eyebrow">CATÁLOGO D1</p><h2>Agregar música</h2><p>Estas canciones están disponibles en el catálogo local de demostración.</p></div><span className="catalog-demo-badge">TEST TRACKS</span></div>
        {availableTracks.length === 0 ? <p className="subtle-copy">Ya agregaste todas las canciones disponibles en esta demo.</p> : <div className="add-track-grid-full">{availableTracks.map((track, index) => <div className="add-track-tile" key={track.id}><Artwork seed={index + 7} size="medium"/><span><strong>{track.title}</strong><small>{track.artist ?? "Artista de prueba"}</small></span><button className="icon-button icon-button-accent" onClick={() => onAddTrack(track.id)} disabled={busy} aria-label={`Agregar ${track.title}`}><Icon name="plus" size={17}/></button></div>)}</div>}
      </section>
      <aside className="independence-note"><Icon name="info" size={17}/><p>Cuando creas un Pit desde este Setlist, Moshpit copia las canciones al Live Set. Los cambios de la sesión no modifican esta colección original.</p></aside>
    </div>
  );
}
