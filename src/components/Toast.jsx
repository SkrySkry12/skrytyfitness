import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, WifiOff, X } from "lucide-react";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info, offline: WifiOff };

/** Toast item: { id, msg, type: "success"|"error"|"info"|"offline", action?: { label, onClick } } */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback(id => {
    setToasts(list => list.filter(t => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback((msg, opts = {}) => {
    const id = Date.now() + Math.random();
    const duration = opts.duration ?? (opts.action ? 7000 : 4000);
    setToasts(list => [...list.slice(-2), { id, msg, type: opts.type || "success", action: opts.action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} className="toast-icon" />
              <span className="toast-msg">{t.msg}</span>
              {t.action && (
                <button type="button" className="toast-action" onClick={() => { dismiss(t.id); t.action.onClick(); }}>
                  {t.action.label}
                </button>
              )}
              <button type="button" className="toast-close" aria-label="Zamknij powiadomienie" onClick={() => dismiss(t.id)}><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
