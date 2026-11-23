import React, { useMemo, useState } from "react";
import { Copy, Download, Sparkles } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { api } from "../lib/api.js";
import { dayKey, shiftDate } from "../lib/dates.js";
import { fmtKg, num, pl } from "../lib/format.js";

const plDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("pl-PL");

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function buildDailyReport({ entries, settings, today }) {
  const food = entries.filter(e => e.kind === "food" && dayKey(e) === today);
  const kcal = food.reduce((s, e) => s + num(e.data?.kcal), 0);
  const protein = food.reduce((s, e) => s + num(e.data?.protein), 0);
  const water = entries.filter(e => e.kind === "water" && dayKey(e) === today).reduce((s, e) => s + num(e.data?.ml), 0);
  const weight = entries.find(e => e.kind === "weight")?.data?.kg;
  const workout = entries.filter(e => e.kind === "workout" && dayKey(e) === today).map(e => e.data?.name || "Trening");
  return [
    "SKRYSKRY FITNESS — RAPORT DZIENNY",
    "Data: " + plDate(today),
    "Waga: " + (weight ? fmtKg(weight) + " kg" : "brak pomiaru"),
    "Kalorie: " + Math.round(kcal) + " / " + settings.kcalTarget + " kcal",
    "Białko: " + Math.round(protein) + " / " + settings.proteinTarget + " g",
    "Woda: " + (water / 1000).toFixed(2).replace(".", ",") + " / " + (settings.waterTargetMl / 1000).toFixed(1).replace(".", ",") + " l",
    "Trening: " + (workout.length ? workout.join(", ") : "brak")
  ].join("\n");
}

export function buildWeeklyReport({ entries, today }) {
  const from = shiftDate(today, -6);
  const week = entries.filter(e => dayKey(e) >= from && dayKey(e) <= today);
  const food = week.filter(e => e.kind === "food");
  const days = new Set(food.map(dayKey)).size;
  const kcal = food.reduce((s, e) => s + num(e.data?.kcal), 0);
  const protein = food.reduce((s, e) => s + num(e.data?.protein), 0);
  const water = week.filter(e => e.kind === "water").reduce((s, e) => s + num(e.data?.ml), 0);
  const workouts = week.filter(e => e.kind === "workout").length;
  const weights = week.filter(e => e.kind === "weight").sort((a, b) => dayKey(a).localeCompare(dayKey(b)));
  return [
    "SKR FITNESS — RAPORT 7 DNI",
    "Okres: " + plDate(from) + " – " + plDate(today),
    "Produkty zapisane: " + food.length,
    "Dni z wpisami jedzenia: " + days,
    "Średnie kalorie na dzień z wpisami: " + (days ? Math.round(kcal / days) : 0) + " kcal",
    "Białko łącznie: " + Math.round(protein) + " g",
    "Woda łącznie: " + (water / 1000).toFixed(1).replace(".", ",") + " l",
    "Treningi zapisane: " + workouts,
    "Pomiary: " + (weights.length ? weights.map(e => fmtKg(e.data?.kg) + " kg (" + plDate(dayKey(e)) + ")").join(", ") : "brak")
  ].join("\n");
}

export function Reports() {
  const { entries, settings, today, reportError } = useApp();
  const toast = useToast();
  const [ai, setAi] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const daily = useMemo(() => buildDailyReport({ entries, settings, today }), [entries, settings, today]);
  const weekly = useMemo(() => buildWeeklyReport({ entries, today }), [entries, today]);
  const workoutsWeek = entries.filter(e => e.kind === "workout" && dayKey(e) >= shiftDate(today, -6)).length;

  const copy = async text => toast(await copyText(text) ? "Skopiowano do schowka" : "Nie udało się skopiować", { type: "info" });
  const analyse = async () => {
    setAiBusy(true); setAi("");
    try {
      const r = await api("/api/ai/coach", { method: "POST" });
      setAi(r.analysis);
    } catch (err) { setAi(err.message); reportError(err, { silent: true }); }
    finally { setAiBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">PODSUMOWANIE</p>
        <h1>Raporty i analiza.</h1>
        <p className="muted">Raport tygodniowy obejmuje ostatnie 7 dni ({pl(workoutsWeek, "trening", "treningi", "treningów")}).</p>
      </div>
      <section className="card">
        <h3>Raport dzienny</h3>
        <pre className="report">{daily}</pre>
        <button type="button" className="secondary full" onClick={() => copy(daily)}><Copy size={16} /> Kopiuj raport dzienny</button>
      </section>
      <section className="card">
        <h3>Podsumowanie 7 dni</h3>
        <pre className="report">{weekly}</pre>
        <div className="row gap wrap">
          <button type="button" className="secondary grow" onClick={() => copy(weekly)}><Copy size={16} /> Kopiuj</button>
          <button type="button" className="primary grow" onClick={analyse} disabled={aiBusy}>{aiBusy ? <Spinner /> : <Sparkles size={16} />} {aiBusy ? "Analizuję…" : "Analizuj tydzień przez AI"}</button>
        </div>
        {ai && <div className="ai-result">{ai}</div>}
      </section>
      <section className="card">
        <h3>Kopia danych</h3>
        <p className="muted">Pobierz wszystkie zapisane wpisy i ustawienia (plik JSON), aby zachować własną kopię.</p>
        <button type="button" className="secondary full" onClick={() => { window.location.href = "/api/export"; }}><Download size={16} /> Eksportuj kopię danych</button>
      </section>
    </div>
  );
}
