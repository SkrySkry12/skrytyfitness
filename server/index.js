import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pool, initDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PgStore = connectPgSimple(session);
const port = Number(process.env.PORT || 3000);
const username = process.env.ADMIN_USERNAME || "skryskry";

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

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/me", (req, res) => res.json({ authenticated: Boolean(req.session.userId), username: req.session.username || null }));

app.post("/api/login", async (req, res) => {
  const parsed = z.object({ username: z.string().min(1).max(80), password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Podaj login i hasło." });
  const result = await pool.query("SELECT id, username, password_hash FROM users WHERE username=$1", [parsed.data.username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: "Nieprawidłowy login lub hasło." });
  req.session.userId = user.id;
  req.session.username = user.username;
  // Persist the session before replying, so the browser receives a usable session cookie.
  await new Promise((resolve, reject) => {
    req.session.save(err => err ? reject(err) : resolve());
  });
  console.log(`Successful login for user: ${user.username}`);
  res.json({ ok: true, username: user.username });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.post("/api/change-password", auth, async (req, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nowe hasło musi mieć co najmniej 12 znaków." });
  const u = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.session.userId]);
  if (!(await bcrypt.compare(parsed.data.currentPassword, u.rows[0].password_hash))) return res.status(400).json({ error: "Obecne hasło jest nieprawidłowe." });
  await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(parsed.data.newPassword, 12), req.session.userId]);
  res.json({ ok: true });
});

app.get("/api/entries", auth, async (req, res) => {
  const result = await pool.query("SELECT id, entry_date, kind, data, created_at FROM entries WHERE user_id=$1 ORDER BY entry_date DESC, created_at DESC LIMIT 500", [req.session.userId]);
  res.json(result.rows);
});

app.post("/api/entries", auth, async (req, res) => {
  const parsed = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    kind: z.enum(["weight","waist","water","food","workout","note"]),
    data: z.record(z.any())
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowe dane wpisu." });
  const result = await pool.query(
    "INSERT INTO entries(user_id,entry_date,kind,data) VALUES($1,COALESCE($2::date,CURRENT_DATE),$3,$4) RETURNING id,entry_date,kind,data,created_at",
    [req.session.userId, parsed.data.date || null, parsed.data.kind, JSON.stringify(parsed.data.data)]
  );
  res.status(201).json(result.rows[0]);
});

