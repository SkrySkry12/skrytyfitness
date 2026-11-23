import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, BarChart3, Dumbbell, Home, LogIn, LogOut, Menu, Settings as SettingsIcon, TrendingDown, Trophy, Utensils } from "lucide-react";
import "./style.css";
import { AppContext } from "./context.js";
import { ToastProvider, useToast } from "./components/Toast.jsx";
import { BottomSheet } from "./components/BottomSheet.jsx";
import { Spinner } from "./components/Spinner.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Training } from "./pages/Training.jsx";
import { Food } from "./pages/Food.jsx";
import { Progress } from "./pages/Progress.jsx";
import { Journey } from "./pages/Journey.jsx";
import { Reports } from "./pages/Reports.jsx";
import { Settings } from "./pages/Settings.jsx";
import { api, ApiError, OfflineError, enqueueEntry, flushQueue, onUnauthorized, readQueue, writeQueue } from "./lib/api.js";
import { todayIn } from "./lib/dates.js";
import { fmtKg } from "./lib/format.js";
import { mergeSettings, needsOnboarding } from "./lib/settings.js";
import { statsFromEntries } from "./lib/achievements.js";
import { currentSubscription } from "./lib/push.js";

const PAGES = {
  dashboard: { label: "Przegląd", icon: Home, Component: Dashboard },
  training: { label: "Trening", icon: Dumbbell, Component: Training },
  food: { label: "Dieta", icon: Utensils, Component: Food },
  progress: { label: "Postępy", icon: TrendingDown, Component: Progress },
  journey: { label: "Drzewko", icon: Trophy, Component: Journey },
  reports: { label: "Raporty", icon: BarChart3, Component: Reports },
  settings: { label: "Ustawienia", icon: SettingsIcon, Component: Settings }
};
const MAIN_NAV = ["dashboard", "training", "food", "progress"];
const MORE_NAV = ["journey", "reports", "settings"];
const THEME_COLORS = { blue: "#0a0f1e", pink: "#0f0a0d" };
const OFFLINE_MSG = "Brak połączenia — zmiany zostaną zsynchronizowane po powrocie online";

const pageFromUrl = () => {
  const p = new URLSearchParams(window.location.search).get("page");
  return PAGES[p] ? p : "dashboard";
};

const sortEntries = list => [...list].sort((a, b) =>
  String(b.entry_date).slice(0, 10).localeCompare(String(a.entry_date).slice(0, 10)) ||
  String(b.created_at || "").localeCompare(String(a.created_at || "")));

/** Pending (offline) entries are shown with negative ids until synced. */
const queuedAsEntries = () => readQueue().map(q => ({ id: q.tempId, entry_date: q.date, kind: q.kind, data: q.data, created_at: q.createdAt, pending: true }));

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("theme-pink", theme === "pink");
  root.classList.toggle("theme-blue", theme !== "pink");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.blue);
}

function Login({ onLoggedIn }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ username: login.trim(), password }) });
      setPassword("");
      await onLoggedIn();
    } catch (err) {
      setError(err instanceof OfflineError ? "Brak połączenia z internetem." : err.message);
    } finally { setBusy(false); }
  };
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand-mark"><Activity size={28} /></div>
        <p className="eyebrow">TWOJA OSOBISTA TRANSFORMACJA</p>
        <h1>SkrySkry <span className="accent-text">Fitness</span></h1>
        <p className="muted">Zaloguj się, aby przejść do swojego panelu.</p>
        <form onSubmit={submit}>
          <label className="field"><span>Login</span><input value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" required /></label>
          <label className="field"><span>Hasło</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          <button className="primary full" disabled={busy}>{busy ? <Spinner /> : <LogIn size={17} />} Zaloguj się</button>
        </form>
        {error && <p className="error-box" role="alert">{error}</p>}
        <p className="tiny">SKR FITNESS · SLEEPER BUILD JOURNEY</p>
      </div>
    </main>
  );
}

