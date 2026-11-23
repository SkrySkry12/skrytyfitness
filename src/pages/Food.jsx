import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, Clock3, History, Keyboard, PenLine, ScanBarcode, Search, Sparkles, Star, Utensils, X } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { Scanner, gtinValid } from "../components/Scanner.jsx";
import { searchLocalFoods } from "../lib/foods-pl.js";
import { WaterCard } from "../components/WaterCard.jsx";
import { foodTotals } from "./Dashboard.jsx";
import { api } from "../lib/api.js";
import { dayKey, minutesNowIn, relativeDayLabel, shiftDate, timeToMinutes } from "../lib/dates.js";
import { num, pl, round1 } from "../lib/format.js";
import { MEAL_CHOICES, defaultMealLabel } from "../lib/settings.js";

const emptyForm = { name: "", grams: "100", kcal: "", protein: "", carbs: "", fat: "" };
const FAV_KEY = "skr-food-favorites";
const favKey = p => p.barcode || p.id || p.name;
const stripProduct = p => ({
  name: p.name, brand: p.brand || "", barcode: p.barcode || "", id: p.id || "", kcal: num(p.kcal), protein: num(p.protein), carbs: num(p.carbs), fat: num(p.fat),
  servingGrams: p.servingGrams || null, servingSize: p.servingSize || "", image: p.image || "", local: !!p.local
});
const loadFavorites = () => {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};

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
  const [localResults, setLocalResults] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [picked, setPicked] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [manualEan, setManualEan] = useState(false);
  const [aiText, setAiText] = useState("");

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

  // Live search: built-in base answers instantly, Open Food Facts is queried with a debounce.
  useEffect(() => {
    const q = query.trim();
    setNotFound(false);
    if (q.length < 2) { setResults([]); setSearching(false); setSearchMsg(""); return; }
    setLocalResults(searchLocalFoods(q));
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setSearching(true); setSearchMsg("");
      try {
        const r = await api("/api/food/search?q=" + encodeURIComponent(q), { signal: ctrl.signal });
        setResults(r.products || []);
        if (r.warning) setSearchMsg(r.warning + " Pokazuję produkty z bazy podstawowej.");
        setNotFound(!(r.products || []).length && !searchLocalFoods(q).length);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setSearchMsg(err.message);
        setNotFound(!searchLocalFoods(q).length);
      } finally { if (!ctrl.signal.aborted) setSearching(false); }
    }, 400);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [query]);
  useEffect(() => { if (query.trim().length < 2) setLocalResults([]); }, [query]);

  const toggleFav = product => {
    setFavorites(list => {
      const key = favKey(product);
      const next = list.some(f => favKey(f) === key) ? list.filter(f => favKey(f) !== key) : [stripProduct(product), ...list].slice(0, 30);
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };
  const isFav = product => favorites.some(f => favKey(f) === favKey(product));

  const pick = raw => {
    const product = { ...raw, name: raw.name || (raw.brand ? `${raw.brand} (${raw.barcode || "produkt"})` : `Produkt ${raw.barcode || ""}`.trim()) };
    setPicked(product);
    const grams = product.servingGrams && product.servingGrams <= 500 ? product.servingGrams : 100;
    chooseProduct(product);
    applyPer100(product, grams);
    setQuery(""); setResults([]); setLocalResults([]); setNotFound(false); setAiResult(null); setAiMsg("");
    setSearchMsg("");
  };
  const clearPicked = () => { setPicked(null); setPer100(null); setForm(emptyForm); };

  const lookupBarcode = async (value = barcode) => {
    const code = String(value).replace(/\D/g, "");
    if (![8, 12, 13, 14].includes(code.length)) { setSearchMsg("Kod kreskowy musi mieć 8, 12 lub 13 cyfr."); return; }
    if (code.length !== 8 && !gtinValid(code)) { setSearchMsg(`Kod ${code} ma błędną cyfrę kontrolną — sprawdź, czy dobrze go przepisano.`); return; }
    setBarcode(code); setBarcodeBusy(true); setSearchMsg(""); setNotFound(false);
    try {
      const result = await api("/api/food/barcode/" + encodeURIComponent(code));
      if (!result.product) {
        setSearchMsg(result.message || `Nie znaleziono produktu o kodzie ${code}.`);
        setNotFound(true);
        toast("Brak produktu w bazie — opisz go i użyj AI albo wpisz wartości z etykiety", { type: "info" });
        return;
      }
      pick(result.product);
      if (!result.product.complete) setSearchMsg("Ten produkt ma niepełne wartości odżywcze w bazie — uzupełnij je z etykiety albo oszacuj przez AI.");
      else toast(`Znaleziono: ${result.product.name}`, { type: "success" });
      setManualEan(false);
    } catch (err) { setSearchMsg(err.message); reportError(err, { silent: true }); }
    finally { setBarcodeBusy(false); }
  };

  const estimateWithAI = async (description = form.name) => {
    const text = String(description || "").trim();
    if (text.length < 2) { setAiMsg("Opisz, co jesz, np. „2 jajka sadzone i kromka chleba z masłem”."); return; }
    const grams = num(form.grams);
    setAiBusy(true); setAiMsg(""); setAiResult(null);
    try {
      const r = await api("/api/ai/food-estimate", { method: "POST", body: JSON.stringify({ name: text, grams: picked || form.name.trim() === text ? (grams > 0 ? grams : null) : null }) });
      setPicked(null); setPer100(r.grams > 0 ? { name: r.name, kcal: r.kcal * 100 / r.grams, protein: r.protein * 100 / r.grams, carbs: r.carbs * 100 / r.grams, fat: r.fat * 100 / r.grams } : null);
      setForm({ name: r.name || text, grams: String(r.grams), kcal: String(r.kcal), protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat) });
      setAiResult(r);
      setAiMsg(r.note);
      setQuery(""); setNotFound(false);
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
      setForm(emptyForm); setPer100(null); setAiMsg(""); setSearchMsg(""); setPicked(null); setAiResult(null); setAiText("");
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
          <div className="search-title"><b><Search size={15} /> Znajdź produkt</b><span>BAZA PODSTAWOWA · OPEN FOOD FACTS</span></div>
          <div className="search-field">
            <Search size={17} />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Np. skyr, banan, pierś z kurczaka…" aria-label="Szukaj produktu" enterKeyHint="search" autoComplete="off" onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} />
            {searching ? <span className="clear-btn icon-btn" aria-hidden="true"><Spinner /></span>
              : query && <button type="button" className="clear-btn icon-btn" aria-label="Wyczyść wyszukiwanie" onClick={() => setQuery("")}><X size={16} /></button>}
          </div>
          <div className="search-tools">
            <button type="button" className="secondary" onClick={() => setScannerOpen(true)}><ScanBarcode size={18} /> Skanuj aparatem</button>
            <button type="button" className={"secondary" + (manualEan ? " active" : "")} onClick={() => setManualEan(v => !v)}><Keyboard size={18} /> Wpisz EAN</button>
          </div>
          {manualEan && (
            <form className="input-row" onSubmit={e => { e.preventDefault(); lookupBarcode(); }}>
              <input inputMode="numeric" autoFocus value={barcode} onChange={e => setBarcode(e.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="Cyfry spod kodu kreskowego (np. 590…)" aria-label="Kod kreskowy EAN" />
              <button className="primary" type="submit" disabled={barcodeBusy || barcode.length < 8}>{barcodeBusy ? <Spinner /> : "Szukaj"}</button>
            </form>
          )}
          {searchMsg && <p className="hint">{searchMsg}</p>}

          {(localResults.length > 0 || results.length > 0) && (
            <div className="results">
              {localResults.length > 0 && <span className="results-group">Baza podstawowa · wartości uśrednione</span>}
              {localResults.map(p => (
                <div className="result" key={p.id}>
                  <button type="button" className="result-main" onClick={() => pick(p)}>
                    <span className="result-ph"><Utensils size={17} /></span>
                    <span className="result-name"><b>{p.name}</b><small>{p.servingSize} = {p.servingGrams} g · B {round1(p.protein)} · W {round1(p.carbs)} · T {round1(p.fat)} /100 g</small></span>
                    <strong>{p.kcal}<small> kcal</small></strong>
                  </button>
                  <button type="button" className={"icon-btn fav-btn" + (isFav(p) ? " on" : "")} aria-label={isFav(p) ? "Usuń z ulubionych" : "Dodaj do ulubionych"} onClick={() => toggleFav(p)}><Star size={17} fill={isFav(p) ? "currentColor" : "none"} /></button>
                </div>
              ))}
              {results.length > 0 && <span className="results-group">Open Food Facts · produkty ze sklepów</span>}
              {results.map((p, i) => (
                <div className="result" key={p.barcode || p.name + i}>
                  <button type="button" className="result-main" onClick={() => pick(p)}>
                    {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="result-ph"><Utensils size={17} /></span>}
                    <span className="result-name"><b>{p.name}</b><small>{[p.brand, p.quantity].filter(Boolean).join(" · ") || "na 100 g"} · B {round1(p.protein)} · W {round1(p.carbs)} · T {round1(p.fat)}</small></span>
                    <strong>{p.kcal}<small> kcal</small></strong>
                  </button>
                  <button type="button" className={"icon-btn fav-btn" + (isFav(p) ? " on" : "")} aria-label={isFav(p) ? "Usuń z ulubionych" : "Dodaj do ulubionych"} onClick={() => toggleFav(p)}><Star size={17} fill={isFav(p) ? "currentColor" : "none"} /></button>
                </div>
              ))}
            </div>
          )}

          {notFound && !searching && (
            <div className="not-found">
              <b>{query.trim() ? `Nie znaleziono „${query.trim()}”` : `Brak produktu o kodzie ${barcode} w bazie`}</b>
              <small className="muted">Możesz poprosić AI o oszacowanie wartości albo wpisać je z etykiety.</small>
              <div className="row">
                <button type="button" className="primary" disabled={aiBusy} onClick={() => { if (query.trim()) { setAiText(query.trim()); estimateWithAI(query.trim()); } else { setNotFound(false); setAiMsg("Opisz produkt w polu AI poniżej (np. „baton proteinowy czekoladowy 60 g”) i kliknij „Oszacuj”."); } }}>{aiBusy ? <Spinner /> : <Sparkles size={16} />} Oszacuj przez AI</button>
                <button type="button" className="secondary" onClick={() => { setPicked(null); setPer100(null); setForm({ ...emptyForm, name: query.trim() }); setQuery(""); setNotFound(false); }}><PenLine size={16} /> Dodaj ręcznie</button>
              </div>
            </div>
          )}
          {query.trim().length >= 2 && (results.length > 0 || localResults.length > 0) && !searching && (
            <button type="button" className="ghost small" disabled={aiBusy} onClick={() => { setAiText(query.trim()); estimateWithAI(query.trim()); }}><Sparkles size={14} /> Nie ma tego? Oszacuj „{query.trim()}” przez AI</button>
          )}

          {!query && favorites.length > 0 && !picked && (
            <div className="results">
              <span className="results-group"><Star size={12} /> Ulubione</span>
              {favorites.map(p => (
                <div className="result" key={favKey(p)}>
                  <button type="button" className="result-main" onClick={() => pick(p)}>
                    {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="result-ph"><Utensils size={17} /></span>}
                    <span className="result-name"><b>{p.name}</b><small>{p.brand ? p.brand + " · " : ""}B {round1(p.protein)} · W {round1(p.carbs)} · T {round1(p.fat)} /100 g</small></span>
                    <strong>{Math.round(num(p.kcal))}<small> kcal</small></strong>
                  </button>
                  <button type="button" className="icon-btn fav-btn on" aria-label="Usuń z ulubionych" onClick={() => toggleFav(p)}><Star size={17} fill="currentColor" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {picked && (
          <div className="picked">
            <div className="picked-head">
              {picked.image ? <img src={picked.image} alt="" /> : <span className="result-ph"><Utensils size={20} /></span>}
              <div className="grow">
                <b>{picked.name}</b>
                <small>{[picked.brand, picked.local ? "baza podstawowa" : picked.barcode ? "EAN " + picked.barcode : null, `${picked.kcal ?? "?"} kcal / 100 g`].filter(Boolean).join(" · ")}</small>
              </div>
              <button type="button" className={"icon-btn fav-btn" + (isFav(picked) ? " on" : "")} aria-label="Ulubione" onClick={() => toggleFav(picked)}><Star size={17} fill={isFav(picked) ? "currentColor" : "none"} /></button>
              <button type="button" className="icon-btn" aria-label="Wyczyść wybór" onClick={clearPicked}><X size={16} /></button>
            </div>
            <div className="picked-macros">
              <div><b>{form.kcal || 0}</b><span>kcal</span></div>
              <div className="macro-protein"><b>{form.protein || 0}</b><span>białko g</span></div>
              <div className="macro-carbs"><b>{form.carbs || 0}</b><span>węgle g</span></div>
              <div className="macro-fat"><b>{form.fat || 0}</b><span>tłuszcz g</span></div>
            </div>
            <small className="muted">Dla {form.grams || 0} g — zmień ilość poniżej, wartości przeliczą się same.</small>
          </div>
        )}

        <form onSubmit={submit} className="food-form">
          <span className="field-label">Do którego posiłku dodajesz?</span>
          <div className="meal-picker">
            {MEAL_CHOICES.map(([label, icon]) => (
              <button type="button" key={label} className={"meal-chip" + (meal === label ? " active" : "")} onClick={() => setMeal(label)}><span aria-hidden="true">{icon}</span> {label}</button>
            ))}
          </div>
          <div className="form-grid">
            <label className="field span-2"><span>Nazwa produktu</span>
              <input required value={form.name} onChange={e => { setField({ name: e.target.value }); setPer100(null); setPicked(null); setAiMsg(""); }} placeholder="Np. owsianka, skyr, banan…" />
            </label>
            <label className="field span-2"><span>Ilość <small>(g / ml)</small></span>
              <input type="number" min="0" inputMode="decimal" value={form.grams} onChange={e => updateGrams(e.target.value)} />
            </label>
          </div>
          <div className="chip-row">
            {picked?.servingGrams > 0 && <button type="button" className={"chip" + (form.grams === String(picked.servingGrams) ? " active" : "")} onClick={() => updateGrams(String(picked.servingGrams))}>{picked.servingSize && !/^\s*[\d.,]+\s*(g|ml)\s*$/i.test(picked.servingSize) ? picked.servingSize : "porcja"} ({picked.servingGrams} g)</button>}
            {["50", "100", "150", "200", "250"].map(v => <button type="button" key={v} className={"chip" + (form.grams === v ? " active" : "")} onClick={() => updateGrams(v)}>{v} g</button>)}
          </div>
          <div className="ai-box">
            <label className="field"><span><Sparkles size={13} /> Opisz posiłek — AI policzy kalorie</span>
              <textarea rows={2} value={aiText} onChange={e => setAiText(e.target.value)} placeholder="Np. 2 jajka sadzone i kromka chleba z masłem" maxLength={300} />
            </label>
            <button type="button" className="secondary full" onClick={() => estimateWithAI(aiText.trim() || form.name)} disabled={aiBusy || !(aiText.trim() || form.name.trim())}>
              {aiBusy ? <Spinner /> : <Sparkles size={16} />} {aiBusy ? "Szacuję wartości…" : "Oszacuj kalorie i makro przez AI"}
            </button>
            {aiMsg && <p className="hint">{aiMsg}</p>}
            {aiResult?.items?.length > 0 && (
              <div className="ai-items">
                {aiResult.items.map((it, i) => <div key={i}><span>{it.name}{it.grams ? ` · ${Math.round(num(it.grams))} g` : ""}</span><b>{Math.round(num(it.kcal))} kcal</b></div>)}
              </div>
            )}
            <small className="muted">Szacunek AI (Abacus.AI) — sprawdź wartości przed zapisaniem. Wyszukiwarka, baza podstawowa i skaner EAN działają bez AI.</small>
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
          onManual={() => { setScannerOpen(false); setManualEan(true); }}
        />
      )}
    </div>
  );
}
