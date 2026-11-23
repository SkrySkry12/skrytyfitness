import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import webpush from "web-push";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pool, initDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PgStore = connectPgSimple(session);
const port = Number(process.env.PORT || 3000);
const username = process.env.ADMIN_USERNAME || "skryskry";
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_TZ = process.env.APP_TIMEZONE || "Europe/Warsaw";
const AI_TIMEOUT = 30000;

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("Brak SESSION_SECRET. W trybie produkcyjnym ustaw długi, losowy SESSION_SECRET w zmiennych środowiskowych (Coolify).");
}

// Wraps async route handlers so rejected promises reach the error middleware instead of crashing Node.
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Validates :id route params (positive integer) and stores it on req.entryId.
const validId = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Nieprawidłowe ID" });
  req.entryId = id;
  next();
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_KINDS = ["weight", "waist", "water", "food", "workout", "note"];
const EDITABLE_KINDS = ["workout", "weight", "waist", "water", "food", "note"];

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "200kb" }));
app.use(session({
  store: new PgStore({ pool, tableName: "session", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 1000 * 60 * 60 * 24 * 14 }
}));

const auth = (req, res, next) => req.session.userId ? next() : res.status(401).json({ error: "Zaloguj się ponownie." });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Zbyt wiele prób logowania. Odczekaj 15 minut i spróbuj ponownie." }
});

function dateInTz(timezone, date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
}
function shiftDate(iso, days) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
async function getSettings(userId) {
  const result = await pool.query("SELECT settings FROM user_settings WHERE user_id=$1", [userId]);
  return result.rows[0]?.settings || {};
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/me", (req, res) => res.json({ authenticated: Boolean(req.session.userId), username: req.session.username || null }));

app.post("/api/login", loginLimiter, h(async (req, res) => {
  const parsed = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Podaj login i hasło." });
  const result = await pool.query("SELECT id, username, password_hash FROM users WHERE username=$1", [parsed.data.username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: "Nieprawidłowy login lub hasło." });
  // New session id after login prevents session fixation.
  await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
  req.session.userId = user.id;
  req.session.username = user.username;
  // Persist the session before replying, so the browser receives a usable session cookie.
  await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
  console.log(`Successful login for user: ${user.username}`);
  res.json({ ok: true, username: user.username });
}));

app.post("/api/logout", h(async (req, res) => {
  const endpoint = z.string().url().safeParse(req.body?.endpoint);
  if (req.session.userId && endpoint.success) {
    await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2", [req.session.userId, endpoint.data]);
  }
  await new Promise(resolve => req.session.destroy(() => resolve()));
  res.clearCookie("connect.sid", { path: "/" });
  res.json({ ok: true });
}));

app.post("/api/change-password", auth, h(async (req, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nowe hasło musi mieć co najmniej 12 znaków." });
  const u = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.session.userId]);
  if (!u.rowCount) return res.status(401).json({ error: "Zaloguj się ponownie." });
  if (!(await bcrypt.compare(parsed.data.currentPassword, u.rows[0].password_hash))) return res.status(400).json({ error: "Obecne hasło jest nieprawidłowe." });
  await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(parsed.data.newPassword, 12), req.session.userId]);
  res.json({ ok: true });
}));

const optNum = (min, max) => z.coerce.number().finite().min(min).max(max).optional().nullable();
const settingsSchema = z.object({
  targetWeight: optNum(20, 400),
  startWeight: optNum(20, 400),
  kcalTarget: optNum(500, 10000),
  proteinTarget: optNum(0, 1000),
  carbsTarget: optNum(0, 2000),
  fatTarget: optNum(0, 1000),
  waterTargetMl: optNum(0, 20000),
  theme: z.enum(["blue", "pink"]).optional().nullable(),
  timezone: z.string().max(64).optional().nullable(),
  remindersEnabled: z.boolean().optional(),
  meals: z.array(z.object({
    id: z.string().max(60),
    label: z.string().max(80),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    enabled: z.boolean().optional()
  }).passthrough()).max(20).optional()
}).passthrough();

app.get("/api/settings", auth, h(async (req, res) => {
  res.json({ settings: await getSettings(req.session.userId) });
}));

