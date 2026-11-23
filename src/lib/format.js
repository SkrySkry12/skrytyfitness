/** Polish plural: plural(n, "produkt", "produkty", "produktów") */
export function plural(n, one, few, many) {
  const abs = Math.abs(Math.trunc(Number(n) || 0));
  if (abs === 1) return one;
  const mod10 = abs % 10, mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}
export const pl = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const round1 = v => Math.round(num(v) * 10) / 10;
export const fmtKg = v => (v == null || v === "" ? "—" : String(round1(v)).replace(".", ","));
export const fmtL = ml => (num(ml) / 1000).toFixed(2).replace(".", ",");
