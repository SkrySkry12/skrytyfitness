import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Accessible bottom sheet (mobile) / centered dialog (wider screens). */
export function BottomSheet({ open, onClose, title, children, className = "" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