app.put("/api/settings", auth, h(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowe ustawienia." });
  const settings = parsed.data;
  if (settings.timezone) {
    try { new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone }); }
    catch { return res.status(400).json({ error: "Nieznana strefa czasowa." }); }
  }
  await pool.query(
    "INSERT INTO user_settings(user_id,settings) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET settings=EXCLUDED.settings, updated_at=NOW()",
    [req.session.userId, JSON.stringify(settings)]
  );
  res.json({ ok: true, settings });
}));

app.get("/api/push/public-key", auth, (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

app.get("/api/push/status", auth, h(async (req, res) => {
  const result = await pool.query("SELECT EXISTS(SELECT 1 FROM push_subscriptions WHERE user_id=$1) AS enabled", [req.session.userId]);
  res.json({ enabled: Boolean(result.rows[0]?.enabled) });
}));

app.post("/api/push/subscribe", auth, h(async (req, res) => {
  const parsed = z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) })
  }).passthrough().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowa subskrypcja powiadomień." });
  await pool.query(
    "INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES($1,$2,$3) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription",
    [req.session.userId, parsed.data.endpoint, JSON.stringify(parsed.data)]
  );
  res.json({ ok: true });
}));

app.delete("/api/push/subscribe", auth, h(async (req, res) => {
  const endpoint = z.string().url().safeParse(req.body?.endpoint);
  if (!endpoint.success) return res.status(400).json({ error: "Brak adresu subskrypcji." });
  await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2", [req.session.userId, endpoint.data]);
  res.json({ ok: true });
}));

// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=food
// No filters at all -> last 90 days. With `kind` but no `from` -> full history of that kind.
app.get("/api/entries", auth, h(async (req, res) => {
  const parsed = z.object({
    from: z.string().regex(DATE_RE).optional(),
    to: z.string().regex(DATE_RE).optional(),
    kind: z.enum(ENTRY_KINDS).optional()
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowe filtry (from/to: RRRR-MM-DD, kind: " + ENTRY_KINDS.join(", ") + ")." });
  let { from, to, kind } = parsed.data;
  if (!from && !to && !kind) {
    const settings = await getSettings(req.session.userId);
    from = shiftDate(dateInTz(settings.timezone || DEFAULT_TZ), -90);
  }
  const params = [req.session.userId];
  let sql = "SELECT id, entry_date, kind, data, created_at FROM entries WHERE user_id=$1";
  if (from) { params.push(from); sql += ` AND entry_date >= $${params.length}::date`; }
  if (to) { params.push(to); sql += ` AND entry_date <= $${params.length}::date`; }
  if (kind) { params.push(kind); sql += ` AND kind = $${params.length}`; }
  sql += " ORDER BY entry_date DESC, created_at DESC LIMIT 5000";
  const result = await pool.query(sql, params);
  res.json(result.rows);
}));

// Lightweight lifetime counters used for achievements (independent of the 90-day window).
app.get("/api/stats", auth, h(async (req, res) => {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE kind='workout')::int AS workouts,
       COUNT(*) FILTER (WHERE kind='food')::int AS food_entries,
       COUNT(DISTINCT entry_date) FILTER (WHERE kind='food')::int AS food_days,
       MIN(entry_date) AS first_entry
     FROM entries WHERE user_id=$1`,
    [req.session.userId]
  );
  const r = result.rows[0] || {};
  res.json({ workouts: r.workouts || 0, foodEntries: r.food_entries || 0, foodDays: r.food_days || 0, firstEntry: r.first_entry || null });
}));

app.post("/api/entries", auth, h(async (req, res) => {
  const parsed = z.object({
    date: z.string().regex(DATE_RE).optional(),
    kind: z.enum(ENTRY_KINDS),
    data: z.record(z.any())
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowe dane wpisu." });
  const result = await pool.query(
    "INSERT INTO entries(user_id,entry_date,kind,data) VALUES($1,COALESCE($2::date,CURRENT_DATE),$3,$4) RETURNING id,entry_date,kind,data,created_at",
    [req.session.userId, parsed.data.date || null, parsed.data.kind, JSON.stringify(parsed.data.data)]
  );
  res.status(201).json(result.rows[0]);
}));

app.put("/api/entries/:id", auth, validId, h(async (req, res) => {
  const parsed = z.object({
    date: z.string().regex(DATE_RE).optional(),
    data: z.record(z.any())
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowe dane wpisu." });
  const result = await pool.query(
    "UPDATE entries SET entry_date=COALESCE($1::date,entry_date), data=$2 WHERE id=$3 AND user_id=$4 AND kind = ANY($5::text[]) RETURNING id,entry_date,kind,data,created_at",
    [parsed.data.date || null, JSON.stringify(parsed.data.data), req.entryId, req.session.userId, EDITABLE_KINDS]
  );
  if (!result.rowCount) return res.status(404).json({ error: "Nie znaleziono wpisu do edycji." });
  res.json(result.rows[0]);
}));

app.delete("/api/entries/:id", auth, validId, h(async (req, res) => {
  const result = await pool.query("DELETE FROM entries WHERE id=$1 AND user_id=$2", [req.entryId, req.session.userId]);
  if (!result.rowCount) return res.status(404).json({ error: "Nie znaleziono wpisu." });
  res.json({ ok: true });
}));

app.get("/api/export", auth, h(async (req, res) => {
  const [result, settings] = await Promise.all([
    pool.query("SELECT entry_date,kind,data,created_at FROM entries WHERE user_id=$1 ORDER BY entry_date", [req.session.userId]),
    getSettings(req.session.userId)
  ]);
  res.setHeader("Content-Disposition", "attachment; filename=skryskry-fitness-backup.json");
  res.json({ exportedAt: new Date().toISOString(), username: req.session.username, settings, entries: result.rows });
}));

const foodLookupCache = new Map();
const FOOD_CACHE_TTL = 5 * 60 * 1000;
function cachedFood(key) {
  const item = foodLookupCache.get(key);
  if (!item || item.expiresAt < Date.now()) { foodLookupCache.delete(key); return null; }
  return item.value;
}
function storeFood(key, value) {
  foodLookupCache.set(key, { value, expiresAt: Date.now() + FOOD_CACHE_TTL });
  if (foodLookupCache.size > 250) foodLookupCache.delete(foodLookupCache.keys().next().value);
}
function mapOffProduct(product, fallbackCode = null) {
  if (!product) return null;
  const n = product.nutriments || {};
  const rawKcal = n["energy-kcal_100g"] ?? n["energy-kcal_value"];
  const kcal = rawKcal != null ? Number(rawKcal) :
    (n["energy_100g"] != null ? Number(n["energy_100g"]) / 4.184 : NaN);
  const name = product.product_name_pl || product.product_name || product.generic_name;
  if (!name || !Number.isFinite(kcal) || kcal < 0) return null;
  return {
    name: [name, product.brands].filter(Boolean).join(" · ").slice(0, 160),
    quantity: product.quantity || "",
    kcal: Math.round(kcal),
    protein: Number(n.proteins_100g || 0),
    carbs: Number(n.carbohydrates_100g || 0),
    fat: Number(n.fat_100g || 0),
    image: product.image_front_small_url || product.image_front_url || null,
    barcode: product.code || fallbackCode
  };
}
async function offJson(url, timeout = 10000) {
  const response = await fetch(url, {
    headers: { "User-Agent": "SkrySkryFitness/1.1 (https://skryskry.pl)" },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error("Open Food Facts HTTP " + response.status);
  return response.json();
}

app.get("/api/food/barcode/:code", auth, h(async (req, res) => {
  const code = String(req.params.code || "").replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(code)) return res.status(400).json({ error: "Nieprawidłowy kod kreskowy EAN." });
  const key = "barcode:" + code;
  const previous = cachedFood(key);
  if (previous) return res.json(previous);
  try {
    let payload;
    try {
      payload = await offJson("https://world.openfoodfacts.org/api/v3/product/" + encodeURIComponent(code) + ".json?fields=code,product_name,product_name_pl,generic_name,brands,quantity,nutriments,image_front_small_url,image_front_url");
    } catch (error) {
      console.warn("OFF v3 barcode lookup failed; trying v2:", error.message);
      payload = await offJson("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json?fields=code,product_name,product_name_pl,generic_name,brands,quantity,nutriments,image_front_small_url,image_front_url");
    }
    const product = mapOffProduct(payload.product, code);
    const result = { product, source: "Open Food Facts" };
    storeFood(key, result);
    res.json(result);
  } catch (error) {
    console.error("Food barcode lookup error:", error.message);
    res.status(502).json({ error: "Nie można połączyć się z bazą Open Food Facts (EAN). Spróbuj ponownie za chwilę." });
  }
}));

app.get("/api/food/search", auth, h(async (req, res) => {
  const parsed = z.string().trim().min(2).max(100).safeParse(String(req.query.q || ""));
  if (!parsed.success) return res.status(400).json({ error: "Wpisz co najmniej 2 znaki." });
  const query = parsed.data;
  const key = "search:" + query.toLocaleLowerCase("pl-PL");
  const previous = cachedFood(key);
  if (previous) return res.json(previous);
  try {
    // Full-text search is still served by OFF's legacy v1 endpoint.
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "20");
    url.searchParams.set("fields", "product_name,product_name_pl,generic_name,lc,lang,brands,quantity,code,nutriments,image_front_small_url,image_front_url");
    url.searchParams.set("lc", "pl");
    url.searchParams.set("cc", "pl");
    const payload = await offJson(url, 12000);
    const products = (payload.products || []).map(product => ({
      ...mapOffProduct(product),
      language: product.lc || product.lang || null
    })).filter(product => product && product.name);
    products.sort((a, b) => Number(b.language === "pl") - Number(a.language === "pl"));
    const result = { products: products.slice(0, 10), source: "Open Food Facts" };
    storeFood(key, result);
    res.json(result);
  } catch (error) {
    console.error("Food search error:", error.message);
    res.status(502).json({ error: "Nie można połączyć się z bazą Open Food Facts (wyszukiwanie). Spróbuj ponownie za chwilę." });
  }
}));

async function openAiChat(body) {
  const result = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.OPENAI_API_KEY },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", ...body }),
    signal: AbortSignal.timeout(AI_TIMEOUT)
  });
  const data = await result.json().catch(() => ({}));
  return { ok: result.ok, data };
}
const isTimeout = error => error?.name === "TimeoutError" || error?.name === "AbortError";

app.post("/api/ai/food-estimate", auth, h(async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Szacowanie AI jest opcjonalne i wymaga klucza OpenAI API oraz aktywnego rozliczania API w Coolify. Wyszukiwanie produktów i EAN działają bez AI." });
  const parsed = z.object({
    name: z.string().trim().min(2).max(180),
    grams: z.number().finite().min(1).max(5000)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Podaj nazwę dania i prawidłową gramaturę (1–5000 g)." });
  const { name, grams } = parsed.data;
  try {
    const { ok, data } = await openAiChat({
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: "Jesteś asystentem dietetycznym. Szacuj realistyczne wartości odżywcze typowego dania na podstawie polskich zwyczajów kulinarnych. Zwróć wyłącznie JSON: {\"kcal\": liczba, \"protein\": liczba, \"carbs\": liczba, \"fat\": liczba, \"note\": \"krótka informacja po polsku\"}. Wszystkie wartości dotyczą CAŁEJ podanej porcji, nie 100 g. Nie udawaj dokładności: zaznacz, że to szacunek. Kalorie i makroskładniki muszą być ze sobą w przybliżeniu spójne." },
        { role: "user", content: "Oszacuj typowe danie: " + name + ". Masa gotowej porcji: " + grams + " g. Zwróć kalorie, białko, węglowodany i tłuszcze dla całej porcji." }
      ]
    });
    if (!ok) return res.status(502).json({ error: "AI nie mogło oszacować dania: " + (data.error?.message || "spróbuj później") });
    let estimate;
    try { estimate = JSON.parse(data.choices?.[0]?.message?.content || "{}"); }
    catch { return res.status(502).json({ error: "AI zwróciło nieprawidłowe dane. Spróbuj ponownie." }); }
    const values = ["kcal", "protein", "carbs", "fat"].map(key => Number(estimate[key]));
    if (values.some(v => !Number.isFinite(v) || v < 0 || v > 10000)) return res.status(502).json({ error: "AI zwróciło nieprawidłowe wartości odżywcze." });
    res.json({ kcal: Math.round(values[0]), protein: Number(values[1].toFixed(1)), carbs: Number(values[2].toFixed(1)), fat: Number(values[3].toFixed(1)), note: String(estimate.note || "Wartości są orientacyjnym szacunkiem AI.").slice(0, 240) });
  } catch (error) {
    console.error("AI food estimate error", error.message);
    res.status(isTimeout(error) ? 504 : 500).json({ error: isTimeout(error) ? "AI nie odpowiedziało w ciągu 30 sekund. Spróbuj ponownie." : "Nie udało się oszacować wartości dania." });
  }
}));

// Builds the 7-day coaching report from the database (the client cannot inject arbitrary prompt text).
async function buildCoachReport(userId) {
  const settings = await getSettings(userId);
  const today = dateInTz(settings.timezone || DEFAULT_TZ);
  const from = shiftDate(today, -6);
  const { rows } = await pool.query(
    "SELECT entry_date, kind, data FROM entries WHERE user_id=$1 AND entry_date BETWEEN $2::date AND $3::date ORDER BY entry_date",
    [userId, from, today]
  );
  const lastWeight = await pool.query(
    "SELECT entry_date, data FROM entries WHERE user_id=$1 AND kind='weight' ORDER BY entry_date DESC, created_at DESC LIMIT 1", [userId]
  );
  const days = {};
  for (let i = 0; i < 7; i++) days[shiftDate(from, i)] = { kcal: 0, protein: 0, carbs: 0, fat: 0, water: 0, meals: 0, workouts: [], weight: null };
  for (const row of rows) {
    const d = days[row.entry_date]; if (!d) continue;
    const data = row.data || {};
    if (row.kind === "food") { d.kcal += Number(data.kcal) || 0; d.protein += Number(data.protein) || 0; d.carbs += Number(data.carbs) || 0; d.fat += Number(data.fat) || 0; d.meals++; }
    if (row.kind === "water") d.water += Number(data.ml) || 0;
    if (row.kind === "weight" && data.kg) d.weight = Number(data.kg);
    if (row.kind === "workout") {
      const done = (data.exercises || []).reduce((s, e) => s + (e.sets || []).filter(x => x.done).length, 0);
      d.workouts.push(`${data.name || data.plan || "Trening"} (${done} serii)`);
    }
  }
  const lines = [
    `Raport tygodniowy (${from} – ${today}).`,
    `Cele: kalorie ${settings.kcalTarget || "brak"} kcal, białko ${settings.proteinTarget || "brak"} g, woda ${settings.waterTargetMl || "brak"} ml, waga docelowa ${settings.targetWeight || "brak"} kg, waga startowa ${settings.startWeight || "brak"} kg.`,
    `Ostatnia waga: ${lastWeight.rows[0] ? lastWeight.rows[0].data?.kg + " kg (" + lastWeight.rows[0].entry_date + ")" : "brak pomiaru"}.`
  ];
  for (const [date, d] of Object.entries(days)) {
    lines.push(`${date}: ${Math.round(d.kcal)} kcal, B ${Math.round(d.protein)} g, W ${Math.round(d.carbs)} g, T ${Math.round(d.fat)} g, wpisów jedzenia ${d.meals}, woda ${d.water} ml` +
      (d.weight ? `, waga ${d.weight} kg` : "") + (d.workouts.length ? `, trening: ${d.workouts.join("; ")}` : ", brak treningu"));
  }
  return lines.join("\n");
}

app.post("/api/ai/coach", auth, h(async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Brak OPENAI_API_KEY w konfiguracji Coolify." });
  const report = await buildCoachReport(req.session.userId);
  try {
    const { ok, data } = await openAiChat({
      messages: [
        { role: "system", content: "Jesteś rozsądnym trenerem i edukatorem żywieniowym. Odpowiadaj po polsku, bez zawstydzania, bez skrajnych diet. Uwzględnij regenerację, ból i bezpieczeństwo. Podaj mocne strony, obszary do poprawy i trzy konkretne kroki." },
        { role: "user", content: report }
      ]
    });
    if (!ok) return res.status(502).json({ error: "Usługa AI zwróciła błąd: " + (data.error?.message || "spróbuj później") });
    res.json({ analysis: data.choices?.[0]?.message?.content || "Brak odpowiedzi AI.", report });
  } catch (error) {
    console.error("AI analysis error", error.message);
    res.status(isTimeout(error) ? 504 : 500).json({ error: isTimeout(error) ? "AI nie odpowiedziało w ciągu 30 sekund. Spróbuj ponownie." : "Nie udało się wykonać analizy AI." });
  }
}));

// Unknown API routes return JSON 404 (instead of the SPA's index.html).
app.use("/api", (_req, res) => res.status(404).json({ error: "Nie znaleziono zasobu API." }));

app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../dist/index.html")));

// Global error handler – must be registered after all routes.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Nieprawidłowy format danych (JSON)." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Przesłane dane są zbyt duże." });
  console.error("[ERROR]", req.method, req.originalUrl, err?.stack || err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Błąd serwera. Spróbuj ponownie." });
});

await initDb();
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 12 || adminPassword === "USTAW_TUTAJ_SILNE_HASLO") {
  console.warn("UWAGA: ustaw ADMIN_PASSWORD (min. 12 znaków) w .env. Konto nie zostanie utworzone bez bezpiecznego hasła.");
} else {
  const existing = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
  if (!existing.rowCount) await pool.query("INSERT INTO users(username,password_hash) VALUES($1,$2)", [username, await bcrypt.hash(adminPassword, 12)]);
}

const girlfriendPassword = process.env.KIELTYCZKA_PASSWORD;
if (!girlfriendPassword || girlfriendPassword.length < 12) {
  console.warn("UWAGA: ustaw KIELTYCZKA_PASSWORD (min. 12 znaków), aby utworzyć konto kieltyczka.");
} else {
  const existingGirlfriend = await pool.query("SELECT id FROM users WHERE username=$1", ["kieltyczka"]);
  if (!existingGirlfriend.rowCount) {
    await pool.query("INSERT INTO users(username,password_hash) VALUES($1,$2)", ["kieltyczka", await bcrypt.hash(girlfriendPassword, 12)]);
    console.log("Created separate fitness profile: kieltyczka");
  } else {
    console.log("Fitness profile kieltyczka already exists; password was not changed.");
  }
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@skryskry.pl";
const pushConfigured = Boolean(vapidPublicKey && vapidPrivateKey);
if (pushConfigured) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const REMINDER_WINDOW_MIN = 10;
function nowParts(timezone) {
  let tz = timezone || DEFAULT_TZ;
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); } catch { tz = DEFAULT_TZ; }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date()).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
const toMinutes = t => { const [hh, mm] = String(t || "").split(":").map(Number); return Number.isFinite(hh) && Number.isFinite(mm) ? hh * 60 + mm : NaN; };

let reminderTickRunning = false;
async function sendScheduledMealReminders() {
  if (!pushConfigured || reminderTickRunning) return;
  reminderTickRunning = true;
  try {
    const result = await pool.query(
      "SELECT s.user_id,s.settings,array_agg(p.subscription) AS subscriptions FROM user_settings s JOIN push_subscriptions p ON p.user_id=s.user_id GROUP BY s.user_id,s.settings"
    );
    for (const row of result.rows) {
      const settings = row.settings || {};
      if (settings.remindersEnabled === false) continue;
      const { date, minutes } = nowParts(settings.timezone);
      // A 10-minute window tolerates missed ticks (restarts, slow DB) – the claim table prevents duplicates.
      const meal = (settings.meals || []).find(m => {
        if (m.enabled === false) return false;
        const diff = minutes - toMinutes(m.time);
        return diff >= 0 && diff < REMINDER_WINDOW_MIN;
      });
      if (!meal) continue;
      const claimed = await pool.query(
        "INSERT INTO push_reminders_sent(user_id,reminder_date,reminder_time) VALUES($1,$2::date,$3) ON CONFLICT DO NOTHING RETURNING user_id",
        [row.user_id, date, meal.time]
      );
      if (!claimed.rowCount) continue;
      const payload = JSON.stringify({
        title: "Czas na posiłek 🍽️",
        body: "Możesz już zjeść: " + String(meal.label || "zaplanowany posiłek") + ". Bez presji — potraktuj to jako przypomnienie.",
        url: "/?page=food"
      });
      for (const subscription of row.subscriptions || []) {
        try { await webpush.sendNotification(subscription, payload); }
        catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [subscription.endpoint]);
          } else console.error("Meal push error", error.message);
        }
      }
    }
  } catch (error) { console.error("Meal reminder scheduler error", error); }
  finally { reminderTickRunning = false; }
}

async function cleanupReminderLog() {
  try {
    const r = await pool.query("DELETE FROM push_reminders_sent WHERE reminder_date < CURRENT_DATE - INTERVAL '7 days'");
    if (r.rowCount) console.log(`Usunięto ${r.rowCount} starych wpisów przypomnień.`);
  } catch (error) { console.error("Reminder cleanup error", error.message); }
}

setInterval(sendScheduledMealReminders, 60 * 1000);
setTimeout(sendScheduledMealReminders, 5000);
setInterval(cleanupReminderLog, 24 * 60 * 60 * 1000);
setTimeout(cleanupReminderLog, 15000);

process.on("unhandledRejection", reason => console.error("[UNHANDLED REJECTION]", reason));

app.listen(port, "0.0.0.0", () => console.log(`SkrySkry Fitness działa na porcie ${port}`));
