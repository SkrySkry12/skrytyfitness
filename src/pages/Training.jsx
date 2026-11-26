import React, { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Minus, Pencil, PlayCircle, Plus, Shuffle, Trash2 } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { BottomSheet } from "../components/BottomSheet.jsx";
import { RestTimer } from "../components/RestTimer.jsx";
import { Spinner } from "../components/Spinner.jsx";
import { ExerciseDemo } from "../exercises-animations.jsx";
import { PLANS, EXERCISES, MUSCLES, CARDIO_EXERCISES, CARDIO_ICONS, exerciseLabel, exerciseKey, findExercise, alternativesFor, animationFor, parseScheme, isCardio, cardioSummary } from "../lib/exercises.js";
import { dayKey, formatLong, formatDayMonth, shiftMonth } from "../lib/dates.js";
import { fmtKg, num, pl } from "../lib/format.js";

const CONFIRM_LOSE = "Stracisz niezapisane zmiany. Kontynuować?";

/** Display name for a saved exercise (legacy English names get the Polish label). */
export function displayExerciseName(ex) {
  const lib = (ex?.exId && EXERCISES[ex.exId]) || findExercise(ex?.name);
  return lib ? exerciseLabel(lib) : ex?.name || "Ćwiczenie";
}

const setSummary = sets => sets.map((s, j) => `S${j + 1}: ${fmtKg(s.kg || 0)} kg × ${s.reps || 0}`).join(" · ");
/** Summary of a saved exercise: cardio → "20 min · 2,5 km …", strength → sets. */
const exerciseSummary = ex => (isCardio(ex) ? cardioSummary(ex.sets?.[0]) : setSummary(ex.sets || []));
const cardioCounts = s => Boolean(s?.done) || num(s?.minutes ?? s?.reps) > 0;
const EMPTY_CARDIO = { minutes: "", km: "", level: "", incline: "", kcal: "", done: false };
const CARDIO_FIELDS = [
  ["minutes", "Czas", "min", "numeric", "1"], ["km", "Dystans", "km", "decimal", "0.1"],
  ["level", "Prędkość / poziom", "", "decimal", "0.5"], ["incline", "Nachylenie", "% · opcjonalnie", "decimal", "0.5"],
  ["kcal", "Kalorie", "kcal", "numeric", "1"]
];
const cardioItem = (lib, name) => lib
  ? { key: lib.id, exId: lib.id, name: exerciseLabel(lib), short: lib.name, original: lib.original, muscle: "Cardio", cardio: true, custom: false }
  : { key: exerciseKey({ name }), name, short: name, muscle: "Cardio", cardio: true, custom: true };
const blank0 = v => (num(v) ? String(v) : ""); // show empty fields instead of "0"
const toCardioForm = s => ({
  minutes: blank0(s?.minutes ?? s?.reps), km: blank0(s?.km), level: blank0(s?.level),
  incline: blank0(s?.incline), kcal: blank0(s?.kcal), done: Boolean(s?.done)
});

/** "3×10 @ 40 kg" when all done sets are equal, otherwise "10@40 · 8@42,5". */
function compactSets(sets) {
  if (!sets.length) return "";
  if (sets[0]?.minutes != null) return cardioSummary(sets[0]);
  const same = sets.every(s => num(s.kg) === num(sets[0].kg) && num(s.reps) === num(sets[0].reps));
  if (same) return `${sets.length}×${num(sets[0].reps)}${num(sets[0].kg) ? ` @ ${fmtKg(sets[0].kg)} kg` : ""}`;
  return sets.map(s => `${num(s.reps)}${num(s.kg) ? "@" + fmtKg(s.kg) : ""}`).join(" · ");
}

/** Calendar badge: plan letter, "CARDIO" for cardio-only days, "A+🏃" when cardio was added to a plan. */
function calendarBadge(e) {
  const hasCardio = (e.data?.exercises || []).some(isCardio);
  const short = PLANS[e.data?.plan]?.short;
  if (!short) return hasCardio ? "CARDIO" : "✓";
  return hasCardio ? short + "+🏃" : short;
}

