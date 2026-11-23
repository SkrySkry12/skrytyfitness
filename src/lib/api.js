// Thin fetch wrapper with typed errors: ApiError (HTTP), OfflineError (network failure).
export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = "ApiError"; this.status = status; }
}
export class OfflineError extends Error {
  constructor() { super("Brak połączenia z internetem."); this.name = "OfflineError"; }
}

let unauthorizedHandler = null;
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

export async function api(url, opts = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) }
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new OfflineError();
  }
  let data = {};
  try { data = await response.json(); } catch { /* empty or non-JSON body */ }
  if (!response.ok) {
    if (response.status === 401 && !url.startsWith("/api/login") && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data.error || `Wystąpił błąd (${response.status}).`, response.status);
  }
  return data;
}

export const isOffline = err => err instanceof OfflineError || (typeof navigator !== "undefined" && navigator.onLine === false);

// --- Offline queue for new entries (POST /api/entries) ---------------------------------
const QUEUE_KEY = "skr-offline-queue";
export function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
export function writeQueue(items) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* storage full/private mode */ }
}
export function enqueueEntry(entry) { writeQueue([...readQueue(), entry]); }

/** Sends queued entries; returns number of successfully synced items. */
export async function flushQueue() {
  const queue = readQueue();
  if (!queue.length) return 0;
  const left = [];
  let sent = 0;
  for (const item of queue) {
    try {
      await api("/api/entries", { method: "POST", body: JSON.stringify({ date: item.date, kind: item.kind, data: item.data }) });
      sent++;
    } catch (err) {
      if (err instanceof OfflineError) { left.push(item); }
      else if (err instanceof ApiError && err.status === 401) { left.push(item); }
      // other errors (400) – drop the invalid item
    }
  }
  writeQueue(left);
  return sent;
}
