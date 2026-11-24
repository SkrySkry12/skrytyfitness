// Open Food Facts integration: barcode lookup (EAN/UPC) and product search with caching.
const UA = "SkrySkryFitness/2.2 (https://github.com/SkrySkry12/skrytyfitness)";
const FIELDS = "code,product_name,product_name_pl,generic_name,generic_name_pl,brands,quantity,serving_size,serving_quantity,nutriments,image_front_small_url,image_front_thumb_url,image_front_url,lang,countries_tags";

// --- small LRU cache with TTL ------------------------------------------------------------
const cache = new Map();
const CACHE_MAX = 500;
export function cacheGet(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) { cache.delete(key); return null; }
  cache.delete(key); cache.set(key, item); // refresh LRU position
  return item.value;
}
export function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

export class OffError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function offFetch(url, timeout) {
  let response;
  try {
    response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    throw new OffError("sieć: " + (error?.cause?.code || error.name || error.message), 0);
  }
  // OFF answers 404 with a JSON body {status:0} for unknown products – that is "not found", not a failure.
  if (response.status === 404) return { notFound: true };
  if (!response.ok) throw new OffError("HTTP " + response.status, response.status);
  try { return await response.json(); } catch { throw new OffError("invalid JSON", response.status); }
}

// --- barcode validation ------------------------------------------------------------------
/** GTIN mod-10 check (valid for GTIN-8/12/13/14). */
export function gtinChecksumOk(code) {
  const digits = code.split("").map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Normalises scanner/user input. Returns { code, variants } or { error }.
 * UPC-A (12 digits) is looked up as EAN-13 with a leading zero too; 8-digit codes may be UPC-E,
 * whose check digit uses a different scheme, so they are not rejected on checksum.
 */
export function normalizeBarcode(input) {
  const code = String(input || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(code.length)) return { error: "Kod kreskowy musi mieć 8, 12, 13 lub 14 cyfr (wpisano " + code.length + ")." };
  if (code.length !== 8 && !gtinChecksumOk(code)) return { error: "Kod " + code + " ma błędną cyfrę kontrolną — prawdopodobnie został źle odczytany. Zeskanuj ponownie lub sprawdź cyfry." };
  const variants = [code];
  if (code.length === 12) variants.push("0" + code);
  if (code.length === 13 && code.startsWith("0")) variants.push(code.slice(1));
  if (code.length === 14 && code.startsWith("0")) variants.push(code.slice(1));
  return { code, variants };
}

// --- product mapping ---------------------------------------------------------------------
const numOrNull = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const r1 = v => Math.round(v * 10) / 10;

export function mapProduct(p, fallbackCode = null) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = numOrNull(n["energy-kcal_100g"]);
  if (kcal == null) { const kj = numOrNull(n["energy-kj_100g"]) ?? numOrNull(n["energy_100g"]); if (kj != null) kcal = kj / 4.184; }
  const protein = numOrNull(n.proteins_100g), carbs = numOrNull(n.carbohydrates_100g), fat = numOrNull(n.fat_100g);
  const name = String(p.product_name_pl || p.product_name || p.generic_name_pl || p.generic_name || "").trim();
  const brand = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0].trim();
  const serving = numOrNull(p.serving_quantity);
  return {
    name: name || null,
    brand: brand || null,
    barcode: String(p.code || fallbackCode || "") || null,
    quantity: p.quantity || null,
    servingSize: p.serving_size || null,
    servingGrams: serving && serving > 0 && serving < 5000 ? r1(serving) : null,
    kcal: kcal != null ? Math.round(kcal) : null,
    protein: protein != null ? r1(protein) : null,
    carbs: carbs != null ? r1(carbs) : null,
    fat: fat != null ? r1(fat) : null,
    complete: kcal != null && kcal < 1000 && protein != null && carbs != null && fat != null,
    image: p.image_front_small_url || p.image_front_thumb_url || p.image_front_url || null,
    polish: Array.isArray(p.countries_tags) ? p.countries_tags.includes("en:poland") : undefined,
    source: "Open Food Facts"
  };
}

// --- barcode lookup ----------------------------------------------------------------------
// Endpoints tried in order. The second host and the older v0 API are fallbacks for OFF outages/blocks.
const OFF_PRODUCT_URLS = [
  code => `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`,
  code => `https://pl.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`,
  code => `https://world.openfoodfacts.org/api/v0/product/${code}.json`
];
const transient = error => !error.status || error.status === 429 || error.status >= 500;

