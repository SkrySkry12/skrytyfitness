import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Lock, Plus, Target, Trash2, Trophy } from "lucide-react";
import { useApp } from "../context.js";
import { useToast } from "../components/Toast.jsx";
import { BottomSheet } from "../components/BottomSheet.jsx";
import { BRANCHES, buildAchievements } from "../lib/achievements.js";
import { GOAL_TEMPLATES, GOAL_XP, METRICS, formatValue, goalKey, newGoal } from "../lib/goals.js";
import { EXERCISES, MUSCLES, PLANS } from "../lib/exercises.js";
import { formatShort } from "../lib/dates.js";
import { fmtKg, num, pl } from "../lib/format.js";

const IN_PLANS = new Set(Object.values(PLANS).flatMap(p => p.items.map(([id]) => id)));

function GoalCard({ state, onRemove }) {
  const { goal, best, bestDate, achievedAt, pct, sessions } = state;
  const ex = EXERCISES[goal.exId];
  return (
    <article className={"goal-card" + (achievedAt ? " done" : "")}>
      <div className="goal-top">
        <div className="goal-icon">{achievedAt ? <Trophy size={20} /> : <Target size={20} />}</div>
        <div className="grow">
          <h4>{goal.title}</h4>
          <small className="muted">{ex ? ex.name : goal.exId} · {METRICS[goal.metric]?.hint}</small>
        </div>
        <button type="button" className="icon-btn" aria-label={`Usuń cel ${goal.title}`} onClick={() => onRemove(goal)}><Trash2 size={17} /></button>
      </div>
      <div className="goal-bar"><span style={{ width: pct + "%" }} /></div>
      <div className="goal-meta">
        <span>Rekord: <b>{best ? formatValue(goal.metric, best) : "—"}</b></span>
        <span>Cel: <b>{formatValue(goal.metric, num(goal.target))}</b></span>
        <span className="goal-pct">{pct}%</span>
      </div>
      {achievedAt
        ? <p className="goal-note success">🎉 Osiągnięto {formatShort(achievedAt)} · +{GOAL_XP} XP</p>
        : sessions
          ? <p className="goal-note">Ostatni rekord: {formatShort(bestDate)}. Zostało {formatValue(goal.metric, Math.max(0, num(goal.target) - best))}.</p>
          : <p className="goal-note">Brak zapisanych serii. {ex && !IN_PLANS.has(ex.id)
            ? <>W zakładce Trening dodaj ćwiczenie „{ex.name}” (sekcja „Dodaj własne ćwiczenie”) i oznaczaj serie ✓.</>
            : <>Zapisz trening z tym ćwiczeniem i oznacz wykonane serie ✓.</>}</p>}
    </article>
  );
}

