import React, { useState } from "react";
import { Check, Pencil, Scale, Trash2, X } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { WeightChart } from "../components/WeightChart.jsx";
import { dayKey, formatLong } from "../lib/dates.js";
import { fmtKg, num } from "../lib/format.js";

export function Progress() {
  const { user, entries, settings, today, createEntry, updateEntry, deleteEntry, reportError } = useApp();
  const toast = useToast();
  const weights = entries.filter(e => e.kind === "weight");
  const latest = weights[0] ? num(weights[0].data?.kg) : null;
  const [kg, setKg] = useState(() => latest ? String(latest) : (user.username === "kieltyczka" ? "" : String(settings.startWeight || "")));
  const [waist, setWaist] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(null); // { id, kg, waist, date }
  const [showAll, setShowAll] = useState(false);

  const add = async () => {
    if (!(num(kg) > 0)) return;
    setSaving(true);
    try {
      const created = await createEntry("weight", { kg: num(kg), waist: num(waist) || null }, date);
      toast(`Zapisano pomiar: ${fmtKg(kg)} kg`, { type: created?.pending ? "offline" : "success", action: { label: "Cofnij", onClick: () => deleteEntry(created.id).catch(reportError) } });
      setWaist("");
    } catch (err) { reportError(err); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!(num(edit.kg) > 0)) { toast("Podaj prawidłową wagę.", { type: "error" }); return; }
    try {
      await updateEntry(edit.id, { date: edit.date, data: { kg: num(edit.kg), waist: num(edit.waist) || null } });
      setEdit(null);
      toast("Pomiar zaktualizowany");
    } catch (err) { reportError(err); }
  };

  const remove = async entry => {
    try {
      await deleteEntry(entry.id);
      toast(`Usunięto pomiar ${fmtKg(entry.data?.kg)} kg`, { type: "info", action: { label: "Cofnij", onClick: () => createEntry("weight", entry.data, dayKey(entry)).catch(reportError) } });
    } catch (err) { reportError(err); }
  };

  const start = settings.startWeight || (weights.length ? num(weights[weights.length - 1].data?.kg) : null);
  const lost = start && latest ? start - latest : null;
  const list = showAll ? weights : weights.slice(0, 10);

  return (
    <div className="page">
      <div className="page-intro"><p className="eyebrow">TWOJA TRANSFORMACJA</p><h1>Liczy się postęp.</h1></div>

      <section className="stats-grid">
        <article className="stat-card"><div className="stat-top"><span>Aktualnie</span><Scale size={16} /></div><b>{latest ? fmtKg(latest) : "—"} <small>kg</small></b></article>
        <article className="stat-card"><div className="stat-top"><span>Cel</span></div><b>{settings.targetWeight ? fmtKg(settings.targetWeight) : "—"} <small>kg</small></b></article>
        <article className="stat-card"><div className="stat-top"><span>Zmiana od startu</span></div><b className={lost > 0 ? "good" : ""}>{lost != null ? (lost > 0 ? "−" : "+") + fmtKg(Math.abs(lost)) : "—"} <small>kg</small></b></article>
        <article className="stat-card"><div className="stat-top"><span>Do celu</span></div><b>{latest && settings.targetWeight ? fmtKg(Math.max(0, latest - settings.targetWeight)) : "—"} <small>kg</small></b></article>
      </section>

      <section className="card">
        <h3>Dodaj pomiar</h3>
        <div className="form-grid three">
          <label className="field"><span>Waga <small>(kg)</small></span><input type="number" step="0.1" inputMode="decimal" value={kg} onChange={e => setKg(e.target.value)} /></label>
          <label className="field"><span>Brzuch <small>(cm)</small></span><input type="number" inputMode="decimal" value={waist} onChange={e => setWaist(e.target.value)} placeholder="opcjonalnie" /></label>
          <label className="field"><span>Data</span><input type="date" value={date} max={today} onChange={e => setDate(e.target.value || today)} /></label>
        </div>
        <button type="button" className="primary full" disabled={saving || !(num(kg) > 0)} onClick={add}>{saving ? <Spinner /> : <Check size={18} />} Zapisz pomiar</button>
      </section>

      <section className="card">
        <h3>Wykres wagi</h3>
        <WeightChart entries={weights} target={settings.targetWeight} today={today} />
      </section>

      <section className="card">
        <h3>Historia pomiarów</h3>
        {!weights.length && <p className="muted">Brak pomiarów.</p>}
        {list.map(e => edit?.id === e.id ? (
          <div className="weight-row editing" key={e.id}>
            <input type="date" aria-label="Data pomiaru" value={edit.date} onChange={ev => setEdit(v => ({ ...v, date: ev.target.value }))} />
            <input type="number" step="0.1" aria-label="Waga" value={edit.kg} onChange={ev => setEdit(v => ({ ...v, kg: ev.target.value }))} />
            <input type="number" aria-label="Obwód brzucha" placeholder="cm" value={edit.waist} onChange={ev => setEdit(v => ({ ...v, waist: ev.target.value }))} />
            <button type="button" className="icon-btn success" aria-label="Zapisz" onClick={saveEdit}><Check size={18} /></button>
            <button type="button" className="icon-btn" aria-label="Anuluj" onClick={() => setEdit(null)}><X size={18} /></button>
          </div>
        ) : (
          <div className={"weight-row" + (e.pending ? " pending" : "")} key={e.id}>
            <span className="capitalize">{formatLong(dayKey(e))}</span>
            <div className="grow right"><b>{fmtKg(e.data?.kg)} kg</b>{e.data?.waist ? <small className="muted"> · brzuch {e.data.waist} cm</small> : null}</div>
            {e.id > 0 && <button type="button" className="icon-btn" aria-label="Edytuj pomiar" onClick={() => setEdit({ id: e.id, kg: String(e.data?.kg ?? ""), waist: String(e.data?.waist ?? ""), date: dayKey(e) })}><Pencil size={16} /></button>}
            <button type="button" className="icon-btn danger" aria-label="Usuń pomiar" onClick={() => remove(e)}><Trash2 size={16} /></button>
          </div>
        ))}
        {weights.length > 10 && <button type="button" className="link-btn" onClick={() => setShowAll(v => !v)}>{showAll ? "Pokaż mniej" : `Pokaż wszystkie (${weights.length})`}</button>}
      </section>
    </div>
  );
}