export function Training() {
  const { entries, today, createEntry, updateEntry, deleteEntry, reportError } = useApp();
  const toast = useToast();
  const [workoutDate, setWorkoutDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [plan, setPlan] = useState("A");
  const [editingId, setEditingId] = useState(null);
  const [sets, setSets] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customExercises, setCustomExercises] = useState({});
  const [newEx, setNewEx] = useState({ name: "", sets: "3", reps: "10", muscle: "Inne" });
  const [demo, setDemo] = useState(null);
  const [restKey, setRestKey] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [cardio, setCardio] = useState([]); // cardio items for the selected day (independent of the plan)
  const [swaps, setSwaps] = useState({}); // { [plan]: { [planExId]: alternativeExId } } — "Alternatywa" button

  const workouts = useMemo(() => entries.filter(e => e.kind === "workout"), [entries]);
  const workoutsByDate = useMemo(() => workouts.reduce((acc, e) => { (acc[dayKey(e)] ??= []).push(e); return acc; }, {}), [workouts]);
  const editingEntry = editingId ? workouts.find(e => e.id === editingId) : null;

  // Items = plan exercises + custom ones (from this session and from the entry being edited).
  const items = useMemo(() => {
    const base = PLANS[plan].items.map(([planId, scheme]) => {
      const exId = EXERCISES[swaps[plan]?.[planId]] ? swaps[plan][planId] : planId;
      const ex = EXERCISES[exId];
      return {
        key: exId, exId, name: exerciseLabel(ex), short: ex.name, original: ex.original, muscle: ex.muscle, scheme, custom: false,
        ...(exId !== planId ? { swappedFrom: planId } : {})
      };
    });
    const saved = (editingEntry?.data?.plan === plan ? editingEntry.data.exercises || [] : [])
      .filter(ex => ex.custom && !isCardio(ex))
      .map(ex => ({ name: ex.name, muscle: ex.muscle || "Inne", scheme: `${Math.max(1, (ex.sets || []).length)} × ${ex.sets?.[0]?.reps || 10}` }));
    const extras = [...saved, ...(customExercises[plan] || [])].map(c => ({
      key: exerciseKey({ name: c.name }), name: c.name, short: c.name, muscle: c.muscle, scheme: c.scheme, custom: true
    }));
    const all = [...base];
    for (const c of extras) if (!all.some(i => i.key === c.key)) all.push(c);
    return all;
  }, [plan, editingEntry, customExercises, swaps]);

  // Last done sets per exercise key, from workouts before the selected day (or other entries that day).
  const previous = useMemo(() => {
    const map = {};
    const sorted = [...workouts].sort((a, b) => dayKey(b).localeCompare(dayKey(a)));
    for (const w of sorted) {
      if (w.id === editingId || dayKey(w) > workoutDate) continue;
      for (const ex of w.data?.exercises || []) {
        const key = exerciseKey(ex);
        const done = (ex.sets || []).filter(s => (isCardio(ex) ? cardioCounts(s) : s.done));
        if (key && !map[key] && done.length) map[key] = { date: dayKey(w), sets: done };
      }
    }
    return map;
  }, [workouts, editingId, workoutDate]);

  const defaultSets = item => {
    const s = parseScheme(item.scheme);
    return Array.from({ length: s.sets }, () => ({ kg: "", reps: s.reps, done: false }));
  };
  const getSets = item => sets[item.key] || defaultSets(item);
  const writeSets = (item, next) => { setSets(cur => ({ ...cur, [item.key]: next })); setDirty(true); };

  const changeCount = (item, delta) => {
    const cur = getSets(item);
    const count = Math.max(1, Math.min(10, cur.length + delta));
    const reps = parseScheme(item.scheme).reps;
    writeSets(item, Array.from({ length: count }, (_, i) => cur[i] || { kg: cur[cur.length - 1]?.kg || "", reps, done: false }));
  };
  const updateSet = (item, index, field, value) => {
    const cur = getSets(item);
    if (field === "done" && value) setRestKey(Date.now());
    writeSets(item, cur.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };
  const copyPrevious = item => {
    const prev = previous[item.key];
    if (!prev) return;
    if (item.cardio) { writeSets(item, [{ ...toCardioForm(prev.sets[0]), done: false }]); return; }
    writeSets(item, prev.sets.map(s => ({ kg: String(s.kg ?? ""), reps: String(s.reps ?? ""), done: false })));
  };

  const loadEntry = entry => {
    const day = dayKey(entry);
    const p = PLANS[entry.data?.plan] ? entry.data.plan : plan;
    const loaded = {};
    const loadedCardio = [];
    for (const ex of entry.data?.exercises || []) {
      if (isCardio(ex)) {
        const lib = (ex.exId && EXERCISES[ex.exId]) || findExercise(ex.name);
        const item = cardioItem(lib?.cardio ? lib : null, ex.name);
        if (!loadedCardio.some(c => c.key === item.key)) loadedCardio.push(item);
        loaded[item.key] = [toCardioForm(ex.sets?.[0])];
        continue;
      }
      loaded[exerciseKey(ex)] = (ex.sets || []).map(s => ({ kg: String(s.kg ?? ""), reps: String(s.reps ?? ""), done: Boolean(s.done) }));
    }
    // Saved alternatives (e.g. Hip Thrust instead of Glute Bridge) → restore the swap on the plan position.
    if (PLANS[p]) {
      const planSwaps = {};
      for (const [planId] of PLANS[p].items) {
        if (loaded[planId]) continue;
        const alt = alternativesFor(planId).find(a => loaded[a.id]);
        if (alt) planSwaps[planId] = alt.id;
      }
      setSwaps(cur => ({ ...cur, [p]: planSwaps }));
    }
    setCardio(loadedCardio);
    setWorkoutDate(day); setMonth(day.slice(0, 7)); setPlan(p);
    setEditingId(entry.id); setSets(loaded); setDirty(false);
  };

  const changeWorkoutDate = day => {
    if (!day || day === workoutDate) return;
    if (dirty && !window.confirm(CONFIRM_LOSE)) return;
    const existing = workoutsByDate[day]?.[0];
    if (existing) loadEntry(existing);
    else { setWorkoutDate(day); setMonth(day.slice(0, 7)); setEditingId(null); setSets({}); setCardio([]); setDirty(false); }
  };

  const changePlan = k => {
    if (k === plan) return;
    if ((dirty || editingId) && !window.confirm(CONFIRM_LOSE)) return;
    // Cardio entered for this day stays when switching the strength plan.
    const cardioKeys = new Set(cardio.map(c => c.key));
    setPlan(k); setSets(cur => Object.fromEntries(Object.entries(cur).filter(([key]) => cardioKeys.has(key)))); setDirty(cardio.length > 0);
  };

  const getCardio = item => sets[item.key]?.[0] || EMPTY_CARDIO;
  const updateCardio = (item, field, value) => writeSets(item, [{ ...getCardio(item), [field]: value }]);
  const addCardio = item => {
    if (cardio.some(c => c.key === item.key)) { toast(`„${item.short}” jest już dodane — uzupełnij wyniki poniżej`, { type: "info" }); return; }
    setCardio(cur => [...cur, item]);
    writeSets(item, [{ ...EMPTY_CARDIO }]);
    toast(`Dodano cardio: ${item.short}`, { type: "info" });
  };
  const removeCardio = item => {
    setCardio(cur => cur.filter(c => c.key !== item.key));
    setSets(cur => { const next = { ...cur }; delete next[item.key]; return next; });
    setDirty(true);
  };

  // Candidates for the "Alternatywa" button: the original exercise + its library alternatives.
  const altCandidates = item => {
    const orig = item.swappedFrom || item.exId;
    if (!orig) return [];
    const alts = alternativesFor(orig);
    return alts.length ? [orig, ...alts.map(a => a.id)] : [];
  };
  const nextAlternative = (item, taken) => {
    const list = altCandidates(item);
    const start = list.indexOf(item.exId);
    for (let i = 1; i < list.length; i++) {
      const id = list[(start + i) % list.length];
      if (!taken.has(id)) return id;
    }
    return null;
  };
  const moveSets = (fromKey, toKey) => setSets(cur => {
    const next = { ...cur };
    if (next[fromKey]) next[toKey] = next[fromKey];
    delete next[fromKey];
    return next;
  });
  const swapExercise = item => {
    const next = nextAlternative(item, new Set(items.filter(i => i !== item).map(i => i.key)));
    if (!next) { toast("Pozostałe alternatywy są już w tym planie", { type: "info" }); return; }
    const orig = item.swappedFrom || item.exId;
    setSwaps(cur => {
      const planSwaps = { ...(cur[plan] || {}) };
      if (next === orig) delete planSwaps[orig]; else planSwaps[orig] = next;
      return { ...cur, [plan]: planSwaps };
    });
    moveSets(item.key, next); setDirty(true);
    toast(next === orig ? `Przywrócono: ${EXERCISES[next].name}` : `Zamieniono na: ${EXERCISES[next].name}`, { type: "info" });
  };
  const swapCardio = item => {
    const next = nextAlternative(item, new Set(cardio.filter(c => c !== item).map(c => c.key)));
    if (!next) { toast("Pozostałe alternatywy są już dodane", { type: "info" }); return; }
    const orig = item.swappedFrom || item.exId;
    const swapped = { ...cardioItem(EXERCISES[next]), ...(next !== orig ? { swappedFrom: orig } : {}) };
    setCardio(cur => cur.map(c => (c.key === item.key ? swapped : c)));
    moveSets(item.key, next); setDirty(true);
    toast(`Zamieniono na: ${EXERCISES[next].name}`, { type: "info" });
  };
  const altButton = (item, onSwap) => altCandidates(item).length > 0 && (
    <button type="button" className="demo-btn alt-btn" onClick={() => onSwap(item)} title="Alternatywa"
      aria-label={`Zamień ${item.short} na alternatywne ćwiczenie`}><Shuffle size={16} /> Alternatywa</button>
  );

  const addCustomExercise = () => {
    const typed = newEx.name.trim();
    if (!typed) return;
    // Library exercise picked from the suggestions → keep its full label, muscle group and demo.
    const lib = findExercise(typed);
    // Cardio picked from the library (or group "Cardio") → a cardio card with time/distance instead of kg × reps.
    if (lib?.cardio || (!lib && newEx.muscle === "Cardio")) {
      addCardio(cardioItem(lib?.cardio ? lib : null, typed));
      setNewEx(v => ({ ...v, name: "" }));
      return;
    }
    const name = lib ? exerciseLabel(lib) : typed;
    const scheme = `${Math.max(1, Math.min(10, Number(newEx.sets) || 3))} × ${Math.max(1, Math.min(100, Number(newEx.reps) || 10))}`;
    setCustomExercises(cur => ({ ...cur, [plan]: [...(cur[plan] || []), { name, muscle: lib?.muscle || newEx.muscle || "Inne", scheme }] }));
    setNewEx(v => ({ ...v, name: "" }));
    toast(`Dodano ćwiczenie „${name}”`, { type: "info" });
  };

  const saveWorkout = async () => {
    const exercises = items.map(item => ({
      ...(item.exId ? { exId: item.exId } : {}),
      name: item.name, muscle: item.muscle, custom: item.custom,
      sets: getSets(item).map(s => ({ kg: num(s.kg), reps: num(s.reps), done: Boolean(s.done) }))
    })).filter(ex => ex.sets.some(s => s.done || s.kg > 0));
    const cardioDone = cardio.map(item => {
      const c = getCardio(item);
      const minutes = num(c.minutes);
      return {
        ...(item.exId ? { exId: item.exId } : {}), name: item.name, muscle: "Cardio", cardio: true, custom: item.custom,
        sets: [{ minutes, km: num(c.km), level: num(c.level), incline: num(c.incline), kcal: num(c.kcal), done: Boolean(c.done), kg: 0, reps: minutes }]
      };
    }).filter(ex => cardioCounts(ex.sets[0]));
    if (!exercises.length && !cardioDone.length) {
      toast(cardio.length ? "Wpisz czas cardio albo oznacz je jako zrobione ✓." : "Oznacz co najmniej jedną serię jako wykonaną lub wpisz ciężar.", { type: "error" });
      return;
    }
    const cardioOnly = !exercises.length;
    exercises.push(...cardioDone);
    const data = {
      plan: cardioOnly ? "CARDIO" : plan,
      name: cardioOnly ? "Cardio" : PLANS[plan].name + (cardioDone.length ? " + cardio" : ""),
      exercises, completed: exercises.filter(ex => ex.sets.some(s => s.done)).map(ex => ex.name), total: items.length + cardio.length };
    setSaving(true);
    try {
      if (editingId) {
        await updateEntry(editingId, { date: workoutDate, data });
        toast("Zapisano zmiany treningu");
      } else {
        const created = await createEntry("workout", data, workoutDate);
        if (created?.id > 0) setEditingId(created.id);
        toast(created?.pending ? "Trening zapisany offline — wyślemy go po powrocie sieci" : "Trening zapisany 💪", { type: created?.pending ? "offline" : "success" });
      }
      setDirty(false);
    } catch (err) { reportError(err); }
    finally { setSaving(false); }
  };

  const removeWorkout = async entry => {
    if (!window.confirm("Usunąć ten trening?")) return;
    try {
      await deleteEntry(entry.id);
      if (entry.id === editingId) { setEditingId(null); setSets({}); setCardio([]); setDirty(false); }
      toast("Usunięto trening", {
        type: "info",
        action: { label: "Cofnij", onClick: () => createEntry("workout", entry.data, dayKey(entry)).catch(reportError) }
      });
    } catch (err) { reportError(err); }
  };

  // Calendar (Monday first)
  const monthDate = new Date(month + "-01T12:00:00");
  const offset = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const monthLabel = monthDate.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  const monthCount = workouts.filter(w => dayKey(w).startsWith(month)).length;
  const dayWorkouts = workoutsByDate[workoutDate] || [];

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">PLANER TRENINGOWY</p>
        <h1>Twój kalendarz</h1>
        <p className="muted">Wybierz dzień i plan, uzupełnij ciężar i powtórzenia. Przycisk „Demo” pokaże jak wykonać ćwiczenie. Bieżnię, orbitrek czy rower dodasz w „Strefie cardio” niżej.</p>
      </div>

      <section className="card calendar">
        <div className="calendar-head">
          <button type="button" className="icon-btn" aria-label="Poprzedni miesiąc" onClick={() => setMonth(m => shiftMonth(m, -1))}><ChevronLeft size={20} /></button>
          <div><h3>{monthLabel}</h3><small className="muted">{pl(monthCount, "trening", "treningi", "treningów")}</small></div>
          <button type="button" className="icon-btn" aria-label="Następny miesiąc" onClick={() => setMonth(m => shiftMonth(m, 1))}><ChevronRight size={20} /></button>
        </div>
        <div className="calendar-grid weekdays">{["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map(d => <span key={d}>{d}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((day, i) => day ? (
            <button type="button" key={day} onClick={() => changeWorkoutDate(day)}
              className={"calendar-day" + (day === workoutDate ? " selected" : "") + (day === today ? " today" : "") + (workoutsByDate[day] ? " has-workout" : "")}
              aria-label={formatLong(day) + (workoutsByDate[day] ? ", zapisany trening" : "")}>
              <b>{Number(day.slice(-2))}</b>
              {workoutsByDate[day] && <small>{workoutsByDate[day].map(calendarBadge).join(",")}</small>}
            </button>
          ) : <span key={"e" + i} className="calendar-empty" />)}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div><p className="eyebrow">{editingId ? "EDYCJA TRENINGU" : "WYBRANY DZIEŃ"}</p><h3 className="capitalize">{formatLong(workoutDate)}</h3></div>
          <input className="date-input" type="date" aria-label="Data treningu" value={workoutDate} onChange={e => changeWorkoutDate(e.target.value)} />
        </div>
        <p className="muted small-text">Jaki trening wykonujesz?</p>
        <div className="segmented">
          {Object.entries(PLANS).map(([k, p]) => <button key={k} type="button" className={plan === k ? "active" : ""} onClick={() => changePlan(k)}>{p.short}</button>)}
        </div>
        <h3 className="plan-name">{PLANS[plan].name}</h3>
        <p className="muted small-text">{PLANS[plan].focus}</p>
      </section>

      {items.map((item, idx) => {
        const list = getSets(item);
        const prev = previous[item.key];
        const scheme = parseScheme(item.scheme);
        const doneCount = list.filter(s => s.done).length;
        return (
          <article className={"card exercise-card" + (doneCount === list.length ? " complete" : "")} key={plan + item.key} style={{ animationDelay: idx * 40 + "ms" }}>
            <div className="exercise-head">
              <div className="exercise-title">
                <b>{item.short}</b>
                {item.original && <small className="muted">({item.original})</small>}
                <span className="muscle-tag">{item.muscle}{item.custom ? " · własne" : ""} · plan: {item.scheme}</span>
                {item.swappedFrom && <span className="swapped-tag">zamienione · zamiast: {EXERCISES[item.swappedFrom].name}</span>}
              </div>
              <div className="exercise-actions">
                <button type="button" className="demo-btn" onClick={() => setDemo(item)} aria-label={`Pokaż demo: ${item.short}`}><PlayCircle size={18} /> Demo</button>
                {altButton(item, swapExercise)}
              </div>
            </div>
            {prev && (
              <div className="previous-result">
                <span>Ostatnio ({formatDayMonth(prev.date)}): <b>{compactSets(prev.sets)}</b></span>
                <button type="button" className="link-btn" onClick={() => copyPrevious(item)}><Copy size={13} /> Wpisz to samo</button>
              </div>
            )}
            <div className="set-controls">
              <span>Serie: {doneCount}/{list.length}</span>
              <div className="stepper">
                <button type="button" aria-label={`Usuń serię z ${item.short}`} disabled={list.length <= 1} onClick={() => changeCount(item, -1)}><Minus size={16} /></button>
                <b>{list.length}</b>
                <button type="button" aria-label={`Dodaj serię do ${item.short}`} disabled={list.length >= 10} onClick={() => changeCount(item, 1)}><Plus size={16} /></button>
              </div>
            </div>
            <div className="set-table">
              <div className="set-row head"><span>#</span><span>KG</span><span>{scheme.seconds ? "SEKUNDY" : "POWT."}</span><span>✓</span></div>
              {list.map((s, i) => (
                <div className={"set-row" + (s.done ? " done" : "")} key={i}>
                  <b>{i + 1}</b>
                  <input aria-label={`Ciężar, seria ${i + 1}`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="0" value={s.kg} onChange={e => updateSet(item, i, "kg", e.target.value)} />
                  <div className="stepper reps">
                    <button type="button" aria-label="Odejmij powtórzenie" onClick={() => updateSet(item, i, "reps", String(Math.max(0, num(s.reps) - 1)))}><Minus size={14} /></button>
                    <input aria-label={`Powtórzenia, seria ${i + 1}`} type="number" inputMode="numeric" min="0" value={s.reps} onChange={e => updateSet(item, i, "reps", e.target.value)} />
                    <button type="button" aria-label="Dodaj powtórzenie" onClick={() => updateSet(item, i, "reps", String(num(s.reps) + 1))}><Plus size={14} /></button>
                  </div>
                  <button type="button" className={"done-toggle" + (s.done ? " on" : "")} aria-pressed={s.done}
                    aria-label={s.done ? "Oznacz serię jako niewykonaną" : "Oznacz serię jako wykonaną"} onClick={() => updateSet(item, i, "done", !s.done)}>
                    {s.done ? <Check size={18} /> : null}
                  </button>
                </div>
              ))}
            </div>
          </article>
        );
      })}

      <section className="card cardio-zone">
        <div className="card-head">
          <div><p className="eyebrow">STREFA CARDIO</p><h3>Bieżnia, orbitrek, rower…</h3></div>
          <span className="cardio-badge">❤️ cardio</span>
        </div>
        <p className="muted small-text">Kliknij, na czym ćwiczysz — dodasz to do treningu z tego dnia (możesz połączyć np. plan {PLANS[plan].short} + bieżnię albo zrobić samo cardio).</p>
        <div className="cardio-quick">
          {CARDIO_EXERCISES.map(ex => {
            const added = cardio.some(c => c.key === ex.id);
            return (
              <button type="button" key={ex.id} className={"cardio-chip" + (added ? " added" : "")} aria-pressed={added} onClick={() => addCardio(cardioItem(ex))}>
                <span aria-hidden="true">{CARDIO_ICONS[ex.id] || "❤️"}</span> {ex.name}{added ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        {!cardio.length && <small className="muted">Wskazówka: na początek wystarczy 15–20 minut w tempie, w którym możesz jeszcze mówić.</small>}
      </section>

      {cardio.map(item => {
        const c = getCardio(item);
        const prev = previous[item.key];
        return (
          <article className={"card exercise-card cardio-card" + (c.done ? " complete" : "")} key={"cardio-" + item.key}>
            <div className="exercise-head">
              <div className="exercise-title">
                <b><span aria-hidden="true">{CARDIO_ICONS[item.exId] || "❤️"}</span> {item.short}</b>
                {item.original && <small className="muted">({item.original})</small>}
                <span className="muscle-tag cardio-tag">Cardio{item.custom ? " · własne" : ""}</span>
                {item.swappedFrom && <span className="swapped-tag">zamienione · zamiast: {EXERCISES[item.swappedFrom].name}</span>}
              </div>
              <div className="row gap wrap-end">
                <button type="button" className="demo-btn" onClick={() => setDemo(item)} aria-label={`Pokaż wskazówki: ${item.short}`}><PlayCircle size={18} /> Demo</button>
                {altButton(item, swapCardio)}
                <button type="button" className="icon-btn" onClick={() => removeCardio(item)} aria-label={`Usuń cardio: ${item.short}`}><Trash2 size={16} /></button>
              </div>
            </div>
            {prev && (
              <div className="previous-result">
                <span>Ostatnio ({formatDayMonth(prev.date)}): <b>{compactSets(prev.sets)}</b></span>
                <button type="button" className="link-btn" onClick={() => copyPrevious(item)}><Copy size={13} /> Wpisz to samo</button>
              </div>
            )}
            <div className="cardio-grid">
              {CARDIO_FIELDS.map(([field, label, unit, mode, step]) => (
                <label className="field" key={field}>
                  <span>{label}{unit && <small> ({unit})</small>}</span>
                  <input type="number" min="0" step={step} inputMode={mode} placeholder="0" value={c[field]} onChange={e => updateCardio(item, field, e.target.value)} />
                </label>
              ))}
              <button type="button" className={"cardio-done" + (c.done ? " on" : "")} aria-pressed={c.done} onClick={() => updateCardio(item, "done", !c.done)}>
                <Check size={18} /> {c.done ? "Zrobione" : "Oznacz jako zrobione"}
              </button>
            </div>
            {num(c.minutes) > 0 && <small className="muted">{cardioSummary({ minutes: num(c.minutes), km: num(c.km), level: num(c.level), incline: num(c.incline), kcal: num(c.kcal) })}</small>}
          </article>
        );
      })}

      <section className="card">
        <h3>Dodaj własne ćwiczenie</h3>
        <div className="form-grid">
          <label className="field span-2"><span>Nazwa</span><input list="exercise-library" placeholder="Np. Podciąganie na drążku" value={newEx.name} onChange={e => setNewEx(v => ({ ...v, name: e.target.value }))} /></label>
          <label className="field"><span>Serie</span><input type="number" min="1" max="10" value={newEx.sets} onChange={e => setNewEx(v => ({ ...v, sets: e.target.value }))} /></label>
          <label className="field"><span>Powtórzenia</span><input type="number" min="1" max="100" value={newEx.reps} onChange={e => setNewEx(v => ({ ...v, reps: e.target.value }))} /></label>
          <label className="field span-2"><span>Partia mięśniowa</span>
            <select value={newEx.muscle} onChange={e => setNewEx(v => ({ ...v, muscle: e.target.value }))}>{MUSCLES.map(m => <option key={m}>{m}</option>)}</select>
          </label>
        </div>
        <datalist id="exercise-library">
          {Object.values(EXERCISES).map(ex => <option key={ex.id} value={exerciseLabel(ex)}>{ex.original}</option>)}
        </datalist>
        <small className="muted">Zacznij pisać, aby wybrać ćwiczenie z biblioteki (z animacją) albo wpisz własną nazwę.</small>
        <button type="button" className="secondary full" onClick={addCustomExercise} disabled={!newEx.name.trim()}><Plus size={16} /> Dodaj ćwiczenie</button>
      </section>

      <div className="sticky-save">
        <button type="button" className="primary full" onClick={saveWorkout} disabled={saving}>
          {saving ? <Spinner /> : <Check size={18} />} {editingId ? "Zapisz zmiany treningu" : "Zapisz trening na ten dzień"}
        </button>
      </div>

      <section className="card">
        <div className="card-head"><h3>Treningi w wybranym dniu</h3><span className="muted small-text">{pl(dayWorkouts.length, "zapisany", "zapisane", "zapisanych")}</span></div>
        {dayWorkouts.map(entry => (
          <article className={"history-item" + (entry.id === editingId ? " active" : "")} key={entry.id}>
            <div className="card-head"><b>{entry.data?.name || "Trening"}</b>{entry.id === editingId && <span className="badge">edytujesz</span>}</div>
            {(entry.data?.exercises || []).map((ex, i) => (
              <div className="history-exercise" key={i}><b>{displayExerciseName(ex)}</b><span>{exerciseSummary(ex)}</span></div>
            ))}
            {!entry.data?.exercises?.length && <p className="muted">Zapisano trening bez szczegółowych wyników.</p>}
            <div className="row gap">
              <button type="button" className="secondary small" onClick={() => { if (!dirty || window.confirm(CONFIRM_LOSE)) loadEntry(entry); }}><Pencil size={14} /> Edytuj</button>
              <button type="button" className="danger-btn small" onClick={() => removeWorkout(entry)}><Trash2 size={14} /> Usuń</button>
            </div>
          </article>
        ))}
        {!dayWorkouts.length && <p className="muted">Brak zapisanego treningu. Uzupełnij wyniki powyżej i zapisz.</p>}
      </section>

      <section className="card">
        <h3>Ostatnie treningi</h3>
        <p className="muted small-text">Podgląd nie zmienia aktualnie wpisywanych wyników.</p>
        {workouts.slice(0, 10).map(entry => {
          const expanded = expandedId === entry.id;
          const doneEx = (entry.data?.exercises || []).filter(ex => (ex.sets || []).some(s => (isCardio(ex) ? cardioCounts(s) : s.done)));
          return (
            <article className="history-item" key={entry.id}>
              <div className="card-head">
                <div><b>{entry.data?.name || "Trening"}</b><small className="muted block">{formatLong(dayKey(entry))}</small></div>
                <button type="button" className="secondary small" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : entry.id)}>{expanded ? "Ukryj" : "Podgląd"}</button>
              </div>
              {expanded && (
                <div className="preview-panel">
                  {doneEx.map((ex, i) => (
                    <div className="history-exercise" key={i}><b>{displayExerciseName(ex)}</b>
                      <span>{isCardio(ex) ? cardioSummary(ex.sets?.[0]) : (ex.sets || []).map((s, j) => s.done ? `S${j + 1}: ${fmtKg(s.kg || 0)} kg × ${s.reps || 0}` : null).filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                  {!doneEx.length && <p className="muted">Brak serii oznaczonych jako wykonane w tym treningu.</p>}
                </div>
              )}
            </article>
          );
        })}
        {!workouts.length && <p className="muted">Jeszcze nie zapisano żadnego treningu.</p>}
      </section>

      <BottomSheet open={Boolean(demo)} onClose={() => setDemo(null)} title="Jak wykonać ćwiczenie">
        {demo && (() => {
          const { anim, generic, lib } = animationFor(demo);
          const exercise = lib || { name: demo.name, original: null, muscle: demo.muscle, anim, tips: "" };
          return <ExerciseDemo exercise={exercise} generic={generic} />;
        })()}
      </BottomSheet>

      {restKey && <RestTimer startKey={restKey} onClose={() => setRestKey(null)} />}
    </div>
  );
}