/** Returns { product|null, code }. Throws OffError only when OFF could not be reached at all. */
export async function lookupBarcode(input) {
  const norm = normalizeBarcode(input);
  if (norm.error) throw new OffError(norm.error, 400);
  const key = "ean:" + norm.code;
  const cached = cacheGet(key);
  if (cached) return cached;
  const started = Date.now();
  let reachable = false;
  const causes = [];
  for (const code of norm.variants) {
    for (const build of OFF_PRODUCT_URLS) {
      if (Date.now() - started > 20000) break; // keep the UI responsive
      const url = build(code);
      let data = null;
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        try {
          data = await offFetch(url, 7000);
        } catch (error) {
          causes.push(`${new URL(url).host}${new URL(url).pathname.split("/").slice(0, 3).join("/")}: ${error.message}`);
          console.warn(`[OFF] kod ${code} – ${url.split("?")[0]} nie odpowiada (${error.message})`);
          if (!transient(error)) break;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 600));
        }
      }
      if (!data) continue; // this endpoint failed – try the next one
      reachable = true;
      if (data.notFound || !data.product || data.status === 0 || data.status === "failure") break; // try next variant
      const product = mapProduct(data.product, code);
      if (product?.name || product?.complete) {
        const result = { code: norm.code, product: { ...product, name: product.name || "Produkt " + code } };
        cacheSet(key, result, 24 * 60 * 60 * 1000);
        return result;
      }
      break;
    }
  }
  if (!reachable) {
    const cause = [...new Set(causes)].slice(-3).join("; ") || "błąd sieci";
    console.error(`[OFF] kod ${norm.code}: baza nieosiągalna po ${Date.now() - started} ms – ${cause}`);
    throw new OffError(cause, 502);
  }
  const result = { code: norm.code, product: null };
  cacheSet(key, result, 30 * 60 * 1000);
  return result;
}

/** Diagnostics: can the server reach Open Food Facts? */
export async function offSelfTest() {
  const started = Date.now();
  try {
    const data = await offFetch(`https://world.openfoodfacts.org/api/v2/product/5449000000996.json?fields=code,product_name`, 8000);
    return { ok: Boolean(data.product || data.notFound), ms: Date.now() - started, message: "Baza produktów odpowiada." };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, message: "Serwer nie może połączyć się z Open Food Facts (" + error.message + ")." };
  }
}

// --- search ------------------------------------------------------------------------------
async function searchLegacy(query, polishOnly) {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.search = new URLSearchParams({
    search_terms: query, search_simple: "1", action: "process", json: "1", page_size: "30",
    sort_by: "unique_scans_n", fields: FIELDS, lc: "pl",
    ...(polishOnly ? { tagtype_0: "countries", tag_contains_0: "contains", tag_0: "poland" } : {})
  }).toString();
  const data = await offFetch(url, 9000);
  return (data.products || []).map(p => mapProduct(p));
}

async function searchElastic(query, polishOnly) {
  const url = new URL("https://search.openfoodfacts.org/search");
  url.search = new URLSearchParams({
    q: polishOnly ? `${query} countries_tags:"en:poland"` : query,
    langs: "pl,en", page_size: "30", sort_by: "-unique_scans_n", fields: FIELDS
  }).toString();
  const data = await offFetch(url, 8000);
  return (data.hits || []).map(p => mapProduct(p));
}

const fold = s => String(s || "").toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

/** Ranks products: complete nutrition, Polish market, name match. */
function rank(products, query) {
  const STOP = new Set(["z", "ze", "w", "we", "i", "na", "do", "o", "bez", "dla", "the", "of", "and"]);
  const all = fold(query).split(/\s+/).filter(Boolean);
  const kept = all.filter(w => !STOP.has(w)).length ? all.filter(w => !STOP.has(w)) : all;
  // Crude Polish stemming: drop up to 2 trailing letters (kurczaka → kurcza matches "kurczak").
  const words = kept.map(w => w.length > 5 ? w.slice(0, Math.max(5, w.length - 2)) : w);
  // Up to 3 words: every word must match; longer queries: a majority is enough.
  const need = words.length <= 3 ? words.length : Math.ceil(words.length / 2);
  const seen = new Set();
  return products
    .filter(p => p && p.name && p.complete)
    .filter(p => { const keys = [p.barcode, fold(`${p.name}|${p.brand}|${p.kcal}`)].filter(Boolean); if (keys.some(k => seen.has(k))) return false; keys.forEach(k => seen.add(k)); return true; })
    .map(p => {
      const hay = fold(p.name + " " + (p.brand || ""));
      const hits = words.filter(w => hay.includes(w)).length;
      const score = hits * 10 + (fold(p.name).startsWith(words[0] || "") ? 5 : 0) + (p.polish ? 3 : 0) + (p.image ? 1 : 0);
      return { p, score, hits };
    })
    .filter(x => x.hits >= need)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}

/** Returns { products, source, partial } – never throws for OFF outages (returns empty + warning). */
export async function searchProducts(query) {
  const key = "search:" + fold(query);
  const cached = cacheGet(key);
  if (cached) return cached;
  const attempts = [
    () => searchLegacy(query, true),
    () => searchElastic(query, true),
    () => searchLegacy(query, false),
    () => searchElastic(query, false)
  ];
  let collected = [], failures = 0;
  const started = Date.now();
  for (const attempt of attempts) {
    if (Date.now() - started > 10000) break; // keep the UI responsive
    try {
      collected = collected.concat(await attempt());
    } catch (error) {
      failures++;
      console.warn("[OFF] search attempt failed:", error.message);
    }
    if (rank(collected, query).length >= 8) break;
  }
  const products = rank(collected, query).slice(0, 15);
  const result = { products, source: "Open Food Facts", warning: failures === attempts.length ? "Baza Open Food Facts chwilowo nie odpowiada." : null };
  if (failures < attempts.length) cacheSet(key, result, 30 * 60 * 1000);
  return result;
}
