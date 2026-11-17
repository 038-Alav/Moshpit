import { useEffect } from "react";
import type { ReactNode } from "react";
import type { Identity, Page, PitSummary } from "../types";
import { Icon } from "./Icon";

const navigation: Array<{ id: Page; label: string; icon: "home" | "compass" | "list-music" | "users" }> = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "explore", label: "Explorar", icon: "compass" },
  { id: "setlists", label: "Setlists", icon: "list-music" },
  { id: "pits", label: "Pits", icon: "users" }
];

export function AppShell({ page, identity, pits, onNavigate, onSearch, children, activePitName, onOpenProfile, onOpenPit }: {
  page: Page;
  identity: Identity | null;
  pits: PitSummary[];
  onNavigate: (page: Page) => void;
  onSearch: () => void;
  children: ReactNode;
  activePitName?: string;
  onOpenProfile: () => void;
  onOpenPit: (id: string) => void;
}) {
  const currentSection = page === "setlist-detail" ? "setlists" : page === "pit-room" ? "pits" : page;
  const activePits = pits.filter((pit) => pit.status === "active").slice(0, 3);
  const initial = identity?.displayName?.trim().charAt(0).toUpperCase() || "G";

  useEffect(() => {
    function onGlobalShortcut(event: KeyboardEvent) {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      );
      if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onSearch();
      }
    }
    window.addEventListener("keydown", onGlobalShortcut);
    return () => window.removeEventListener("keydown", onGlobalShortcut);
  }, [onSearch]);

  return (
    <div className="app-frame" data-page={page}>
      <aside className="sidebar-nav" aria-label="Navegación principal">
        <button className="brand-lockup" onClick={() => onNavigate("home")} aria-label="Moshpit, ir al inicio">
          <span className="brand-symbol"><span /></span><span className="brand-wordmark">MOSHPIT</span>
        </button>

        <div className="nav-label">TU ESPACIO</div>
        <nav className="primary-nav">
          {navigation.map((item) => (
            <button key={item.id} title={item.label} aria-label={item.label} aria-current={currentSection === item.id ? "page" : undefined} className={`nav-link ${currentSection === item.id ? "is-active" : ""}`} onClick={() => onNavigate(item.id)}>
              <Icon name={item.icon}/><span>{item.label}</span>
              {item.id === "pits" && activePits.length > 0 && <span className="nav-count">{activePits.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-section-head"><span className="nav-label">PITS ACTIVOS</span><button className="icon-button icon-button-xs icon-button-quiet" onClick={() => onNavigate("pits")} aria-label="Ver todos los Pits"><Icon name="plus" size={15}/></button></div>
        <div className="sidebar-pit-list">
          {activePits.length === 0 && <p className="sidebar-empty">Tus sesiones activas aparecerán aquí.</p>}
          {activePits.map((pit) => (
            <button key={pit.id} className={`sidebar-pit ${activePitName === pit.name ? "sidebar-pit-current" : ""}`} onClick={() => onOpenPit(pit.id)} title={pit.name}>
              <span className="sidebar-pit-dot"/><span>{pit.name}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-bottom-note"><span className="sidebar-note-icon"><Icon name="headphones" size={16}/></span><span><strong>La música se comparte</strong><small>Mejor juntos.</small></span></div>
          <button className="profile-button" onClick={onOpenProfile}>
            <span className="avatar avatar-self">{initial}</span>
            <span className="profile-copy"><strong>{identity?.displayName ?? "Conectando…"}</strong><small>{identity?.identityType === "guest" ? "Cuenta de invitado" : "Cuenta Moshpit"}</small></span>
            <Icon name="more-horizontal" size={17}/>
          </button>
        </div>
      </aside>

      <div className="main-frame">
        <header className="topbar">
          <div className="topbar-context">
            <span className="topbar-mobile-brand"><span className="brand-symbol"><span /></span>MOSHPIT</span>
            {activePitName && page === "pit-room" ? <span className="topbar-breadcrumb"><span>Pits</span><Icon name="chevron-right" size={14}/><strong>{activePitName}</strong></span> : <span className="topbar-subtitle">Tu música, compartida.</span>}
          </div>
          <div className="topbar-actions">
            <button className="global-search-button" onClick={onSearch}><Icon name="search"/><span>Buscar música</span><kbd>⌘ K</kbd></button>
            <button className="topbar-avatar" onClick={onOpenProfile} aria-label="Abrir perfil">{initial}</button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navigation.map((item) => (
          <button key={item.id} aria-current={currentSection === item.id ? "page" : undefined} className={`mobile-nav-link ${currentSection === item.id ? "is-active" : ""}`} onClick={() => onNavigate(item.id)}>
            <Icon name={item.icon} size={20}/><span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
