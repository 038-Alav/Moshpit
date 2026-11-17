import { useState } from "react";
import type { PitSummary } from "../types";
import { Icon } from "../components/Icon";

export function PitsPage({ pits, onCreate, onJoin, onOpen }: { pits: PitSummary[]; onCreate: () => void; onJoin: () => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<"active" | "history">("active");
  const active = pits.filter((pit) => pit.status === "active");
  const ended = pits.filter((pit) => pit.status === "ended");
  const shown = tab === "active" ? active : ended;
  return (
    <div className="page-stack">
      <section className="page-heading-block">
        <div><p className="eyebrow">MÚSICA EN COMPAÑÍA</p><h1>Pits</h1><p>Espacios donde tu gente se reúne y construye un Live Set juntos.</p></div>
        <div className="heading-actions"><button className="button button-secondary" onClick={onJoin}><Icon name="link" size={16}/> Unirme con código</button><button className="button button-primary" onClick={onCreate}><Icon name="plus" size={17}/> Crear Pit</button></div>
      </section>
      <div className="pit-tabs-bar"><div className="filter-tabs"><button className={tab === "active" ? "filter-active" : ""} onClick={() => setTab("active")}>Activos <span>{active.length}</span></button><button className={tab === "history" ? "filter-active" : ""} onClick={() => setTab("history")}>Historial <span>{ended.length}</span></button></div><span className="pit-list-explainer">{tab === "active" ? "Pits en los que participas" : "Tus sesiones finalizadas"}</span></div>
      {shown.length === 0 ? <div className="empty-state-large"><span className="empty-illustration"><Icon name={tab === "active" ? "users" : "history"} size={30}/></span><h2>{tab === "active" ? "Todavía no estás en ningún Pit" : "Tu historial está vacío"}</h2><p>{tab === "active" ? "Crea una nueva sesión o únete con una invitación para compartir música." : "Cuando termines una sesión, su Live Set quedará guardado aquí."}</p>{tab === "active" && <div className="empty-state-actions"><button className="button button-primary" onClick={onCreate}>Crear un Pit</button><button className="button button-secondary" onClick={onJoin}>Tengo una invitación</button></div>}</div> : <div className="pit-list-grid">
        {shown.map((pit, index) => <button key={pit.id} className="pit-list-card" onClick={() => onOpen(pit.id)}>
          <div className={`pit-list-card-art pit-list-art-${index % 3}`}><span className="pit-list-art-mark"><Icon name="radio" size={27}/></span><span className={`pit-state-pill ${pit.status}`}>{pit.status === "active" ? <><i/> EN CURSO</> : "FINALIZADO"}</span></div>
          <div className="pit-list-card-body"><div><strong>{pit.name}</strong><span>{pit.role === "admin" ? "Admin" : pit.role === "viewer" ? "Viewer · Solo lectura" : "Crowd"} · {pit.status === "active" ? "Live Set compartido" : "Sesión conservada"}</span></div><Icon name="arrow-up-right" size={18}/></div>
        </button>)}
      </div>}
    </div>
  );
}
