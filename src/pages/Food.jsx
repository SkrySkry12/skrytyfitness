import React, { useEffect, useMemo, useState } from "react";
import { Bell, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock3, History, Search, Sparkles, Utensils, X } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Scanner } from "../components/Scanner.jsx";
import { WaterCard } from "../components/WaterCard.jsx";
import { foodTotals } from "./Dashboard.jsx";
import { api } from "../lib/api.js";
import { dayKey, minutesNowIn, relativeDayLabel, shiftDate, timeToMinutes } from "../lib/dates.js";
import { num, pl, round1 } from "../lib/format.js";
import { MEAL_CHOICES, defaultMealLabel } from "../lib/settings.js";

const emptyForm = { name: "", grams: "100", kcal: "", protein: "", carbs: "", fat: "" };

function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

export function Food() {
  const { entries, settings, today, createEntry, deleteEntry, reportError, navigate } = useApp();
  const toast = useToast();
  const clock = useNow();
  const [day, setDay] = useState(today);
  const [form, setForm] = useState(emptyForm);
  const [per100, setPer100] = useState(null); // product values per 100 g → rescaled with grams
  const [meal, setMeal] = useState(() => defaultMealLabel(settings));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const dayFood = useMemo(() => entries.filter(e => e.kind === "food" && dayKey(e) === day), [entries, day]);
  const totals = useMemo(() => foodTotals(dayFood), [dayFood]);

  // "Ostatnio dodane": 5 most frequent products from loaded history (latest values win).
  const recent = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (e.kind !== "food" || !e.data?.name) continue;
      const key = e.data.name.trim().toLowerCase();
      const cur = map.get(key);
      if (cur) cur.count++; else map.set(key, { count: 1, data: e.data });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5).map(v => v.data);
  }, [entries]);

  // Next meal from the schedule, in the user's timezone.
  const nextMeal = useMemo(() => {
    const now = minutesNowIn(settings.timezone);
    return settings.meals.filter(m => m.enabled !== false).map(m => {
      let diff = timeToMinutes(m.time) - now;
      const tomorrow = diff <= 0;
      if (tomorrow) diff += 1440;
      return { ...m, diff, tomorrow };
    }).sort((a, b) => a.diff - b.diff)[0];
  }, [settings, clock]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = patch => setForm(f => ({ ...f, ...patch }));
  const applyPer100 = (product, grams) => {
    const factor = Math.max(0, num(grams)) / 100;
    setField({
      grams: String(grams), kcal: String(Math.round(num(product.kcal) * factor)),
      protein: String(round1(num(product.protein) * factor)), carbs: String(round1(num(product.carbs) * factor)), fat: String(round1(num(product.fat) * factor))
    });
  };
  const updateGrams = value => {
    if (per100) applyPer100(per100, value);
    else setField({ grams: value });
  };

  const chooseProduct = product => {
    setPer100(product);
    setField({ name: product.name });
    applyPer100(product, 100);
    setResults([]);
    setSearchMsg("Wczytano wartości na 100 g. Możesz zmienić gramaturę.");
  };
  const chooseRecent = data => {
    const g = num(data.grams);
    const base = g > 0 ? { name: data.name, kcal: num(data.kcal) * 100 / g, protein: num(data.protein) * 100 / g, carbs: num(data.carbs) * 100 / g, fat: num(data.fat) * 100 / g } : null;
    if (base) { setPer100(base); setField({ name: data.name }); applyPer100(base, g); }
    else { setPer100(null); setForm({ name: data.name, grams: String(data.grams || ""), kcal: String(data.kcal ?? ""), protein: String(data.protein ?? ""), carbs: String(data.carbs ?? ""), fat: String(data.fat ?? "") }); }
    toast(`Wczytano „${data.name}” — sprawdź ilość i dodaj`, { type: "info" });
  };

  const searchFood = async e => {
    e?.preventDefault();
    if (query.trim().length < 2) { setSearchMsg("Wpisz przynajmniej 2 znaki."); return; }
    setSearching(true); setSearchMsg(""); setResults([]);
    try {
      const result = await api("/api/food/search?q=" + encodeURIComponent(query.trim()));
      setResults(result.products || []);
      if (!result.products?.length) setSearchMsg("Nie znaleziono produktu z kompletnymi wartościami odżywczymi. Spróbuj innej nazwy.");
    } catch (err) { setSearchMsg(err.message); reportError(err, { silent: true }); }
    finally { setSearching(false); }
  };

  const lookupBarcode = async (value = barcode) => {
    const code = String(value).replace(/\D/g, "");
    if (!/^\d{8,14}$/.test(code)) { setSearchMsg("Kod EAN powinien zawierać od 8 do 14 cyfr."); return; }
    setBarcode(code); setBarcodeBusy(true); setSearchMsg(""); setResults([]);
    try {
      const result = await api("/api/food/barcode/" + encodeURIComponent(code));
      if (!result.product) { setSearchMsg("Nie znaleziono produktu o tym kodzie. Możesz wyszukać go po nazwie lub dodać ręcznie."); return; }
      chooseProduct(result.product);
    } catch (err) { setSearchMsg(err.message); reportError(err, { silent: true }); }
    finally { setBarcodeBusy(false); }
  };

  const estimateWithAI = async () => {
    if (!form.name.trim()) { setAiMsg("Najpierw wpisz nazwę dania, np. spaghetti bolognese."); return; }
    const grams = Math.max(1, num(form.grams) || 100);
    setAiBusy(true); setAiMsg("");
    try {
      const r = await api("/api/ai/food-estimate", { method: "POST", body: JSON.stringify({ name: form.name.trim(), grams }) });
      setPer100(null);
      setField({ kcal: String(r.kcal), protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat) });
      setAiMsg(r.note || "AI oszacowało wartości dla podanej porcji. To przybliżenie.");
    } catch (err) { setAiMsg(err.message); reportError(err, { silent: true }); }
    finally { setAiBusy(false); }
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim() || form.kcal === "") { toast("Wpisz nazwę produktu i liczbę kalorii.", { type: "error" }); return; }
    const data = { name: form.name.trim(), grams: num(form.grams), kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat), meal };
    setSaving(true);
    try {
      const created = await createEntry("food", data, day);
      toast(created?.pending ? `Zapisano offline: ${data.name}` : `Dodano: ${data.name} (${Math.round(data.kcal)} kcal)`, {
        type: created?.pending ? "offline" : "success",
        action: { label: "Cofnij", onClick: () => deleteEntry(created.id).catch(reportError) }
      });
      setForm(emptyForm); setPer100(null); setAiMsg(""); setSearchMsg("");
    } catch (err) { reportError(err); }
    finally { setSaving(false); }
  };

  const removeFood = async entry => {
    try {
      await deleteEntry(entry.id);
      toast(`Usunięto: ${entry.data?.name}`, {
        type: "info",
        action: { label: "Cofnij", onClick: () => createEntry("food", entry.data, dayKey(entry)).catch(reportError) }
      });
    } catch (err) { reportError(err); }
  };

  const kcalTarget = settings.kcalTarget;
  const remaining = kcalTarget - Math.round(totals.kcal);
  const mealLabels = MEAL_CHOICES.map(([m]) => m);
  const groups = [...mealLabels, ...new Set(dayFood.map(e => e.data?.meal).filter(m => m && !mealLabels.includes(m)))];
  const hours = Math.floor((nextMeal?.diff || 0) / 60), mins = (nextMeal?.diff || 0) % 60;

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">DZIENNIK ŻYWIENIOWY</p>
        <h1>Co dziś jesz?</h1>
      </div>

      <div className="day-switcher" role="group" aria-label="Wybór dnia">
        <button type="button" className="icon-btn" aria-label="Poprzedni dzień" onClick={() => setDay(d => shiftDate(d, -1))}><ChevronLeft size={20} /></button>
        <button type="button" className="day-label" onClick={() => setDay(today)} title="Wróć do dziś">{relativeDayLabel(day, today)}</button>
        <button type="button" className="icon-btn" aria-label="Następny dzień" onClick={() => setDay(d => shiftDate(d, 1))}><ChevronRight size={20} /></button>
      </div>

      <section className="card food-summary">
        <div className="card-head">
          <div><span className="eyebrow">SPOŻYCIE · {relativeDayLabel(day, today).toUpperCase()}</span><strong className="kcal-big">{Math.round(totals.kcal)} <small>/ {kcalTarget} kcal</small></strong></div>
          <div className={"kcal-left" + (remaining < 0 ? " over" : "")}><b>{Math.abs(remaining)}</b><small>{remaining < 0 ? "kcal ponad cel" : "kcal pozostało"}</small></div>
        </div>
        <div className="progress kcal"><span style={{ width: Math.min(100, (totals.kcal / kcalTarget) * 100) + "%" }} /></div>
        <div className="macro-grid">
          {[["protein", "Białko", totals.p, settings.proteinTarget], ["carbs", "Węglowodany", totals.c, settings.carbsTarget], ["fat", "Tłuszcze", totals.f, settings.fatTarget]].map(([id, label, v, t]) => (
            <div className={`macro macro-${id}`} key={id}>
              <span>{label}</span><b>{Math.round(v)}<small> / {t} g</small></b>
              <div className="progress"><span style={{ width: Math.min(100, (v / t) * 100) + "%" }} /></div>
            </div>
          ))}
        </div>
      </section>

      {day === today && (
        <section className="card meal-schedule">
          <div className="card-head">
            <div><p className="eyebrow">TWÓJ RYTM DNIA</p><h3>Plan posiłków</h3></div>
            <span className="pill"><Bell size={13} /> {settings.remindersEnabled !== false ? "przypomnienia wł." : "przypomnienia wył."}</span>
          </div>
          <div className="next-meal">
            <span className="icon-chip"><Clock3 size={20} /></span>
            <div className="grow">
              <span className="eyebrow">{nextMeal?.tomorrow ? "NASTĘPNY POSIŁEK (JUTRO)" : "KOLEJNY POSIŁEK"}</span>
              <b>{nextMeal ? nextMeal.label : "Ustaw godziny posiłków"}</b>
              <small className="muted">{nextMeal ? `${nextMeal.time} · za ${hours ? hours + " h " : ""}${mins} min` : "Włącz posiłki w ustawieniach"}</small>
            </div>
            <button type="button" className="secondary small" onClick={() => navigate("settings")}>Edytuj</button>
          </div>
          <div className="meal-timeline">
            {settings.meals.filter(m => m.enabled !== false).map(m => {
              const logged = dayFood.some(e => e.data?.meal === m.label);
              return (
                <div className={"timeline-item" + (logged ? " logged" : "")} key={m.id}>
                  <span className="timeline-dot" />
                  <div><b>{m.label}</b><small>{m.time}</small></div>
                  <span className="timeline-status">{logged ? <><CheckCircle2 size={14} /> Zapisano</> : "Plan"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><div><p className="eyebrow">NOWY WPIS</p><h3>Dodaj do dziennika</h3></div></div>

        {recent.length > 0 && (
          <div className="recent-products">
            <span className="field-label"><History size={14} /> Ostatnio dodane</span>
            <div className="chip-scroll">
              {recent.map(r => <button type="button" key={r.name} className="chip" onClick={() => chooseRecent(r)}>{r.name} <small>{Math.round(num(r.kcal))} kcal</small></button>)}
            </div>
          </div>
        )}

        <div className="search-box">
          <div className="search-title"><b><Search size={15} /> Znajdź produkt w bazie</b><span>OPEN FOOD FACTS</span></div>
          <form className="input-row" onSubmit={searchFood}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Np. skyr naturalny, płatki owsiane…" aria-label="Szukaj produktu" />
            <button className="primary" type="submit" disabled={searching}>{searching ? <Spinner /> : <Search size={16} />}<span className="hide-xs">Szukaj</span></button>
          </form>
          <form className="input-row" onSubmit={e => { e.preventDefault(); lookupBarcode(); }}>
            <input inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="Kod kreskowy EAN (np. 590…)" aria-label="Kod kreskowy" />
            <button className="secondary" type="submit" disabled={barcodeBusy}>{barcodeBusy ? <Spinner /> : "EAN"}</button>
            <button type="button" className="secondary" aria-label="Skanuj aparatem" onClick={() => setScannerOpen(true)}><Camera size={18} /></button>
          </form>
          {searchMsg && <p className="hint">{searchMsg}</p>}
          {results.length > 0 && (
            <div className="results">
              {results.map((p, i) => (
                <button type="button" className="result" key={p.barcode || p.name + i} onClick={() => chooseProduct(p)}>
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="result-ph"><Utensils size={17} /></span>}
                  <span className="result-name"><b>{p.name}</b><small>{p.quantity || "Wartości na 100 g"} · B {round1(p.protein)} · W {round1(p.carbs)} · T {round1(p.fat)}</small></span>
                  <strong>{p.kcal}<small> kcal</small></strong>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="food-form">
          <span className="field-label">Do którego posiłku dodajesz?</span>
          <div className="meal-picker">
            {MEAL_CHOICES.map(([label, icon]) => (
              <button type="button" key={label} className={"meal-chip" + (meal === label ? " active" : "")} onClick={() => setMeal(label)}><span aria-hidden="true">{icon}</span> {label}</button>
            ))}
          </div>
          <div className="form-grid">
            <label className="field span-2"><span>Nazwa produktu</span>
              <input required value={form.name} onChange={e => { setField({ name: e.target.value }); setPer100(null); setAiMsg(""); }} placeholder="Np. owsianka, skyr, banan…" />
            </label>
            <label className="field span-2"><span>Ilość <small>(g / ml)</small></span>
              <input type="number" min="0" inputMode="decimal" value={form.grams} onChange={e => updateGrams(e.target.value)} />
            </label>
          </div>
          <div className="chip-row">
            {["50", "100", "150", "200", "250"].map(v => <button type="button" key={v} className={"chip" + (form.grams === v ? " active" : "")} onClick={() => updateGrams(v)}>{v} g</button>)}
          </div>
          <div className="ai-box">
            <button type="button" className="secondary full" onClick={estimateWithAI} disabled={aiBusy || !form.name.trim()}>
              {aiBusy ? <Spinner /> : <Sparkles size={16} />} {aiBusy ? "Szacuję wartości…" : "Oszacuj kalorie i makro przez AI"}
            </button>
            {aiMsg && <p className="hint">{aiMsg}</p>}
            <small className="muted">AI jest opcjonalne i wymaga klucza OpenAI API. Wyszukiwarka i skaner EAN działają bez niego.</small>
          </div>
          <div className="form-grid four">
            <label className="field"><span>Kalorie</span><input required type="number" min="0" inputMode="decimal" value={form.kcal} onChange={e => setField({ kcal: e.target.value })} placeholder="kcal" /></label>
            <label className="field macro-protein"><span>Białko</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.protein} onChange={e => setField({ protein: e.target.value })} placeholder="g" /></label>
            <label className="field macro-carbs"><span>Węgle</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.carbs} onChange={e => setField({ carbs: e.target.value })} placeholder="g" /></label>
            <label className="field macro-fat"><span>Tłuszcze</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.fat} onChange={e => setField({ fat: e.target.value })} placeholder="g" /></label>
          </div>
          <button className="primary full" type="submit" disabled={saving}>{saving ? <Spinner /> : "＋"} Dodaj do: {meal}</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head"><div><p className="eyebrow">TWOJE WPISY</p><h3>Posiłki · {relativeDayLabel(day, today)}</h3></div><span className="pill">{pl(dayFood.length, "produkt", "produkty", "produktów")}</span></div>
        {dayFood.length === 0 ? (
          <div className="empty"><span aria-hidden="true">🥗</span><b>Jeszcze nic tu nie ma</b><p className="muted">Dodaj pierwszy produkt, a podsumowanie dnia zaktualizuje się automatycznie.</p></div>
        ) : groups.filter(m => dayFood.some(e => e.data?.meal === m)).map(m => {
          const list = dayFood.filter(e => e.data?.meal === m);
          return (
            <div className="meal-group" key={m}>
              <div className="meal-group-title"><b>{m}</b><span>{Math.round(list.reduce((s, e) => s + num(e.data?.kcal), 0))} kcal</span></div>
              {list.map(e => (
                <div className={"food-item" + (e.pending ? " pending" : "")} key={e.id}>
                  <div className="food-item-info"><b>{e.data?.name}</b><small>{num(e.data?.grams)} g · B {round1(e.data?.protein)} · W {round1(e.data?.carbs)} · T {round1(e.data?.fat)}</small></div>
                  <strong>{Math.round(num(e.data?.kcal))}<small> kcal</small></strong>
                  <button type="button" className="icon-btn danger" aria-label={`Usuń ${e.data?.name}`} onClick={() => removeFood(e)}><X size={16} /></button>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <WaterCard date={day} />

      {scannerOpen && (
        <Scanner
          onDetected={code => { setScannerOpen(false); lookupBarcode(code); }}
          onError={msg => { setScannerOpen(false); setSearchMsg(msg); toast(msg, { type: "error" }); }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
