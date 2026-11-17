import type { Identity } from "../types";
import { Icon } from "../components/Icon";

export function ProfilePage({ identity, onBack }: { identity: Identity | null; onBack: () => void }) {
  const initial = identity?.displayName?.trim().charAt(0).toUpperCase() || "G";
  return (
    <div className="page-stack profile-page">
      <button className="back-link" onClick={onBack}><Icon name="chevron-left" size={16}/> Volver</button>
      <section className="page-heading-block"><div><p className="eyebrow">TU CUENTA</p><h1>Perfil</h1><p>Información de tu identidad actual en Moshpit.</p></div></section>
      <section className="profile-card"><span className="profile-large-avatar">{initial}</span><div><h2>{identity?.displayName ?? "Invitado"}</h2><p>{identity?.identityType === "guest" ? "Identidad guest" : "Cuenta Moshpit"}</p><div className="profile-id"><Icon name="lock" size={15}/><span>Identidad guest activa en este navegador</span></div></div></section>
      <div className="profile-info-note"><Icon name="info" size={18}/><p>Tu identidad guest se conserva en este navegador para que puedas volver a tus Setlists y Pits. Las opciones de cuenta y sincronización entre dispositivos llegarán en una fase posterior.</p></div>
    </div>
  );
}