app.delete("/api/entries/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM entries WHERE id=$1 AND user_id=$2", [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

app.get("/api/export", auth, async (req, res) => {
  const result = await pool.query("SELECT entry_date,kind,data,created_at FROM entries WHERE user_id=$1 ORDER BY entry_date", [req.session.userId]);
  res.setHeader("Content-Disposition", "attachment; filename=skryskry-fitness-backup.json");
  res.json({ exportedAt: new Date().toISOString(), entries: result.rows });
});

app.get("/api/food/barcode/:code", auth, async (req,res) => {
  try {
    const code = String(req.params.code || "");
    if (!/^\d{8,14}$/.test(code)) return res.status(400).json({ error: "Nieprawidłowy kod kreskowy EAN." });
    const response = await fetch("https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields=product_name,brands,quantity,code,nutriments,image_front_small_url", {
      headers: { "User-Agent": "SkrySkryFitness/1.0 (food diary; contact: support@skryskry.pl)" },
      signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) return res.status(502).json({ error: "Baza produktów jest chwilowo niedostępna." });
    const payload = await response.json();
    if (payload.status !== 1 || !payload.product) return res.json({ product: null, source: "Open Food Facts" });
    const product = payload.product, n = product.nutriments || {};
    const kcal = Number(n["energy-kcal_100g"] ?? n["energy-kcal_value"] ?? (Number(n["energy_100g"]) / 4.184));
    if (!product.product_name || !Number.isFinite(kcal) || kcal < 0) return res.json({ product: null, source: "Open Food Facts" });
    res.json({ product: {
      name: [product.product_name, product.brands].filter(Boolean).join(" · ").slice(0,160),
      quantity: product.quantity || "", kcal: Math.round(kcal),
      protein: Number(n.proteins_100g || 0), carbs: Number(n.carbohydrates_100g || 0),
      fat: Number(n.fat_100g || 0), image: product.image_front_small_url || null, barcode: product.code || code
    }, source: "Open Food Facts" });
  } catch (error) {
    console.error("Food barcode lookup error", error);
    res.status(502).json({ error: "Nie udało się wyszukać kodu. Spróbuj ponownie." });
  }
});

app.get("/api/food/search", auth, async (req, res) => {
  try {
    const query = z.string().trim().min(2).max(100).safeParse(String(req.query.q || ""));
    if (!query.success) return res.status(400).json({ error: "Wpisz co najmniej 2 znaki." });

    // The legacy CGI search endpoint supports full-text product-name searches.
    // API v2 /search is filter-based and does not support search_terms.
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", query.data);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "20");
    url.searchParams.set("fields", "product_name,product_name_pl,lc,lang,brands,quantity,code,nutriments,image_front_small_url");
    url.searchParams.set("lc", "pl");
    url.searchParams.set("cc", "pl");

    const response = await fetch(url, {
      headers: { "User-Agent": "SkrySkryFitness/1.0 (food diary; contact: support@skryskry.pl)" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return res.status(502).json({ error: "Baza produktów jest chwilowo niedostępna." });
    const payload = await response.json();
    const products = (payload.products || []).map(product => {
      const n = product.nutriments || {};
      const kcal = Number(n["energy-kcal_100g"] ?? n["energy-kcal_value"] ?? (Number(n["energy_100g"]) / 4.184));
      const localName = product.product_name_pl || (product.lc === "pl" ? product.product_name : "") || product.product_name;
      return {
        name: [localName, product.brands].filter(Boolean).join(" · ").slice(0, 160),
        quantity: product.quantity || "",
        kcal: Number.isFinite(kcal) ? Math.round(kcal) : null,
        protein: Number(n.proteins_100g || 0),
        carbs: Number(n.carbohydrates_100g || 0),
        fat: Number(n.fat_100g || 0),
        image: product.image_front_small_url || null,
        barcode: product.code || null,
        language: product.lc || product.lang || null
      };
    }).filter(p => p.name && p.kcal !== null && p.kcal >= 0);
    products.sort((a, b) => Number(b.language === "pl") - Number(a.language === "pl"));
    res.json({ products: products.slice(0, 10), source: "Open Food Facts" });
  } catch (error) {
    console.error("Food search error", error);
    res.status(502).json({ error: "Nie udało się wyszukać produktu. Spróbuj ponownie." });
  }
});

app.post("/api/ai/food-estimate", auth, async (req,res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Brak OPENAI_API_KEY w konfiguracji Coolify."});
    const parsed = z.object({
      name: z.string().trim().min(2).max(180),
      grams: z.number().finite().min(1).max(5000)
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:"Podaj nazwę dania i prawidłową gramaturę (1–5000 g)."});
    const {name,grams}=parsed.data;
    const result=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+process.env.OPENAI_API_KEY},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-4o-mini",
        response_format:{type:"json_object"},
        messages:[
          {role:"system",content:"Jesteś asystentem dietetycznym. Szacuj realistyczne wartości odżywcze typowego dania na podstawie polskich zwyczajów kulinarnych. Zwróć wyłącznie JSON: {\\\"kcal\\\": liczba, \\\"protein\\\": liczba, \\\"carbs\\\": liczba, \\\"fat\\\": liczba, \\\"note\\\": \\\"krótka informacja po polsku\\\"}. Wszystkie wartości dotyczą CAŁEJ podanej porcji, nie 100 g. Nie udawaj dokładności: zaznacz, że to szacunek. Kalorie i makroskładniki muszą być ze sobą w przybliżeniu spójne."},
          {role:"user",content:"Oszacuj typowe danie: "+name+". Masa gotowej porcji: "+grams+" g. Zwróć kalorie, białko, węglowodany i tłuszcze dla całej porcji."}
        ],
        temperature:0.2
      })
    });
    const data=await result.json();
    if(!result.ok)return res.status(502).json({error:"AI nie mogło oszacować dania: "+(data.error?.message||"spróbuj później")});
    let estimate;
    try{estimate=JSON.parse(data.choices?.[0]?.message?.content||"{}");}catch{return res.status(502).json({error:"AI zwróciło nieprawidłowe dane. Spróbuj ponownie."});}
    const values=["kcal","protein","carbs","fat"].map(key=>Number(estimate[key]));
    if(values.some(v=>!Number.isFinite(v)||v<0||v>10000))return res.status(502).json({error:"AI zwróciło nieprawidłowe wartości odżywcze."});
    res.json({kcal:Math.round(values[0]),protein:Number(values[1].toFixed(1)),carbs:Number(values[2].toFixed(1)),fat:Number(values[3].toFixed(1)),note:String(estimate.note||"Wartości są orientacyjnym szacunkiem AI.").slice(0,240)});
  }catch(error){console.error("AI food estimate error",error);res.status(500).json({error:"Nie udało się oszacować wartości dania."});}
});

app.post("/api/ai/coach", auth, async (req,res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Brak OPENAI_API_KEY w konfiguracji Coolify."});
    const parsed = z.object({report:z.string().min(1).max(20000)}).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:"Brak danych raportu."});
    const result = await fetch("https://api.openai.com/v1/chat/completions", {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+process.env.OPENAI_API_KEY},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",messages:[{role:"system",content:"Jesteś rozsądnym trenerem i edukatorem żywieniowym. Odpowiadaj po polsku, bez zawstydzania, bez skrajnych diet. Uwzględnij regenerację, ból i bezpieczeństwo. Podaj mocne strony, obszary do poprawy i trzy konkretne kroki."},{role:"user",content:parsed.data.report}]})});
    const data = await result.json();
    if (!result.ok) return res.status(502).json({error:"Usługa AI zwróciła błąd: "+(data.error?.message||"spróbuj później")});
    res.json({analysis:data.choices?.[0]?.message?.content||"Brak odpowiedzi AI."});
  } catch (error) { console.error("AI analysis error",error); res.status(500).json({error:"Nie udało się wykonać analizy AI."}); }
});

app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../dist/index.html")));

await initDb();
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 12 || adminPassword === "USTAW_TUTAJ_SILNE_HASLO") {
  console.warn("UWAGA: ustaw ADMIN_PASSWORD (min. 12 znaków) w .env. Konto nie zostanie utworzone bez bezpiecznego hasła.");
} else {
  const existing = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
  if (!existing.rowCount) await pool.query("INSERT INTO users(username,password_hash) VALUES($1,$2)", [username, await bcrypt.hash(adminPassword, 12)]);
}
app.listen(port, "0.0.0.0", () => console.log(`SkrySkry Fitness działa na porcie ${port}`));
