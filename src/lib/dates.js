// Date helpers operating on "YYYY-MM-DD" strings in the user's timezone.
export const DEFAULT_TZ = "Europe/Warsaw";

export function todayIn(tz = DEFAULT_TZ, date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
}

export function shiftDate(iso, days) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export const dayKey = entry => String(entry?.entry_date || "").slice(0, 10);

export function formatLong(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}
export function formatShort(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
export function formatDayMonth(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

/** "dziś" / "wczoraj" / "jutro" / formatted date */
export function relativeDayLabel(iso, today) {
  if (iso === today) return "Dziś";
  if (iso === shiftDate(today, -1)) return "Wczoraj";
  if (iso === shiftDate(today, 1)) return "Jutro";
  return formatLong(iso);
}

export function minutesNowIn(tz = DEFAULT_TZ) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
    return Number(parts.hour) * 60 + Number(parts.minute);
  } catch {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  }
}
export const timeToMinutes = t => { const [h, m] = String(t || "").split(":").map(Number); return h * 60 + m; };

export const COMMON_TIMEZONES = [
  "Europe/Warsaw", "Europe/London", "Europe/Dublin", "Europe/Berlin", "Europe/Amsterdam", "Europe/Oslo",
  "Europe/Stockholm", "Europe/Kyiv", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "UTC"
];
