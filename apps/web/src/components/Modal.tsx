import type { FormEvent, ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({ open, title, description, onClose, children, size = "normal" }: {
  open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; size?: "normal" | "wide";
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal-card ${size === "wide" ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button icon-button-quiet" type="button" onClick={onClose} aria-label="Cerrar"><Icon name="x"/></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function FormActions({ onCancel, submitLabel, disabled = false }: { onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return <div className="form-actions"><button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button><button type="submit" className="button button-primary" disabled={disabled}>{submitLabel}</button></div>;
}

export function preventSubmit(handler: () => void) {
  return (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); handler(); };
}
