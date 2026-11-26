import {
  Award, CalendarCheck, HeartPulse, Timer, Route, Crown, Droplets, Dumbbell, Flame, Footprints, Goal, Medal, Mountain, Ruler, Scale,
  Sprout, Star, Target, TrendingDown, Trophy, Utensils, Weight, Zap
} from "lucide-react";
import { dayKey } from "./dates.js";
import { num } from "./format.js";
import { GOAL_XP, cardioTotals, countRecords, exerciseHistory, goalProgress, totalVolume } from "./goals.js";

export const BRANCHES = [
  { id: "habits", title: "Nawyki i treningi", icon: Flame, color: "var(--accent)" },
  { id: "diet", title: "Dieta i nawodnienie", icon: Utensils, color: "var(--success)" },
  { id: "strength", title: "Siła i cele", icon: Dumbbell, color: "var(--warning)" },
  { id: "body", title: "Waga i pomiary", icon: Scale, color: "#a78bfa" }
];

// Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, 1500, …
const LEVEL_NAMES = [
  "Nowicjusz", "Początkujący", "Budowniczy nawyków", "Regularny", "Wytrwały",
  "Zawodnik", "Atleta", "Weteran siłowni", "Mistrz", "Legenda"
];
const levelStart = n => 50 * n * (n - 1);

export function levelInfo(xp) {
  let level = 1;
  while (xp >= levelStart(level + 1)) level++;
  const start = levelStart(level), next = levelStart(level + 1);
  return {
    level,
    name: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] + (level > LEVEL_NAMES.length ? ` ${level - LEVEL_NAMES.length + 1}` : ""),
    nextName: LEVEL_NAMES[Math.min(level + 1, LEVEL_NAMES.length) - 1],
    pct: Math.round(((xp - start) / (next - start)) * 100),
    toNext: next - xp
  };
}

