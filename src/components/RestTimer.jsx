import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Timer, X } from "lucide-react";

const PRESETS = [60, 90, 120];
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Floating rest timer. `startKey` changes every time a set is marked done → timer restarts. */
export function RestTimer({ startKey, onClose }) {
  const [duration, setDuration] = useState(() => Number(localStorage.getItem("skr-rest") || 90));
  const [endsAt, setEndsAt] = useState(() => Date.now() + duration * 1000);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.body.classList.add("has-rest-timer");
    return () => document.body.classList.remove("has-rest-timer");
  }, []);
  useEffect(() => { setEndsAt(Date.now() + duration * 1000); }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const finished = left === 0;

  useEffect(() => {
    if (finished) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finished, endsAt]);

  useEffect(() => {
    if (finished && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
  }, [finished]);

  const pick = s => {
    setDuration(s);
    localStorage.setItem("skr-rest", String(s));
    setEndsAt(Date.now() + s * 1000);
    setNow(Date.now());
  };
  const pct = Math.min(100, (left / duration) * 100);

  // Portal: page wrappers are animated with transforms, which would break `position: fixed`.
  return createPortal(
    <div className={"rest-timer" + (finished ? " finished" : "")} role="timer" aria-live="polite">
      <div className="rest-ring" style={{ "--pct": pct }}>
        <Timer size={16} />
      </div>
      <div className="rest-copy">
        <span>{finished ? "Koniec przerwy!" : "Odpoczynek"}</span>
        <b>{finished ? "Następna seria" : fmt(left)}</b>
      </div>
      <div className="rest-presets">
        {PRESETS.map(s => (
          <button type="button" key={s} className={duration === s ? "active" : ""} onClick={() => pick(s)}>{s}s</button>
        ))}
      </div>
      <button type="button" className="icon-btn" aria-label="Zamknij timer" onClick={onClose}><X size={18} /></button>
    </div>,
    document.body
  );
}
