import type { Identity, PitSummary, Setlist } from "../types";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";

export function HomePage({ identity, setlists, pits, onCreateSetlist, onCreatePit, onExplore, onOpenSetlist, onOpenPit, onOpenPits }: {
  identity: Identity | null;
  setlists: Setlist[];
  pits: PitSummary[];
  onCreateSetlist: () => void;
  onCreatePit: () => void;
  onExplore: () => void;
  onOpenSetlist: (id: string) => void;
  onOpenPit: (id: string) => void;
  onOpenPits: () => void;
}) {
  const activePits = pits.filter((pit) => pit.status === "active");
  const recentSetlists = setlists.slice(0, 4);
  return (
    <div className="page-stack home-page">
      <section className="home-intro">
        <div className="home-intro-copy">
          <p className="eyebrow">BIENVENIDO A MOSHPIT</p>
          <h1>Hola, {identity?.displayName?.split(" ")[0] ?? "Mosher"}.</h1>
          <p>Tu próxima sesión empieza con una canción. Organiza tu música y compártela con tu gente.</p>
          <div className="home-intro-actions">
            <button className="button button-primary" onClick={onCreateSetlist}><Icon name="plus" size={17}/> Crear Setlist</button>
            <button className="button button-secondary" onClick={onExplore}><Icon name="compass" size={17}/> Explorar música</button>
          </div>
        </div>
        <div className="home-intro-art" aria-hidden="true">
          <div className="intro-record intro-record-a"><span/></div>
          <div className="intro-record intro-record-b"><span/></div>
          <div className="intro-note">♫</div>
        </div>
      </section>

      <section className="home-shortcuts" aria-label="Accesos rápidos">
        <button className="shortcut-card" onClick={onCreateSetlist}><span className="shortcut-icon shortcut-violet"><Icon name="list-music" size={21}/></span><span><strong>Nuevo Setlist</strong><small>Guarda una selección de música</small></span><Icon name="arrow-up-right" className="shortcut-arrow"/></button>
        <button className="shortcut-card" onClick={onCreatePit}><span className="shortcut-icon shortcut-blue"><Icon name="users" size={21}/></span><span><strong>Crear un Pit</strong><small>Reúne a todos para compartir</small></span><Icon name="arrow-up-right" className="shortcut-arrow"/></button>
        <button className="shortcut-card" onClick={onExplore}><span className="shortcut-icon shortcut-amber"><Icon name="search" size={21}/></span><span><strong>Encontrar música</strong><small>Explora el catálogo disponible</small></span><Icon name="arrow-up-right" className="shortcut-arrow"/></button>
      </section>

      {activePits.length > 0 && <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">SIGUE COMPARTIENDO</p><h2>Tus Pits activos</h2></div><button className="text-link" onClick={onCreatePit}>Crear un Pit <Icon name="arrow-up-right" size={15}/></button></div>
        <div className="active-pit-grid">
          {activePits.slice(0, 3).map((pit, index) => <button className="active-pit-card" key={pit.id} onClick={() => onOpenPit(pit.id)}>
            <div className={`pit-card-art pit-card-art-${index % 3}`}><Icon name="radio" size={26}/><span className="live-chip"><i/> EN CURSO</span></div>
            <div className="active-pit-card-copy"><strong>{pit.name}</strong><span>{pit.role === "viewer" ? "Solo lectura" : pit.role === "admin" ? "Admin" : "Crowd"} · Live Set compartido</span></div>
            <Icon name="chevron-right" size={18} className="card-chevron"/>
          </button>)}
        </div>
      </section>}

      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">TU BIBLIOTECA</p><h2>Setlists recientes</h2></div><button className="text-link" onClick={onCreateSetlist}>Nuevo Setlist <Icon name="plus" size={15}/></button></div>
        {recentSetlists.length === 0 ? <div className="empty-card"><span className="empty-illustration"><Icon name="disc" size={28}/></span><div><strong>Tu biblioteca empieza aquí</strong><p>Crea tu primer Setlist y guarda música directamente en Moshpit.</p></div><button className="button button-primary button-small" onClick={onCreateSetlist}>Crear Setlist</button></div> : <div className="setlist-card-grid">
          {recentSetlists.map((setlist, index) => <button className="setlist-card" key={setlist.id} onClick={() => onOpenSetlist(setlist.id)}>
            <Artwork seed={index + setlist.name.length} size="large"/>
            <span className="setlist-card-copy"><strong>{setlist.name}</strong><small>{setlist.trackCount} {setlist.trackCount === 1 ? "canción" : "canciones"}</small></span>
            <span className="setlist-card-hover"><Icon name="arrow-up-right"/></span>
          </button>)}
        </div>}
      </section>

      {pits.filter((pit) => pit.status === "ended").length > 0 && <section className="history-teaser">
        <div className="history-teaser-icon"><Icon name="history"/></div>
        <div><strong>Las buenas sesiones quedan en la memoria.</strong><p>Tienes {pits.filter((pit) => pit.status === "ended").length} {pits.filter((pit) => pit.status === "ended").length === 1 ? "Pit en tu historial" : "Pits en tu historial"}.</p></div>
        <button className="button button-secondary button-small" onClick={onOpenPits}>Ver historial <Icon name="arrow-up-right" size={14}/></button>
      </section>}
    </div>
  );
}