const isoWeek = iso => {
  const d = new Date(iso + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};

/** Tiered achievement helper: one node per threshold. */
const tiers = (branch, idBase, value, defs, icon, describe) =>
  defs.map(([target, title, xp, ico]) => ({
    id: `${idBase}-${target}`, branch, title, description: describe(target), icon: ico || icon, xp,
    unlocked: value >= target, progress: { cur: Math.min(value, target), target }
  }));

/**
 * Builds the achievement tree. `stats` = lifetime counters (/api/stats), `entries` = loaded entries
 * (full workout + weight history), `settings` = merged user settings (goals, start/target weight).
 */
export function buildAchievements(stats, entries = [], settings = {}) {
  const workouts = stats?.workouts || 0, foodEntries = stats?.foodEntries || 0, foodDays = stats?.foodDays || 0;
  const waterDays = stats?.waterDays || 0;

  const workoutEntries = entries.filter(e => e.kind === "workout");
  const weekCounts = {};
  for (const w of workoutEntries) { const k = isoWeek(dayKey(w)); weekCounts[k] = (weekCounts[k] || 0) + 1; }
  const bestWeek = Math.max(0, ...Object.values(weekCounts));
  const activeWeeks = Object.values(weekCounts).filter(c => c >= 2).length;

  const history = exerciseHistory(entries);
  const records = countRecords(history);
  const volume = totalVolume(entries);
  const cardio = cardioTotals(entries);
  const goals = Array.isArray(settings?.goals) ? settings.goals : [];
  const goalStates = goals.map(g => ({ goal: g, ...goalProgress(g, history) }));
  const achievedGoals = goalStates.filter(g => g.achieved).length;

  const weights = entries.filter(e => e.kind === "weight" && num(e.data?.kg) > 0)
    .sort((a, b) => dayKey(a).localeCompare(dayKey(b)));
  const startWeight = num(settings?.startWeight) || num(weights[0]?.data?.kg);
  const currentWeight = num(weights[weights.length - 1]?.data?.kg);
  const lost = weights.length && startWeight ? Math.max(0, Math.round((startWeight - currentWeight) * 10) / 10) : 0;
  const target = num(settings?.targetWeight);
  const waistCount = weights.filter(e => num(e.data?.waist) > 0).length;

  const list = [
    // --- Nawyki / treningi ---
    ...tiers("habits", "workouts", workouts, [
      [1, "Pierwszy trening", 30, Dumbbell], [5, "Budujemy nawyk", 60, Flame], [10, "Coraz silniejszy", 100, Zap],
      [25, "Ćwierć setki", 150, Medal], [50, "Pół setki", 250, Award], [100, "Setka treningów", 500, Crown]
    ], Dumbbell, n => `Zapisz ${n === 1 ? "swój pierwszy trening" : `${n} treningów`}.`),
    { id: "week-3", branch: "habits", title: "Pracowity tydzień", description: "Zrób 3 treningi w jednym tygodniu (pon–niedz).", icon: CalendarCheck, xp: 80, unlocked: bestWeek >= 3, progress: { cur: Math.min(bestWeek, 3), target: 3 } },
    ...tiers("habits", "active-weeks", activeWeeks, [
      [4, "Miesiąc regularności", 120, Footprints], [12, "Kwartał regularności", 250, Mountain]
    ], Footprints, n => `Trenuj co najmniej 2 razy w tygodniu przez ${n} tygodni.`),
    { id: "cardio-1", branch: "habits", title: "Pierwsze cardio", description: "Zapisz pierwsze cardio w „Strefie cardio” (np. bieżnia, orbitrek, rower).", icon: HeartPulse, xp: 30, unlocked: cardio.sessions >= 1, progress: { cur: Math.min(cardio.sessions, 1), target: 1 } },
    ...tiers("habits", "cardio-min", Math.round(cardio.minutes), [[60, "Godzina cardio", 60, Timer], [300, "5 godzin cardio", 150, Timer]], Timer,
      n => `Zbierz łącznie ${n} minut cardio.`),
    ...tiers("habits", "cardio-km", cardio.km, [[10, "10 km za Tobą", 80, Route]], Route, n => `Przejdź, przebiegnij lub przejedź łącznie ${n} km w cardio.`),

    // --- Dieta ---
    ...tiers("diet", "food", foodEntries, [[1, "Pierwszy wpis", 20, Utensils], [100, "Sto posiłków", 120, Utensils]], Utensils,
      n => (n === 1 ? "Zapisz pierwszy posiłek w dzienniku." : `Zapisz łącznie ${n} posiłków.`)),
    ...tiers("diet", "food-days", foodDays, [
      [7, "Świadome wybory", 50, Sprout], [30, "Miesiąc z dziennikiem", 150, Sprout], [100, "Mistrz dziennika", 300, Star]
    ], Sprout, n => `Zapisuj jedzenie przez ${n} różnych dni.`),
    ...tiers("diet", "water-days", waterDays, [[7, "Nawodniony tydzień", 50, Droplets], [30, "Wodny miesiąc", 120, Droplets]], Droplets,
      n => `Zapisuj wypitą wodę przez ${n} różnych dni.`),

    // --- Siła / cele ---
    { id: "goal-set", branch: "strength", title: "Mam cel!", description: "Ustaw swój pierwszy cel siłowy w sekcji „Moje cele”.", icon: Target, xp: 20, unlocked: goals.length >= 1, progress: { cur: Math.min(goals.length, 1), target: 1 } },
    ...tiers("strength", "goals-done", achievedGoals, [
      [1, "Pierwszy cel zdobyty", 100, Goal], [3, "Kolekcjoner celów", 200, Trophy], [5, "Nie do zatrzymania", 350, Crown]
    ], Goal, n => (n === 1 ? "Osiągnij swój pierwszy cel." : `Osiągnij ${n} cele.`)),
    ...tiers("strength", "records", records, [
      [1, "Pierwszy rekord", 40, Star], [10, "Seria rekordów", 120, Star], [25, "Maszyna do rekordów", 250, Medal]
    ], Star, n => (n === 1 ? "Pobij swój poprzedni wynik w dowolnym ćwiczeniu." : `Pobij swój wynik ${n} razy (więcej kg lub powtórzeń).`)),
    ...tiers("strength", "volume", Math.round(volume), [
      [1000, "Pierwsza tona", 60, Weight], [10000, "10 ton", 150, Weight], [50000, "50 ton", 300, Mountain]
    ], Weight, n => `Podnieś łącznie ${n / 1000} t (kg × powtórzenia z ukończonych serii).`),
    ...goalStates.map(g => ({
      id: `goal-${g.goal.id}`, branch: "strength", title: `Cel: ${g.goal.title}`, description: "Twój własny cel – XP za jego osiągnięcie.",
      icon: Trophy, xp: GOAL_XP, unlocked: g.achieved, progress: { cur: Math.round(g.best * 10) / 10, target: num(g.goal.target) }, goal: true
    })),

    // --- Waga / pomiary ---
    ...tiers("body", "weigh-ins", weights.length, [
      [1, "Pierwszy pomiar", 20, Scale], [10, "Pod kontrolą", 60, Scale], [30, "Systematyczny", 150, Scale]
    ], Scale, n => (n === 1 ? "Zapisz pierwszy pomiar wagi." : `Zapisz ${n} pomiarów wagi.`)),
    { id: "waist", branch: "body", title: "Centymetr w dłoń", description: "Zapisz obwód talii razem z wagą.", icon: Ruler, xp: 20, unlocked: waistCount >= 1, progress: { cur: Math.min(waistCount, 1), target: 1 } },
    ...tiers("body", "lost", lost, [
      [1, "Pierwszy kilogram w dół", 50, TrendingDown], [3, "Minus 3 kg", 100, TrendingDown], [5, "Minus 5 kg", 150, TrendingDown], [10, "Minus 10 kg", 300, Crown]
    ], TrendingDown, n => `Zrzuć ${n} kg względem wagi startowej.`),
    {
      id: "target-weight", branch: "body", title: "Cel wagowy osiągnięty", description: target ? `Dojdź do wagi docelowej ${String(target).replace(".", ",")} kg.` : "Ustaw wagę docelową w Ustawieniach.",
      icon: Trophy, xp: 400, unlocked: Boolean(target && startWeight > target && currentWeight && currentWeight <= target),
      progress: target && startWeight > target ? { cur: Math.max(0, Math.round((startWeight - (currentWeight || startWeight)) * 10) / 10), target: Math.round((startWeight - target) * 10) / 10 } : null
    }
  ];

  const xp = list.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0);
  return {
    list, xp, ...levelInfo(xp),
    unlocked: list.filter(a => a.unlocked).length,
    workouts, foodDays, records, volume, achievedGoals, goalStates, history, cardio
  };
}

export function statsFromEntries(entries) {
  const food = entries.filter(e => e.kind === "food");
  return {
    workouts: entries.filter(e => e.kind === "workout").length,
    foodEntries: food.length,
    foodDays: new Set(food.map(e => String(e.entry_date).slice(0, 10))).size,
    waterDays: new Set(entries.filter(e => e.kind === "water").map(e => String(e.entry_date).slice(0, 10))).size
  };
}
