/** Polish plural: plural(n, "produkt", "produkty", "produktów") */
export function plural(n, one, few, many) {
  const abs = Math.abs(Math.trunc(Number(n) || 0));
  if (abs === 1) return one;
  const mod10 = abs % 10, mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}
export const pl = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

// Accepts Polish decimal comma too ("5,5" → 5.5).
export const num = v => { const n = Number(typeof v === "string" ? v.replace(",", ".").trim() : v); return Number.isFinite(n) ? n : 0; };
/** Keeps only digits and one decimal separator while typing (comma or dot). */
export const decimalInput = v => {
  const s = String(v ?? "").replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const i = s.indexOf(",");
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "");
};
export const round1 = v => Math.round(num(v) * 10) / 10;
export const fmtKg = v => (v == null || v === "" ? "—" : String(round1(v)).replace(".", ","));
export const fmtL = ml => (num(ml) / 1000).toFixed(2).replace(".", ",");
