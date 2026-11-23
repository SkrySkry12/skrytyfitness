import React, { useMemo, useState } from "react";
import { dayKey, formatDayMonth, shiftDate } from "../lib/dates.js";
import { fmtKg } from "../lib/format.js";

const RANGES = [["30", "30 dni"], ["90", "90 dni"], ["all", "Wszystko"]];
const W = 340, H = 190, PAD = { l: 34, r: 10, t: 12, b: 24 };

/** SVG weight chart: points, 7-day moving average, target line and range switch. */
export function WeightChart({ entries, target, today }) {
  const [range, setRange] = useState("90");

  const points = useMemo(() => {
    // One value per day (latest entry wins), sorted ascending.
    const byDay = new Map();
    for (const e of entries) {
      const kg = Number(e.data?.kg);
      if (!(kg > 0)) continue;
      const d = dayKey(e);
      if (!byDay.has(d)) byDay.set(d, kg); // entries arrive newest first
    }
    let list = [...byDay.entries()].map(([date, kg]) => ({ date, kg })).sort((a, b) => a.date.localeCompare(b.date));
    if (range !== "all") {
      const from = shiftDate(today, -Number(range));
      list = list.filter(p => p.date >= from);
    }
    // 7-day moving average over a calendar window (not a fixed number of points).
    return list.map(p => {
      const from = shiftDate(p.date, -6);
      const win = list.filter(q => q.date >= from && q.date <= p.date);
      return { ...p, ma: win.reduce((s, q) => s + q.kg, 0) / win.length };
    });
  }, [entries, range, today]);

  if (!points.length) {
    return (
      <div className="chart-wrap">
        <RangeButtons range={range} setRange={setRange} />
        <p className="muted chart-empty">Brak pomiarów w tym okresie. Dodaj pierwszy pomiar powyżej.</p>
      </div>
    );
  }

  const values = points.map(p => p.kg);
  const t = Number(target) > 0 ? Number(target) : null;
  let min = Math.min(...values, ...(t ? [t] : [])) - 1;
  let max = Math.max(...values, ...(t ? [t] : [])) + 1;
  min = Math.floor(min); max = Math.ceil(max);
  const t0 = new Date(points[0].date + "T12:00:00Z").getTime();
  const t1 = new Date(points[points.length - 1].date + "T12:00:00Z").getTime();
  const span = Math.max(1, t1 - t0);
  const x = d => points.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((new Date(d + "T12:00:00Z").getTime() - t0) / span) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
  const line = key => points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const first = points[0], last = points[points.length - 1];
  const delta = last.kg - first.kg;

  return (
    <div className="chart-wrap">
      <RangeButtons range={range} setRange={setRange} />
      <svg className="weight-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Wykres wagi: od ${fmtKg(first.kg)} kg do ${fmtKg(last.kg)} kg`}>
        {ticks.map(v => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="chart-axis" x={PAD.l - 6} y={y(v) + 3} textAnchor="end">{Math.round(v)}</text>
          </g>
        ))}
        {t && (
          <g>
            <line className="chart-target" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="chart-target-label" x={W - PAD.r} y={y(t) - 4} textAnchor="end">cel {fmtKg(t)} kg</text>
          </g>
        )}
        {points.length > 1 && <path className="chart-line" d={line("kg")} />}
        {points.length > 2 && <path className="chart-ma" d={line("ma")} />}
        {points.map(p => <circle key={p.date} className="chart-dot" cx={x(p.date)} cy={y(p.kg)} r={points.length > 40 ? 2 : 3.5}><title>{`${formatDayMonth(p.date)}: ${fmtKg(p.kg)} kg`}</title></circle>)}
        <text className="chart-axis" x={PAD.l} y={H - 6}>{formatDayMonth(first.date)}</text>
        {points.length > 1 && <text className="chart-axis" x={W - PAD.r} y={H - 6} textAnchor="end">{formatDayMonth(last.date)}</text>}
      </svg>
      <div className="chart-legend">
        <span><i className="lg-line" /> Waga</span>
        {points.length > 2 && <span><i className="lg-ma" /> Średnia 7 dni</span>}
        {t && <span><i className="lg-target" /> Cel</span>}
        {points.length > 1 && <span className={delta <= 0 ? "delta good" : "delta"}>{delta <= 0 ? "▼" : "▲"} {fmtKg(Math.abs(delta))} kg w okresie</span>}
      </div>
    </div>
  );
}

function RangeButtons({ range, setRange }) {
  return (
    <div className="segmented small" role="tablist" aria-label="Zakres wykresu">
      {RANGES.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={range === id} className={range === id ? "active" : ""} onClick={() => setRange(id)}>{label}</button>
      ))}
    </div>
  );
}