function AddGoalSheet({ open, onClose, goals, history, onAdd, saving }) {
  const [mode, setMode] = useState("templates");
  const [custom, setCustom] = useState({ exId: "pull-up", metric: "reps", target: "", title: "" });
  const taken = new Set(goals.map(goalKey));
  const byMuscle = useMemo(() => {
    const groups = {};
    for (const ex of Object.values(EXERCISES)) (groups[MUSCLES.includes(ex.muscle) ? ex.muscle : "Inne"] ??= []).push(ex);
    return groups;
  }, []);
  const currentBest = list => (list?.length ? Math.max(...list.map(p => p.value)) : 0);
  const customBest = currentBest(history[custom.exId]?.[custom.metric]);
  const customValid = num(custom.target) > 0 && EXERCISES[custom.exId];

  return (
    <BottomSheet open={open} onClose={onClose} title="Dodaj cel" className="goal-sheet">
      <div className="segmented">
        <button type="button" className={mode === "templates" ? "active" : ""} onClick={() => setMode("templates")}>Gotowe cele</button>
        <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>Własny cel</button>
      </div>

      {mode === "templates" ? (
        <div className="template-list">
          {GOAL_TEMPLATES.map(t => {
            const best = history[t.exId];
            return (
              <section key={t.exId} className="template-group">
                <h4>{t.group}</h4>
                <p className="muted small-text">{t.hint}</p>
                <div className="chip-row">
                  {t.goals.map(g => {
                    const key = goalKey({ ...g, exId: t.exId });
                    const added = taken.has(key);
                    return (
                      <button key={key} type="button" className={"chip" + (added ? " active" : "")} disabled={added || saving}
                        onClick={() => onAdd(newGoal({ ...g, exId: t.exId }))}>
                        {added ? <CheckCircle2 size={14} /> : <Plus size={14} />} {g.title}
                      </button>
                    );
                  })}
                </div>
                {best && currentBest(best[t.goals[0].metric]) > 0 && (
                  <small className="muted">Twój obecny rekord: {formatValue(t.goals[0].metric, currentBest(best[t.goals[0].metric]))}</small>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="form-grid">
          <label className="field span-2"><span>Ćwiczenie</span>
            <select value={custom.exId} onChange={e => setCustom(c => ({ ...c, exId: e.target.value }))}>
              {Object.entries(byMuscle).map(([m, list]) => (
                <optgroup key={m} label={m}>{list.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</optgroup>
              ))}
            </select>
          </label>
          <div className="field span-2"><span>Co mierzymy?</span>
            <div className="segmented small">
              {Object.entries(METRICS).map(([k, m]) => (
                <button key={k} type="button" className={custom.metric === k ? "active" : ""} onClick={() => setCustom(c => ({ ...c, metric: k }))}>{m.label} ({m.unit})</button>
              ))}
            </div>
            <small>{METRICS[custom.metric].hint}</small>
          </div>
          <label className="field"><span>Cel ({METRICS[custom.metric].unit})</span>
            <input type="number" inputMode="decimal" min="0" step={custom.metric === "kg" ? "0.5" : "1"} placeholder={custom.metric === "kg" ? "np. 100" : "np. 10"}
              value={custom.target} onChange={e => setCustom(c => ({ ...c, target: e.target.value }))} />
          </label>
          <div className="field"><span>Obecny rekord</span><div className="readonly-value">{customBest ? formatValue(custom.metric, customBest) : "brak"}</div></div>
          <label className="field span-2"><span>Nazwa celu <small>(opcjonalnie)</small></span>
            <input maxLength={80} placeholder="np. Wakacyjna forma" value={custom.title} onChange={e => setCustom(c => ({ ...c, title: e.target.value }))} />
          </label>
          <button type="button" className="primary full span-2" disabled={!customValid || saving}
            onClick={() => { onAdd(newGoal(custom)); setCustom(c => ({ ...c, target: "", title: "" })); }}>
            <Plus size={16} /> Dodaj cel
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

function Branch({ branch, items }) {
  const [open, setOpen] = useState(true);
  const done = items.filter(a => a.unlocked).length;
  const Icon = branch.icon;
  return (
    <section className="branch" style={{ "--branch": branch.color }}>
      <button type="button" className="branch-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="branch-icon"><Icon size={20} /></span>
        <span className="grow"><b>{branch.title}</b><small>{done}/{items.length} odblokowanych</small></span>
        <span className="branch-mini"><span style={{ width: (items.length ? (done / items.length) * 100 : 0) + "%" }} /></span>
        <ChevronDown size={18} className={"chev" + (open ? " open" : "")} />
      </button>
      {open && (
        <div className="tree">
          {items.map((a, i) => {
            const pct = a.progress ? Math.min(100, Math.round((a.progress.cur / (a.progress.target || 1)) * 100)) : 0;
            return (
              <React.Fragment key={a.id}>
                <article className={"tree-node" + (a.unlocked ? " unlocked" : "")}>
                  <div className="tree-icon"><a.icon size={22} /></div>
                  <div className="grow">
                    <span className="tree-status">{a.unlocked ? "ODBLOKOWANO" : "DO ODKRYCIA"} · {a.xp} XP</span>
                    <h3>{a.title}</h3>
                    <p className="muted">{a.description}</p>
                    {!a.unlocked && a.progress && (
                      <div className="node-progress">
                        <div className="progress"><span style={{ width: pct + "%" }} /></div>
                        <small>{fmtKg(a.progress.cur)} / {fmtKg(a.progress.target)}</small>
                      </div>
                    )}
                  </div>
                  <div className="tree-check">{a.unlocked ? <CheckCircle2 /> : <Lock size={18} />}</div>
                </article>
                {i < items.length - 1 && <div className={"tree-connector" + (a.unlocked ? " on" : "")} />}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Journey() {
  const { stats, settings, entries, saveSettings, reportError } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const goals = Array.isArray(settings.goals) ? settings.goals : [];
  const ach = useMemo(() => buildAchievements(stats, entries, settings), [stats, entries, settings]);
  const sortedGoals = [...ach.goalStates].sort((a, b) => Number(a.achieved) - Number(b.achieved) || b.pct - a.pct);

  const persist = async next => {
    setSaving(true);
    try { await saveSettings({ ...settings, goals: next }); return true; }
    catch (err) { reportError(err); return false; }
    finally { setSaving(false); }
  };
  const addGoal = async goal => {
    if (await persist([...goals, goal])) toast(`Dodano cel: ${goal.title}`);
  };
  const removeGoal = async goal => {
    const before = goals;
    if (!window.confirm(`Usunąć cel „${goal.title}”?`)) return;
    if (await persist(goals.filter(g => g.id !== goal.id))) {
      toast("Usunięto cel", { type: "info", action: { label: "Cofnij", onClick: () => persist(before) } });
    }
  };

  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow amber">PROGRES, NIE PERFEKCJA</p>
        <h1>Twoje drzewko rozwoju.</h1>
        <p className="muted">Każdy mały krok buduje kolejną umiejętność. Nie tracisz postępu za dzień odpoczynku.</p>
      </div>

      <section className="card gamification">
        <div className="level-row">
          <div className="level-emblem"><span className="level-num">{ach.level}</span></div>
          <div className="grow">
            <span className="eyebrow amber">TWÓJ POZIOM</span>
            <h2>{ach.name}</h2>
            <small className="muted">{ach.xp} XP · {ach.unlocked}/{ach.list.length} osiągnięć</small>
          </div>
        </div>
        <div className="xp-track"><span style={{ width: ach.pct + "%" }} /></div>
        <small className="muted">{ach.toNext} XP do poziomu {ach.level + 1} · „{ach.nextName}”</small>
      </section>

      <section className="card">
        <div className="card-head">
          <div><p className="eyebrow">SIŁA I SPRAWNOŚĆ</p><h3>Moje cele</h3></div>
          <button type="button" className="primary small" onClick={() => setSheet(true)}><Plus size={16} /> Dodaj cel</button>
        </div>
        {sortedGoals.length ? (
          <div className="goal-list">
            {sortedGoals.map(s => <GoalCard key={s.goal.id} state={s} onRemove={removeGoal} />)}
          </div>
        ) : (
          <div className="goal-empty">
            <Target size={28} />
            <p>Ustaw cel, np. <b>pierwsze podciągnięcie</b> albo <b>wyciskanie 100 kg</b>. Postęp policzy się sam z Twoich treningów.</p>
            <div className="chip-row">
              {[GOAL_TEMPLATES[0], GOAL_TEMPLATES[2], GOAL_TEMPLATES[5]].map(t => (
                <button key={t.exId} type="button" className="chip" disabled={saving} onClick={() => addGoal(newGoal({ ...t.goals[0], exId: t.exId }))}>
                  <Plus size={14} /> {t.goals[0].title}
                </button>
              ))}
            </div>
          </div>
        )}
        <small className="muted">Liczą się serie oznaczone ✓ w zapisanych treningach. Za każdy osiągnięty cel: +{GOAL_XP} XP.</small>
      </section>

      <div className="branches">
        {BRANCHES.map(b => <Branch key={b.id} branch={b} items={ach.list.filter(a => a.branch === b.id)} />)}
      </div>

      <section className="card">
        <h3>Twoje statystyki</h3>
        <div className="stats-grid">
          <article className="stat-card"><span>Treningi</span><b>{ach.workouts}</b></article>
          <article className="stat-card"><span>Rekordy</span><b>{ach.records}</b></article>
          <article className="stat-card"><span>Podniesione</span><b>{fmtKg(ach.volume / 1000)} <small>t</small></b></article>
          <article className="stat-card"><span>Cele</span><b>{ach.achievedGoals}/{goals.length}</b></article>
          <article className="stat-card"><span>Dni z dziennikiem</span><b>{ach.foodDays}</b></article>
          <article className="stat-card"><span>Cel wagowy</span><b>{settings.targetWeight ? fmtKg(settings.targetWeight) + " kg" : "—"}</b></article>
        </div>
        <small className="muted">{pl(ach.unlocked, "osiągnięcie odblokowane", "osiągnięcia odblokowane", "osiągnięć odblokowanych")} z {ach.list.length}.</small>
      </section>

      <AddGoalSheet open={sheet} onClose={() => setSheet(false)} goals={goals} history={ach.history} onAdd={addGoal} saving={saving} />
    </div>
  );
}
