import { Dumbbell, Flame, Sprout, Trophy, Utensils } from "lucide-react";

/** Lifetime counters come from /api/stats (fallback: counts from loaded entries). */
export function buildAchievements(stats) {
  const workouts = stats?.workouts || 0, foodEntries = stats?.foodEntries || 0, foodDays = stats?.foodDays || 0;
  const list = [
    { id: "first-food", title: "Pierwszy wpis", description: "Zapisz pierwszy posiłek w dzienniku.", icon: Utensils, xp: 20, unlocked: foodEntries >= 1 },
    { id: "first-workout", title: "Pierwszy trening", description: "Zapisz swój pierwszy trening.", icon: Dumbbell, xp: 30, unlocked: workouts >= 1 },
    { id: "five-workouts", title: "Budujemy nawyk", description: "Ukończ pięć treningów.", icon: Flame, xp: 60, unlocked: workouts >= 5 },
    { id: "seven-food-days", title: "Świadome wybory", description: "Zapisuj jedzenie przez siedem różnych dni.", icon: Sprout, xp: 50, unlocked: foodDays >= 7 },
    { id: "ten-workouts", title: "Coraz silniejszy", description: "Zapisz dziesięć treningów.", icon: Trophy, xp: 100, unlocked: workouts >= 10 }
  ];
  const xp = list.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0);
  return { list, xp, level: Math.floor(xp / 100) + 1, unlocked: list.filter(a => a.unlocked).length, workouts, foodDays };
}

export function statsFromEntries(entries) {
  const food = entries.filter(e => e.kind === "food");
  return {
    workouts: entries.filter(e => e.kind === "workout").length,
    foodEntries: food.length,
    foodDays: new Set(food.map(e => String(e.entry_date).slice(0, 10))).size
  };
}
