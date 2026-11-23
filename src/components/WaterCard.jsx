import React, { useState } from "react";
import { Droplets, X } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "./Toast.jsx";
import { dayKey } from "../lib/dates.js";
import { fmtL, num } from "../lib/format.js";

/** Today's hydration with +250/+500 buttons, undo toast and a removable list of today's entries. */
export function WaterCard({ date }) {
  const { entries, settings, today, createEntry, deleteEntry, reportError } = useApp();
  const toast = useToast();
  const day = date || today;
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const items = entries.filter(e => e.kind === "water" && dayKey(e) === day);
  const total = items.reduce((s, e) => s + num(e.data?.ml), 0);
  const target = settings.waterTargetMl;
  const pct = Math.min(100, (total / target) * 100);

  const add = async ml => {
    setBusy(true);
    try {
      const entry = await createEntry("water", { ml }, day);
      toast(`Dodano ${ml} ml wody`, {
        action: { label: "Cofnij", onClick: () => deleteEntry(entry.id).catch(reportError) }
      });
    } catch (err) { reportError(err); }
    finally { setBusy(false); }
  };
  const remove = async entry => {
    try { await deleteEntry(entry.id); toast(`Usunięto ${num(entry.data?.ml)} ml`, { type: "info" }); }
    catch (err) { reportError(err); }
  };

  return (
    <section className="card water-card">
      <div className="card-head">
        <div className="card-title"><span className="icon-chip water"><Droplets size={18} /></span><div><h3>Nawodnienie</h3><small>{day === today ? "dzisiaj" : "w wybranym dniu"}</small></div></div>
        <b className="water-total">{fmtL(total)} <small>/ {fmtL(target)} l</small></b>
      </div>
      <div className="progress water"><span style={{ width: pct + "%" }} /></div>
      <div className="row gap">
        <button type="button" className="primary grow" disabled={busy} onClick={() => add(250)}>+ 250 ml</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => add(500)}>+ 500 ml</button>
      </div>
      {items.length > 0 && (
        <button type="button" className="link-btn" onClick={() => setShowList(v => !v)}>
          {showList ? "Ukryj wpisy" : `Pokaż wpisy (${items.length})`}
        </button>
      )}
      {showList && (
        <ul className="chip-list">
          {items.map(e => (
            <li key={e.id} className={e.pending ? "pending" : ""}>
              {num(e.data?.ml)} ml
              <button type="button" aria-label={`Usuń ${num(e.data?.ml)} ml wody`} onClick={() => remove(e)}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
