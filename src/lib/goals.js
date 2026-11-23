// Strength / fitness goals stored per user in settings.goals.
// Progress is always derived from saved workouts (done sets only), never stored.
import { EXERCISES, exerciseKey } from "./exercises.js";
import { dayKey } from "./dates.js";
import { fmtKg, num, plural } from "./format.js";

export const METRICS = {
  kg: { label: "Ciężar", unit: "kg", hint: "najcięższa ukończona seria" },
  reps: { label: "Powtórzenia", unit: "powt.", hint: "najwięcej powtórzeń w jednej serii" },
  seconds: { label: "Czas", unit: "s", hint: "najdłużej w jednej serii (wpisuj sekundy w polu POWT.)" }
};

export const GOAL_XP = 75;

/** Ready-made goals grouped by exercise, with plain-language hints. */
export const GOAL_TEMPLATES = [
  {
    group: "Podciąganie na drążku", exId: "pull-up",
    hint: "Na początku zwykle nie wychodzi ani jedno – to normalne. Ćwicz zwis i podciąganie z gumą, a pierwsze podciągnięcie przyjdzie.",
    goals: [
      { metric: "reps", target: 1, title: "Pierwsze podciągnięcie" },
      { metric: "reps", target: 5, title: "5 podciągnięć z rzędu" },
      { metric: "reps", target: 10, title: "10 podciągnięć z rzędu" }
    ]
  },
  {
    group: "Zwis na drążku", exId: "dead-hang",
    hint: "Wiszenie na drążku wzmacnia chwyt i przygotowuje do podciągania.",
    goals: [
      { metric: "seconds", target: 30, title: "Zwis 30 sekund" },
      { metric: "seconds", target: 60, title: "Zwis 1 minuta" }
    ]
  },
  {
    group: "Wyciskanie na maszynie (klatka)", exId: "chest-press",
    hint: "Maszyna, na której siedząc wypychasz uchwyty przed siebie (Chest Press). Liczy się ciężar ustawiony na maszynie.",
    goals: [
      { metric: "kg", target: 60, title: "Wyciskanie 60 kg" },
      { metric: "kg", target: 80, title: "Wyciskanie 80 kg" },
      { metric: "kg", target: 100, title: "Wyciskanie 100 kg" }
    ]
  },
  {
    group: "Suwnica (nogi)", exId: "leg-press",
    hint: "Maszyna, na której leżąc/siedząc wypychasz platformę nogami (Leg Press).",
    goals: [
      { metric: "kg", target: 100, title: "Suwnica 100 kg" },
      { metric: "kg", target: 150, title: "Suwnica 150 kg" },
      { metric: "kg", target: 200, title: "Suwnica 200 kg" }
    ]
  },
  {
    group: "Ściąganie drążka (plecy)", exId: "lat-pulldown",
    hint: "Siedząc ściągasz drążek z góry do klatki (Lat Pulldown) – świetne przygotowanie do podciągania.",
    goals: [
      { metric: "kg", target: 50, title: "Ściąganie 50 kg" },
      { metric: "kg", target: 70, title: "Ściąganie 70 kg" }
    ]
  },
  {
    group: "Pompki", exId: "push-ups",
    hint: "Klasyczne pompki na podłodze. Jeśli są za trudne, zacznij od pompek przy ścianie lub z dłońmi na krześle.",
    goals: [
      { metric: "reps", target: 10, title: "10 pompek z rzędu" },
      { metric: "reps", target: 20, title: "20 pompek z rzędu" },
      { metric: "reps", target: 30, title: "30 pompek z rzędu" }
    ]
  },
  {
    group: "Deska (plank)", exId: "plank",
    hint: "Podpór na przedramionach z prostym ciałem. Wpisuj czas w sekundach w polu POWT./SEKUNDY.",
    goals: [
      { metric: "seconds", target: 60, title: "Deska 60 sekund" },
      { metric: "seconds", target: 120, title: "Deska 2 minuty" }
    ]
  }
];

export const goalKey = g => `${g.exId}:${g.metric}:${num(g.target)}`;

export function formatValue(metric, value) {
  if (value == null) return "—";
  if (metric === "kg") return `${fmtKg(value)} kg`;
  if (metric === "seconds") return `${Math.round(value)} s`;
  const n = Math.round(value);
  return `${n} ${plural(n, "powtórzenie", "powtórzenia", "powtórzeń")}`;
}

export function defaultGoalTitle(exId, metric, target) {
  const ex = EXERCISES[exId];
  return `${ex ? ex.name : "Ćwiczenie"}: ${formatValue(metric, num(target))}`;
}

export function newGoal({ exId, metric, target, title }) {
  return {
    id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    exId, metric, target: num(target),
    title: ((title || "").trim() || defaultGoalTitle(exId, metric, target)).slice(0, 80),
    createdAt: new Date().toISOString().slice(0, 10)
  };
}

/** Value of a single done set for the given metric. */
const setValue = (metric, s) => {
  if (!s?.done) return 0;
  if (metric === "kg") return num(s.reps) > 0 || s.reps == null ? num(s.kg) : 0;
  return num(s.reps);
};

/**
 * Per-exercise history of bests: { [exKey]: { kg: [{date, value}], reps: [...], seconds: [...] } }
 * Each list holds the best value per workout, chronologically.
 */
export function exerciseHistory(entries) {
  const workouts = (entries || []).filter(e => e.kind === "workout")
    .sort((a, b) => dayKey(a).localeCompare(dayKey(b)) || num(a.id) - num(b.id));
  const out = {};
  for (const w of workouts) {
    for (const ex of w.data?.exercises || []) {
      const key = exerciseKey(ex);
      if (!key) continue;
      const rec = (out[key] ??= { kg: [], reps: [], seconds: [] });
      for (const metric of ["kg", "reps"]) {
        const best = Math.max(0, ...(ex.sets || []).map(s => setValue(metric, s)));
        if (best > 0) rec[metric].push({ date: dayKey(w), value: best });
      }
      rec.seconds = rec.reps; // seconds are entered in the reps field
    }
  }
  return out;
}

/** Progress of one goal: current best, %, date of the first workout that reached the target. */
export function goalProgress(goal, history) {
  const list = history[goal.exId]?.[goal.metric] || [];
  let best = 0, bestDate = null, achievedAt = null;
  for (const p of list) {
    if (p.value > best) { best = p.value; bestDate = p.date; }
    if (!achievedAt && p.value >= num(goal.target)) achievedAt = p.date;
  }
  const target = num(goal.target) || 1;
  return {
    best, bestDate, achievedAt, achieved: Boolean(achievedAt),
    sessions: list.length,
    pct: Math.max(0, Math.min(100, Math.round((best / target) * 100)))
  };
}

/** Number of personal records (an exercise's best weight/reps improving over a previous session). */
export function countRecords(history) {
  let records = 0;
  for (const rec of Object.values(history)) {
    for (const metric of ["kg", "reps"]) {
      let best = 0, first = true;
      for (const p of rec[metric]) {
        if (p.value > best) { if (!first) records++; best = p.value; }
        first = false;
      }
    }
  }
  return records;
}

/** Total lifted volume (kg × reps) from done sets. */
export function totalVolume(entries) {
  let v = 0;
  for (const w of entries || []) {
    if (w.kind !== "workout") continue;
    for (const ex of w.data?.exercises || []) for (const s of ex.sets || []) if (s.done) v += num(s.kg) * num(s.reps);
  }
  return v;
}