function App() {
  const toast = useToast();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [rawSettings, setRawSettings] = useState({});
  const [entries, setEntries] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [page, setPage] = useState(pageFromUrl);
  const [moreOpen, setMoreOpen] = useState(false);
  const mainRef = useRef(null);

  const settings = useMemo(() => mergeSettings(rawSettings, user?.username), [rawSettings, user]);
  const tz = settings.timezone;
  const [today, setToday] = useState(() => todayIn(tz));
  useEffect(() => {
    setToday(todayIn(tz));
    const id = setInterval(() => setToday(todayIn(tz)), 60000);
    return () => clearInterval(id);
  }, [tz]);

  const stats = serverStats || statsFromEntries(entries);

  const refreshStats = useCallback(() => { api("/api/stats").then(setServerStats).catch(() => {}); }, []);

  const loadAll = useCallback(async () => {
    const me = await api("/api/me");
    if (!me.authenticated) { setUser(null); return; }
    if (navigator.onLine) await flushQueue().catch(() => 0);
    const [recent, workouts, weights, saved, st] = await Promise.all([
      api("/api/entries"),
      api("/api/entries?kind=workout"),
      api("/api/entries?kind=weight"),
      api("/api/settings"),
      api("/api/stats").catch(() => null)
    ]);
    const byId = new Map();
    for (const e of [...recent, ...workouts, ...weights]) byId.set(e.id, e);
    setEntries(sortEntries([...queuedAsEntries(), ...byId.values()]));
    setRawSettings(saved.settings || {});
    setServerStats(st);
    setUser({ username: me.username });
  }, []);

  useEffect(() => {
    loadAll().catch(err => { if (!(err instanceof ApiError && err.status === 401)) toast(err instanceof OfflineError ? OFFLINE_MSG : err.message, { type: err instanceof OfflineError ? "offline" : "error" }); })
      .finally(() => setBooting(false));
  }, [loadAll, toast]);

  // Session expired → back to login with a message.
  useEffect(() => {
    onUnauthorized(() => {
      setUser(current => {
        if (current) toast("Sesja wygasła — zaloguj się ponownie.", { type: "error" });
        return null;
      });
    });
  }, [toast]);

  // Offline queue: sync when the connection comes back.
  useEffect(() => {
    const onOnline = async () => {
      const sent = await flushQueue().catch(() => 0);
      if (sent > 0) {
        toast(`Połączenie przywrócone — zsynchronizowano ${sent} ${sent === 1 ? "wpis" : sent < 5 ? "wpisy" : "wpisów"}`);
        loadAll().catch(() => {});
      }
    };
    const onOffline = () => toast(OFFLINE_MSG, { type: "offline" });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [toast, loadAll]);

  // History API navigation (?page= is kept so push notifications can deep-link, e.g. /?page=food).
  useEffect(() => {
    const onPop = () => { setPage(pageFromUrl()); setMoreOpen(false); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback(next => {
    if (!PAGES[next]) return;
    setMoreOpen(false);
    setPage(cur => {
      if (cur !== next) window.history.pushState({ page: next }, "", next === "dashboard" ? "/" : `/?page=${next}`);
      return next;
    });
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => { applyTheme(user ? settings.theme : "blue"); }, [user, settings.theme]);

  const reportError = useCallback((err, opts = {}) => {
    if (err instanceof OfflineError) toast(OFFLINE_MSG, { type: "offline" });
    else if (err instanceof ApiError && err.status === 401) { /* handled by onUnauthorized */ }
    else if (!opts.silent) toast(err?.message || "Wystąpił błąd.", { type: "error" });
  }, [toast]);

  const createEntry = useCallback(async (kind, data, date) => {
    try {
      const entry = await api("/api/entries", { method: "POST", body: JSON.stringify({ date, kind, data }) });
      setEntries(list => sortEntries([entry, ...list]));
      refreshStats();
      return entry;
    } catch (err) {
      if (!(err instanceof OfflineError)) throw err;
      const queued = { tempId: -Date.now() - Math.floor(Math.random() * 1000), kind, data, date: date || todayIn(tz), createdAt: new Date().toISOString() };
      enqueueEntry(queued);
      const entry = { id: queued.tempId, entry_date: queued.date, kind, data, created_at: queued.createdAt, pending: true };
      setEntries(list => sortEntries([entry, ...list]));
      toast(OFFLINE_MSG, { type: "offline" });
      return entry;
    }
  }, [refreshStats, toast, tz]);

  const updateEntry = useCallback(async (id, body) => {
    const entry = await api("/api/entries/" + id, { method: "PUT", body: JSON.stringify(body) });
    setEntries(list => sortEntries(list.map(e => (e.id === id ? entry : e))));
    return entry;
  }, []);

  const deleteEntry = useCallback(async id => {
    if (id < 0) writeQueue(readQueue().filter(q => q.tempId !== id));
    else await api("/api/entries/" + id, { method: "DELETE" });
    setEntries(list => list.filter(e => e.id !== id));
    if (id > 0) refreshStats();
  }, [refreshStats]);

  const saveSettings = useCallback(async next => {
    const clean = { ...next };
    for (const k of ["targetWeight", "startWeight", "kcalTarget", "proteinTarget", "carbsTarget", "fatTarget", "waterTargetMl"]) {
      clean[k] = clean[k] === "" || clean[k] == null ? null : Number(clean[k]);
    }
    const r = await api("/api/settings", { method: "PUT", body: JSON.stringify(clean) });
    setRawSettings(r.settings || clean);
    return r.settings;
  }, []);

  const logout = useCallback(async () => {
    const sub = await currentSubscription();
    try { await api("/api/logout", { method: "POST", body: JSON.stringify(sub ? { endpoint: sub.endpoint } : {}) }); } catch { /* ignore */ }
    try { await sub?.unsubscribe(); } catch { /* ignore */ }
    setUser(null); setEntries([]); setRawSettings({}); setServerStats(null);
    toast("Wylogowano", { type: "info" });
  }, [toast]);

  const ctx = { user, settings, saveSettings, entries, stats, today, tz, createEntry, updateEntry, deleteEntry, navigate, reportError, logout };

  if (booting) return <div className="boot"><div className="brand-mark"><Activity size={28} /></div><b>SKR<span className="accent-text">FITNESS</span></b><Spinner size={22} /></div>;
  if (!user) return <Login onLoggedIn={() => loadAll().catch(reportError)} />;
  if (needsOnboarding(rawSettings)) {
    return (
      <AppContext.Provider value={ctx}>
        <Onboarding user={user} initial={mergeSettings({}, user.username)}
          onFinish={async s => { try { await saveSettings(s); toast("Gotowe! Powodzenia 💪"); } catch (err) { reportError(err); } }} />
      </AppContext.Provider>
    );
  }

  const { Component } = PAGES[page];
  const topDate = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const moreActive = MORE_NAV.includes(page);

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <header className="topbar">
          <div>
            <p className="topbar-date">{topDate}</p>
            <h2>{PAGES[page].label}</h2>
          </div>
          {settings.targetWeight ? <span className="pill">CEL: {fmtKg(settings.targetWeight)} KG</span> : null}
        </header>
        <main className="main" ref={mainRef}>
          <div className="page-transition" key={page}><Component /></div>
          <footer className="footer">SKR FITNESS · SLEEPER BUILD JOURNEY</footer>
        </main>
        <nav className="bottom-nav" aria-label="Nawigacja główna">
          {MAIN_NAV.map(id => {
            const { label, icon: Icon } = PAGES[id];
            return (
              <button key={id} type="button" className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)}>
                <Icon size={24} /><span>{label}</span>
              </button>
            );
          })}
          <button type="button" className={moreActive || moreOpen ? "active" : ""} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
            <Menu size={24} /><span>Więcej</span>
          </button>
        </nav>
        <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Więcej">
          <div className="more-list">
            {MORE_NAV.map(id => {
              const { label, icon: Icon } = PAGES[id];
              return (
                <button key={id} type="button" className={"more-item" + (page === id ? " active" : "")} onClick={() => navigate(id)}>
                  <span className="icon-chip"><Icon size={20} /></span><span>{label}</span>
                </button>
              );
            })}
            <button type="button" className="more-item" onClick={() => { setMoreOpen(false); logout(); }}>
              <span className="icon-chip danger"><LogOut size={20} /></span><span>Wyloguj się</span>
            </button>
          </div>
        </BottomSheet>
      </div>
    </AppContext.Provider>
  );
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
createRoot(document.getElementById("root")).render(<ToastProvider><App /></ToastProvider>);
