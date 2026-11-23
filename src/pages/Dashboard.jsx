import React, { useMemo, useState } from "react";
import { ChevronRight, Dumbbell, Flame, GitBranch, Scale, Target, Utensils } from "lucide-react";
import { useApp } from "../context.js";
import { WaterCard } from "../components/WaterCard.jsx";
import { dayKey } from "../lib/dates.js";
import { fmtKg, num, pl } from "../lib/format.js";
import { buildAchievements } from "../lib/achievements.js";
import { PLANS, EXERCISES } from "../lib/exercises.js";

export function MacroStats({ totals, settings }) {
  const items = [
    ["kcal", "Kalorie", totals.kcal, settings.kcalTarget, "kcal", Flame],
    ["protein", "Białko", totals.p, settings.proteinTarget, "g", null],
    ["carbs", "Węglowodany", totals.c, settings.carbsTarget, "g", null],
    ["fat", "Tłuszcze", totals.f, settings.fatTarget, "g", null]
  ];
  return (
    <section className="stats-grid">
      {items.map(([id, label, value, target, unit, Icon]) => (
        <article key={id} className={`stat-card macro-${id}`}>
          <div className="stat-top"><span>{label}</span>{Icon ? <Icon size={16} /> : <i className="macro-dot" />}</div>
          <b>{Math.round(value)} <small>/ {target} {unit}</small></b>
          <div className="progress"><span style={{ width: Math.min(100, (value / target) * 100) + "%" }} /></div>
        </article>
      ))}
    </section>
  );
}

export function foodTotals(list) {
  return list.reduce((a, e) => ({
    kcal: a.kcal + num(e.data?.kcal), p: a.p + num(e.data?.protein), c: a.c + num(e.data?.carbs), f: a.f + num(e.data?.fat)
  }), { kcal: 0, p: 0, c: 0, f: 0 });
}

export function Dashboard() {
  const { user, entries, settings, today, stats, navigate } = useApp();
  const [plan, setPlan] = useState("A");
  const weights = entries.filter(e => e.kind === "weight");
  const latest = weights[0] ? num(weights[0].data?.kg) : null;
  const todayFood = entries.filter(e => e.kind === "food" && dayKey(e) === today);
  const totals = useMemo(() => foodTotals(todayFood), [todayFood]);
  const ach = useMemo(() => buildAchievements(stats, entries, settings), [stats, entries, settings]);
  const workedOutToday = entries.some(e => e.kind === "workout" && dayKey(e) === today);

  const start = settings.startWeight, target = settings.targetWeight;
  const progress = latest && start && target && start !== target
    ? Math.max(0, Math.min(100, ((start - latest) / (start - target)) * 100)) : null;

  return (
    <div className="page">
      <section className="hero card">
        <div>
          <p className="eyebrow">DOBRZE CIĘ WIDZIEĆ{user.username ? `, ${user.username.toUpperCase()}` : ""}</p>
          <h1>Budujemy formę. <span className="accent-text">Dzień po dniu.</span></h1>
          <p className="muted">Regularność wygrywa z perfekcją. Zapisuj postępy i trzymaj swój rytm.</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><Scale size={18} /><b>{latest ? fmtKg(latest) : "—"} <small>kg</small></b><span>ostatni pomiar</span></div>
          <div className="hero-stat"><Target size={18} /><b>{target ? fmtKg(target) : "—"} <small>kg</small></b><span>cel</span></div>
        </div>
        {progress != null && (
          <div className="goal-progress">
            <div className="progress"><span style={{ width: progress + "%" }} /></div>
            <small>{Math.round(progress)}% drogi do celu · zostało {fmtKg(Math.max(0, latest - target))} kg</small>
          </div>
        )}
      </section>

      <div className="quick-actions">
        <button type="button" className="quick" onClick={() => navigate("food")}><Utensils size={20} /><span>Dodaj posiłek</span></button>
        <button type="button" className="quick" onClick={() => navigate("training")}><Dumbbell size={20} /><span>{workedOutToday ? "Trening ✓" : "Trening"}</span></button>
        <button type="button" className="quick" onClick={() => navigate("progress")}><Scale size={20} /><span>Pomiar wagi</span></button>
      </div>

      <MacroStats totals={totals} settings={settings} />
      <WaterCard />

      <section className="card gamification">
        <div className="card-head">
          <div><p className="eyebrow amber">TWÓJ ROZWÓJ</p><h3>Drzewko osiągnięć</h3></div>
          <button type="button" className="secondary small" onClick={() => navigate("journey")}>Otwórz <GitBranch size={15} /></button>
        </div>
        <div className="xp-summary">
          <div><span>Poziom</span><b>{ach.level}</b><small className="muted">{ach.name}</small></div>
          <div><span>Zdobyte XP</span><b>{ach.xp}</b></div>
          <div><span>Odblokowane</span><b>{ach.unlocked}/{ach.list.length}</b></div>
        </div>
        <div className="xp-track"><span style={{ width: ach.pct + "%" }} /></div>
        <small className="muted">{ach.toNext} XP do poziomu {ach.level + 1}{ach.goalStates.length ? ` · cele: ${ach.achievedGoals}/${ach.goalStates.length}` : ""}</small>
      </section>

      <section className="card">
        <div className="card-head"><h3>Twój plan treningowy</h3><span className="muted small-text">{pl(ach.workouts, "trening", "treningi", "treningów")} łącznie</span></div>
        <div className="segmented">
          {Object.entries(PLANS).map(([k, p]) => <button key={k} type="button" className={plan === k ? "active" : ""} onClick={() => setPlan(k)}>{p.short}</button>)}
        </div>
        <h4 className="plan-name">{PLANS[plan].name}</h4>
        <p className="muted small-text">{PLANS[plan].focus}</p>
        <ul className="plan-list">
          {PLANS[plan].items.slice(0, 4).map(([id, scheme]) => <li key={id}><b>{EXERCISES[id].name}</b><span>{scheme}</span></li>)}
        </ul>
        <button type="button" className="link-btn" onClick={() => navigate("training")}>Przejdź do treningu <ChevronRight size={15} /></button>
      </section>
    </div>
  );
}
