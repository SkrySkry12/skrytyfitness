import React, { useEffect, useState } from "react";
import { Bell, Check, Globe, KeyRound, LogOut, Palette, Target, User } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { GoalFields, TdeeCalculator } from "../components/GoalsForm.jsx";
import { api } from "../lib/api.js";
import { COMMON_TIMEZONES } from "../lib/dates.js";
import { disablePush, enablePush } from "../lib/push.js";

function SaveButton({ busy, onClick, children }) {
  return <button type="button" className="primary full" disabled={busy} onClick={onClick}>{busy ? <Spinner /> : <Check size={17} />} {children}</button>;
}

export function Settings() {
  const { user, settings, saveSettings, logout, entries, reportError } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => {
    api("/api/push/status").then(r => setPushEnabled(Boolean(r.enabled))).catch(() => {});
  }, []);

  const patch = p => setDraft(d => ({ ...d, ...p }));
  const updateMeal = (id, p) => setDraft(d => ({ ...d, meals: d.meals.map(m => (m.id === id ? { ...m, ...p } : m)) }));

  const save = async (section, overrides = {}) => {
    setBusy(section);
    try { await saveSettings({ ...draft, ...overrides }); toast("Ustawienia zapisane"); }
    catch (err) { reportError(err); }
    finally { setBusy(""); }
  };

  const changePassword = async () => {
    if (pw.next.length < 12) { toast("Nowe hasło musi mieć co najmniej 12 znaków.", { type: "error" }); return; }
    setBusy("password");
    try {
      await api("/api/change-password", { method: "POST", body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      setPw({ current: "", next: "" });
      toast("Hasło zostało zmienione");
    } catch (err) { reportError(err); }
    finally { setBusy(""); }
  };

  const togglePush = async () => {
    setBusy("push");
    try {
      if (pushEnabled) {
        await disablePush();
        setPushEnabled(false);
        toast("Powiadomienia zostały wyłączone", { type: "info" });
      } else {
        await saveSettings(draft);
        await enablePush();
        setPushEnabled(true);
        toast("Powiadomienia o posiłkach są aktywne");
      }
    } catch (err) { reportError(err); }
    finally { setBusy(""); }
  };

  const latestWeight = entries.find(e => e.kind === "weight")?.data?.kg;
  const tzList = COMMON_TIMEZONES.includes(draft.timezone) ? COMMON_TIMEZONES : [draft.timezone, ...COMMON_TIMEZONES];

  return (
    <div className="page">
      <div className="page-intro"><p className="eyebrow">KONTO I PREFERENCJE</p><h1>Ustawienia</h1></div>

      <section className="card">
        <div className="card-title"><span className="icon-chip"><User size={18} /></span><div><h3>Twoje konto</h3><small className="muted">Zalogowano jako {user.username}</small></div></div>
        <button type="button" className="secondary full" onClick={logout}><LogOut size={16} /> Wyloguj się</button>
      </section>

      <section className="card">
        <div className="card-title"><span className="icon-chip"><Target size={18} /></span><div><h3>Moje cele</h3><small className="muted">Używane na pulpicie, w dzienniku i raportach</small></div></div>
        <GoalFields value={draft} onChange={patch} />
        <TdeeCalculator weight={latestWeight || draft.startWeight} onApply={kcal => { patch({ kcalTarget: kcal }); toast(`Ustawiono ${kcal} kcal — pamiętaj o zapisaniu`, { type: "info" }); }} />
        <SaveButton busy={busy === "goals"} onClick={() => save("goals")}>Zapisz cele</SaveButton>
      </section>

      <section className="card">
        <div className="card-title"><span className="icon-chip"><Palette size={18} /></span><div><h3>Wygląd i strefa czasowa</h3></div></div>
        <div className="theme-picker">
          {[["blue", "Niebieski"], ["pink", "Różowy"]].map(([id, label]) => (
            <button key={id} type="button" className={`theme-option theme-${id}` + (draft.theme === id ? " active" : "")} onClick={() => patch({ theme: id })}>
              <span className="theme-swatch" /> {label} {draft.theme === id && <Check size={16} />}
            </button>
          ))}
        </div>
        <label className="field"><span><Globe size={13} /> Strefa czasowa</span>
          <select value={draft.timezone} onChange={e => patch({ timezone: e.target.value })}>{tzList.map(tz => <option key={tz} value={tz}>{tz}</option>)}</select>
        </label>
        <SaveButton busy={busy === "look"} onClick={() => save("look")}>Zapisz wygląd</SaveButton>
      </section>

      <section className="card">
        <div className="card-title"><span className="icon-chip"><Bell size={18} /></span><div><h3>Przypomnienia o posiłkach</h3><small className="muted">Mają pomagać, a nie zmuszać do jedzenia o konkretnej porze.</small></div></div>
        <label className="switch-row">
          <input type="checkbox" checked={draft.remindersEnabled !== false} onChange={e => patch({ remindersEnabled: e.target.checked })} />
          <span>Włącz przypomnienia z harmonogramu</span>
        </label>
        <div className="meal-settings">
          {draft.meals.map(m => (
            <div className="meal-setting" key={m.id}>
              <label className="switch-row compact"><input type="checkbox" checked={m.enabled !== false} onChange={e => updateMeal(m.id, { enabled: e.target.checked })} /><span>{m.label}</span></label>
              <input type="time" aria-label={`Godzina: ${m.label}`} value={m.time} onChange={e => updateMeal(m.id, { time: e.target.value })} />
            </div>
          ))}
        </div>
        <SaveButton busy={busy === "meals"} onClick={() => save("meals")}>Zapisz harmonogram</SaveButton>
      </section>

      <section className="card">
        <div className="card-title"><span className="icon-chip"><Bell size={18} /></span><div><h3>Powiadomienia na telefonie</h3><small className="muted">iPhone / web push</small></div></div>
        <p className="muted small-text">Przypomnienia przyjdą również gdy aplikacja jest zamknięta — pod warunkiem instalacji PWA na ekranie początkowym i zgody systemu.</p>
        <div className="push-status"><span className={"status-dot" + (pushEnabled ? " on" : "")} />{pushEnabled ? "Powiadomienia są aktywne" : "Powiadomienia nie są jeszcze aktywne"}</div>
        <button type="button" className={pushEnabled ? "secondary full" : "primary full"} disabled={busy === "push"} onClick={togglePush}>
          {busy === "push" ? <Spinner /> : <Bell size={16} />} {pushEnabled ? "Wyłącz powiadomienia" : "Włącz powiadomienia"}
        </button>
        <small className="muted">Na iPhonie: dodaj aplikację do ekranu początkowego, otwórz ją z ikony i zaakceptuj zgodę na powiadomienia.</small>
      </section>

      <section className="card">
        <div className="card-title"><span className="icon-chip"><KeyRound size={18} /></span><div><h3>Zmiana hasła</h3></div></div>
        <div className="form-grid">
          <label className="field span-2"><span>Obecne hasło</span><input type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw(v => ({ ...v, current: e.target.value }))} /></label>
          <label className="field span-2"><span>Nowe hasło <small>(min. 12 znaków)</small></span><input type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw(v => ({ ...v, next: e.target.value }))} /></label>
        </div>
        <SaveButton busy={busy === "password"} onClick={changePassword}>Zmień hasło</SaveButton>
      </section>

      <section className="card">
        <h3>Ważne informacje</h3>
        <p className="muted">Plan treningowy jest ogólny i nie zastępuje zaleceń fizjoterapeuty. Przy bólu przerwij ćwiczenie. Kaloryczność to punkt startowy do obserwacji.</p>
      </section>
    </div>
  );
}

