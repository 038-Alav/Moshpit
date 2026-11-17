import { useMemo, useState } from "react";
import type { PitSummary, Setlist, TestTrack } from "../types";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";

export function ExplorePage({ tracks, setlists, pits, onAddTrack, onCreateSetlist }: {
  tracks: TestTrack[];
  setlists: Setlist[];
  pits: PitSummary[];
  onAddTrack: (track: TestTrack, destination: { type: "setlist" | "pit"; id: string }) => void;
  onCreateSetlist: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "tracks">("all");
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const availablePits = pits.filter((pit) => pit.status === "active" && pit.role !== "viewer");
  const filteredTracks = useMemo(() => tracks.filter((track) => `${track.title} ${track.artist ?? ""} ${track.album ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [tracks, query]);
  const currentTrack = tracks.find((track) => track.id === addingTrackId) ?? null;

  function addCurrentTrack() {
    if (!currentTrack || !destination) return;
    const [type, id] = destination.split(":");
    if ((type === "setlist" || type === "pit") && id) onAddTrack(currentTrack, { type, id });
    setAddingTrackId(null);
    setDestination("");
  }

  return (
    <div className="page-stack">
      <section className="page-heading-block">
        <div><p className="eyebrow">ENCUENTRA TU PRÓXIMA CANCIÓN</p><h1>Explorar</h1><p>Busca en el catálogo disponible y decide dónde quieres compartir cada canción.</p></div>
        <span className="page-heading-icon"><Icon name="compass" size={26}/></span>
      </section>
      <section className="explore-search-panel">
        <Icon name="search" size={22}/>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué quieres escuchar?" aria-label="Buscar canciones" />
        {query && <button className="icon-button icon-button-quiet" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><Icon name="x"/></button>}
        <kbd>Buscar</kbd>
      </section>
      <div className="explore-filter-row"><div className="filter-tabs"><button className={filter === "all" ? "filter-active" : ""} onClick={() => setFilter("all")}>Todo</button><button className={filter === "tracks" ? "filter-active" : ""} onClick={() => setFilter("tracks")}>Canciones</button></div><span className="demo-catalog-note"><span/> CATÁLOGO DE PRUEBA · D1</span></div>

      <section className="explore-results-section">
        <div className="section-heading section-heading-tight"><div><h2>{query ? "Resultados" : "Canciones disponibles"}</h2><p>{filteredTracks.length} {filteredTracks.length === 1 ? "canción" : "canciones"} en el catálogo de demostración</p></div></div>
        {tracks.length === 0 ? <div className="empty-card"><span className="empty-illustration"><Icon name="music"/></span><div><strong>No hay canciones disponibles todavía</strong><p>El catálogo de prueba se mostrará cuando esté disponible desde el servidor.</p></div></div> : filteredTracks.length === 0 ? <div className="empty-card"><span className="empty-illustration"><Icon name="search"/></span><div><strong>No encontramos esa canción</strong><p>Prueba con otro título o artista. La búsqueda externa llegará en una fase posterior.</p></div><button className="button button-secondary button-small" onClick={() => setQuery("")}>Limpiar búsqueda</button></div> : <div className="track-table">
          <div className="track-table-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span>DURACIÓN</span><span/></div>
          {filteredTracks.map((track, index) => <div className="explore-track-line" key={track.id}>
            <span className="track-table-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="track-table-title"><Artwork seed={index + 2} size="small"/><span><strong>{track.title}</strong><small>{track.artist ?? "Artista de prueba"}</small></span></div>
            <span className="track-table-album">{track.album ?? "—"}</span>
            <span className="track-table-duration">{track.durationMs ? `${Math.floor(track.durationMs / 60000)}:${String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, "0")}` : "—"}</span>
            <button className="button button-secondary button-small" onClick={() => { setAddingTrackId(track.id); setDestination(setlists[0] ? `setlist:${setlists[0].id}` : availablePits[0] ? `pit:${availablePits[0].id}` : ""); }}> <Icon name="plus" size={15}/> Agregar a</button>
          </div>)}
        </div>}
      </section>

      <aside className="explore-info-note"><Icon name="info" size={17}/><p>Este catálogo contiene únicamente canciones de demostración guardadas en Moshpit. La búsqueda federada de Spotify, YouTube y otros servicios se incorporará con los adapters musicales.</p></aside>

      {currentTrack && <div className="inline-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddingTrackId(null); }}>
        <section className="destination-popover" role="dialog" aria-modal="true" aria-labelledby="destination-title">
          <div className="destination-popover-head"><div><p className="eyebrow">COMPARTIR MÚSICA</p><h3 id="destination-title">Agregar a…</h3></div><button className="icon-button icon-button-quiet" onClick={() => setAddingTrackId(null)} aria-label="Cerrar"><Icon name="x"/></button></div>
          <div className="destination-track"><Artwork seed={currentTrack.title.length} size="medium"/><div><strong>{currentTrack.title}</strong><small>{currentTrack.artist ?? "Artista de prueba"}</small></div></div>
          <label className="field-label" htmlFor="track-destination">Destino</label>
          <select id="track-destination" className="form-control" value={destination} onChange={(event) => setDestination(event.target.value)}>
            <optgroup label="Mis Setlists">{setlists.map((setlist) => <option key={setlist.id} value={`setlist:${setlist.id}`}>{setlist.name}</option>)}</optgroup>
            <optgroup label="Pits activos">{availablePits.map((pit) => <option key={pit.id} value={`pit:${pit.id}`}>{pit.name}</option>)}</optgroup>
          </select>
          {setlists.length === 0 && availablePits.length === 0 && <p className="field-hint">Crea un Setlist o un Pit para guardar esta canción.</p>}
          <div className="form-actions"><button className="button button-secondary" onClick={() => setAddingTrackId(null)}>Cancelar</button><button className="button button-primary" disabled={!destination} onClick={addCurrentTrack}>Agregar canción</button></div>
          {setlists.length === 0 && <button className="text-link destination-create" onClick={() => { setAddingTrackId(null); onCreateSetlist(); }}>Crear Setlist <Icon name="arrow-up-right" size={14}/></button>}
        </section>
      </div>}
    </div>
  );
}
