import { DEFAULT_TZ, minutesNowIn, timeToMinutes } from "./dates.js";

export const DEFAULT_MEALS = [
  { id: "breakfast", label: "Śniadanie", time: "08:00", enabled: true },
  { id: "second-breakfast", label: "II śniadanie", time: "11:00", enabled: true },
  { id: "lunch", label: "Obiad", time: "14:00", enabled: true },
  { id: "snack", label: "Podwieczorek", time: "17:00", enabled: true },
  { id: "dinner", label: "Kolacja", time: "20:00", enabled: true }
];

/** All meal labels that can be chosen when logging food (schedule + "Przekąska"). */
export const MEAL_CHOICES = [
  ["Śniadanie", "☀"], ["II śniadanie", "◷"], ["Obiad", "🍽"], ["Podwieczorek", "◌"], ["Kolacja", "☾"], ["Przekąska", "＋"]
];

export const GOAL_DEFAULTS = { kcalTarget: 2350, proteinTarget: 170, carbsTarget: 250, fatTarget: 75, waterTargetMl: 2500 };

/** Per-account defaults used until the user saves their own values. */
export function accountDefaults(username) {
  const pink = username === "kieltyczka";
  return {
    ...GOAL_DEFAULTS,
    targetWeight: pink ? null : 88,
    startWeight: pink ? null : 104,
    theme: pink ? "pink" : "blue",
    timezone: DEFAULT_TZ,
    remindersEnabled: true,
    meals: DEFAULT_MEALS
  };
}

/** Merges saved settings over defaults; null/empty numbers fall back to the default. */
export function mergeSettings(saved = {}, username) {
  const base = accountDefaults(username);
  const out = { ...base, ...saved };
  for (const key of Object.keys(GOAL_DEFAULTS)) {
    const v = Number(saved?.[key]);
    out[key] = saved?.[key] != null && saved[key] !== "" && Number.isFinite(v) && v > 0 ? v : base[key];
  }
  for (const key of ["targetWeight", "startWeight"]) {
    const v = Number(saved?.[key]);
    out[key] = saved?.[key] != null && saved[key] !== "" && Number.isFinite(v) && v > 0 ? v : base[key];
  }
  out.theme = saved?.theme === "pink" || saved?.theme === "blue" ? saved.theme : base.theme;
  out.timezone = saved?.timezone || base.timezone;
  out.meals = Array.isArray(saved?.meals) && saved.meals.length ? saved.meals : base.meals;
  return out;
}

/** True when the user has never saved anything (fresh account) – triggers onboarding. */
export const needsOnboarding = saved => !saved || Object.keys(saved).length === 0;

/** Meal label matching the current hour: the latest enabled meal whose time has passed (or the first one). */
export function defaultMealLabel(settings) {
  const meals = (settings?.meals || DEFAULT_MEALS).filter(m => m.enabled !== false)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  if (!meals.length) return "Śniadanie";
  const now = minutesNowIn(settings?.timezone);
  // A meal "counts" from 45 minutes before its scheduled time.
  const current = [...meals].reverse().find(m => timeToMinutes(m.time) - 45 <= now);
  return (current || meals[0]).label;
}

/** Mifflin-St Jeor BMR × activity factor. */
export function tdee({ sex, age, height, weight, activity }) {
  const a = Number(age), h = Number(height), w = Number(weight), f = Number(activity);
  if (!(a > 0 && h > 0 && w > 0 && f > 0)) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === "female" ? -161 : 5);
  return Math.round(bmr * f);
}

export const ACTIVITY_LEVELS = [
  [1.2, "Siedzący tryb życia"],
  [1.375, "Lekka aktywność (1–3 treningi/tydz.)"],
  [1.55, "Umiarkowana (3–5 treningów/tydz.)"],
  [1.725, "Wysoka (6–7 treningów/tydz.)"],
  [1.9, "Bardzo wysoka (praca fizyczna + treningi)"]
];
