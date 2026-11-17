import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";

export function JoinPage({ token, busy, error, onJoin, onBack }: { token: string; busy: boolean; error: string | null; onJoin: (token: string) => void; onBack: () => void }) {
  const [value, setValue] = useState(token);
  useEffect(() => setValue(token), [token]);
  return (
    <div className="join-page-wrap">
      <section className="join-page-card">
        <span className="join-page-mark"><Icon name="users" size={30}/></span>
        <p className="eyebrow">TE INVITARON A UN PIT</p>
        <h1>La música suena<br/>mejor en grupo.</h1>
        <p>Usa esta invitación para unirte a una sesión de Moshpit y compartir el Live Set con otras personas.</p>
        <label className="field-label" htmlFor="join-token">Código de invitación</label>
        <input id="join-token" className="form-control" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Pega tu código de invitación" autoComplete="off"/>
        {error && <p className="join-page-error">{error}</p>}
        <button className="button button-primary button-full" disabled={busy || !value.trim()} onClick={() => onJoin(value.trim())}>{busy ? "Uniéndote…" : "Unirme al Pit"} <Icon name="arrow-up-right" size={16}/></button>
        <button className="text-link join-back-link" onClick={onBack}>Volver a Moshpit</button>
      </section>
    </div>
  );
}
