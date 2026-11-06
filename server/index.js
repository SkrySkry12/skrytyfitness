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
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 14 }
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
    date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
    kind: z.enum(["weight","waist","water","food","workout","note"]),
    data: z.record(z.any())
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nieprawidłowe dane wpisu." });
  const result = await pool.query(
    "INSERT INTO entries(user_id,entry_date,kind,data) VALUES($1,$2,$3,$4) RETURNING id,entry_date,kind,data,created_at",
    [req.session.userId, parsed.data.date, parsed.data.kind, JSON.stringify(parsed.data.data)]
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
