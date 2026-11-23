import React, { useState } from "react";
import { Calculator } from "lucide-react";
import { ACTIVITY_LEVELS, tdee } from "../lib/settings.js";

/** Numeric goal fields. `value` = draft settings, `onChange(patch)`. */
export function GoalFields({ value, onChange, compact = false }) {
  const field = (key, label, unit, step = 1) => (
    <label className="field" key={key}>
      <span>{label} <small>({unit})</small></span>
      <input type="number" inputMode="decimal" min="0" step={step} value={value[key] ?? ""}
        onChange={e => onChange({ [key]: e.target.value === "" ? null : e.target.value })} />
    </label>
  );
  return (
    <div className="form-grid">
      {field("startWeight", "Waga startowa", "kg", 0.1)}
      {field("targetWeight", "Waga docelowa", "kg", 0.1)}
      {field("kcalTarget", "Kalorie dziennie", "kcal")}
      {!compact && field("proteinTarget", "Białko", "g")}
      {!compact && field("carbsTarget", "Węglowodany", "g")}
      {!compact && field("fatTarget", "Tłuszcze", "g")}
      {field("waterTargetMl", "Woda dziennie", "ml", 50)}
    </div>
  );
}

/** Mifflin-St Jeor calculator. `onApply(kcal)` receives the suggested deficit target. */
export function TdeeCalculator({ weight, onApply }) {
  const [form, setForm] = useState({ sex: "male", age: "", height: "", weight: weight || "", activity: "1.375" });
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const result = tdee(form);
  const deficit = result ? Math.max(1200, Math.round((result - 500) / 10) * 10) : null;
  return (
    <div className="tdee">
      <div className="tdee-head"><Calculator size={18} /><b>Kalkulator zapotrzebowania (TDEE)</b></div>
      <div className="segmented small">
        {[["male", "Mężczyzna"], ["female", "Kobieta"]].map(([id, label]) => (
          <button key={id} type="button" className={form.sex === id ? "active" : ""} onClick={() => set({ sex: id })}>{label}</button>
        ))}
      </div>
      <div className="form-grid three">
        <label className="field"><span>Wiek</span><input type="number" inputMode="numeric" value={form.age} onChange={e => set({ age: e.target.value })} /></label>
        <label className="field"><span>Wzrost <small>(cm)</small></span><input type="number" inputMode="numeric" value={form.height} onChange={e => set({ height: e.target.value })} /></label>
        <label className="field"><span>Waga <small>(kg)</small></span><input type="number" inputMode="decimal" value={form.weight} onChange={e => set({ weight: e.target.value })} /></label>
      </div>
      <label className="field"><span>Aktywność</span>
        <select value={form.activity} onChange={e => set({ activity: e.target.value })}>
          {ACTIVITY_LEVELS.map(([f, label]) => <option key={f} value={f}>{label}</option>)}
        </select>
      </label>
      {result ? (
        <div className="tdee-result">
          <div><span>Utrzymanie wagi</span><b>{result} kcal</b></div>
          <div><span>Redukcja (−500 kcal)</span><b>{deficit} kcal</b></div>
          <button type="button" className="secondary" onClick={() => onApply(deficit)}>Ustaw {deficit} kcal jako cel</button>
        </div>
      ) : <p className="muted small-text">Uzupełnij wiek, wzrost i wagę, aby zobaczyć wynik.</p>}
    </div>
  );
}
