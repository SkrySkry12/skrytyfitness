import React from "react";
import { CheckCircle2, Target, Trophy } from "lucide-react";
import { useApp } from "../context.js";
import { buildAchievements } from "../lib/achievements.js";
import { fmtKg } from "../lib/format.js";

export function Journey() {
  const { stats, settings } = useApp();
  const ach = buildAchievements(stats);
  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow amber">PROGRES, NIE PERFEKCJA</p>
        <h1>Twoje drzewko rozwoju.</h1>
        <p className="muted">Każdy mały krok buduje kolejną umiejętność. Nie tracisz postępu za dzień odpoczynku.</p>
      </div>
      <section className="card gamification">
        <div className="level-row">
          <div className="level-emblem"><Trophy size={26} /></div>
          <div><span className="eyebrow amber">TWÓJ POZIOM</span><h2>{ach.level} · Budowniczy nawyków</h2><small className="muted">{ach.xp} XP zdobyte łącznie</small></div>
        </div>
        <div className="xp-track"><span style={{ width: (ach.xp % 100) + "%" }} /></div>
        <small className="muted">{100 - (ach.xp % 100)} XP do kolejnego poziomu</small>
      </section>
      <div className="tree">
        {ach.list.map((a, i) => (
          <React.Fragment key={a.id}>
            <article className={"tree-node" + (a.unlocked ? " unlocked" : "")}>
              <div className="tree-icon"><a.icon size={22} /></div>
              <div className="grow">
                <span className="tree-status">{a.unlocked ? "ODBLOKOWANO" : "DO ODKRYCIA"} · {a.xp} XP</span>
                <h3>{a.title}</h3>
                <p className="muted">{a.description}</p>
              </div>
              <div className="tree-check">{a.unlocked ? <CheckCircle2 /> : <Target />}</div>
            </article>
            {i < ach.list.length - 1 && <div className={"tree-connector" + (a.unlocked ? " on" : "")} />}
          </React.Fragment>
        ))}
      </div>
      <section className="card">
        <h3>Twoje statystyki</h3>
        <div className="stats-grid">
          <article className="stat-card"><span>Treningi</span><b>{ach.workouts}</b></article>
          <article className="stat-card"><span>Dni z wpisami</span><b>{ach.foodDays}</b></article>
          <article className="stat-card"><span>Zdobyte XP</span><b>{ach.xp}</b></article>
          <article className="stat-card"><span>Cel wagowy</span><b>{settings.targetWeight ? fmtKg(settings.targetWeight) + " kg" : "—"}</b></article>
        </div>
      </section>
    </div>
  );
}
