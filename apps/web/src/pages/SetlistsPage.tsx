import type { Setlist } from "../types";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";

export function SetlistsPage({ setlists, onCreate, onOpen }: { setlists: Setlist[]; onCreate: () => void; onOpen: (id: string) => void }) {
  return (
    <div className="page-stack">
      <section className="page-heading-block">
        <div><p className="eyebrow">TU BIBLIOTECA MUSICAL</p><h1>Setlists</h1><p>Colecciones que guardas en Moshpit. Elige música y llévala a un Pit cuando quieras compartirla.</p></div>
        <button className="button button-primary" onClick={onCreate}><Icon name="plus" size={17}/> Nuevo Setlist</button>
      </section>
      <div className="library-toolbar"><span>{setlists.length} {setlists.length === 1 ? "Setlist" : "Setlists"}</span><span><Icon name="lock" size={14}/> Biblioteca privada</span></div>
      {setlists.length === 0 ? <div className="empty-state-large"><span className="empty-illustration"><Icon name="list-music" size={30}/></span><h2>Aún no tienes Setlists</h2><p>Empieza una colección con canciones del catálogo de Moshpit. Tus Setlists siempre estarán guardados aquí.</p><button className="button button-primary" onClick={onCreate}><Icon name="plus"/> Crear mi primer Setlist</button></div> : <div className="library-grid">
        {setlists.map((setlist, index) => <button className="library-card" key={setlist.id} onClick={() => onOpen(setlist.id)}>
          <div className="library-card-art"><Artwork seed={index + setlist.name.length} size="hero"/><span className="library-card-open"><Icon name="arrow-up-right"/></span></div>
          <div className="library-card-copy"><strong>{setlist.name}</strong><span>{setlist.trackCount} {setlist.trackCount === 1 ? "canción" : "canciones"}</span></div>
          <span className="library-card-description">{setlist.description || "Colección privada"}</span>
        </button>)}
        <button className="library-create-card" onClick={onCreate}><span><Icon name="plus" size={25}/></span><strong>Crear Setlist</strong><small>Empieza una nueva colección</small></button>
      </div>}
    </div>
  );
}
