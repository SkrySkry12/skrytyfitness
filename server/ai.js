// LLM client: Abacus.AI RouteLLM (OpenAI-compatible) with OpenAI as an optional second provider.
// Transient failures (timeouts, network errors, HTTP 429/5xx) are retried once; every failure is logged
// with its concrete cause (never the key) so it shows up in the Coolify logs.
const AI_TIMEOUT = 30000;
const ABACUS_DEFAULT_MODEL = "gpt-4.1-mini";

function providers() {
  const list = [];
  const abacusKey = (process.env.ABACUS_API_KEY || "").trim();
  if (abacusKey) {
    list.push({
      name: "Abacus.AI", keyVar: "ABACUS_API_KEY",
      url: (process.env.ABACUS_BASE_URL || "https://routellm.abacus.ai/v1").trim().replace(/\/$/, "") + "/chat/completions",
      key: abacusKey,
      model: (process.env.ABACUS_MODEL || "").trim() || ABACUS_DEFAULT_MODEL,
      defaultModel: ABACUS_DEFAULT_MODEL
    });
  }
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (openaiKey) {
    list.push({ name: "OpenAI", keyVar: "OPENAI_API_KEY", url: "https://api.openai.com/v1/chat/completions", key: openaiKey, model: (process.env.OPENAI_MODEL || "").trim() || "gpt-4o-mini", defaultModel: "gpt-4o-mini" });
  }
  return list;
}

export const aiConfigured = () => providers().length > 0;
export const aiProviderName = () => providers()[0]?.name || null;
export const aiModelName = () => providers()[0]?.model || null;
export const isTimeout = error => error?.name === "TimeoutError" || error?.name === "AbortError";

export class AiError extends Error {
  constructor(message, status = 502, reason = "error") { super(message); this.status = status; this.reason = reason; }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errText = data => String(data?.error?.message || data?.error || data?.message || "").slice(0, 200);

/** One HTTP call to a provider. Returns { ok, content } or { ok:false, error: AiError, retry }. */
async function callOnce(p, model, body, timeout) {
  const started = Date.now();
  let response;
  try {
    response = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.key },
      body: JSON.stringify({ ...body, model }),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (error) {
    const cause = error?.cause?.code || error?.cause?.message || error?.name || error?.message;
    console.error(`[AI] ${p.name} (${model}) brak odpowiedzi po ${Date.now() - started} ms: ${cause}`);
    if (isTimeout(error)) return { ok: false, retry: true, error: new AiError(`AI nie odpowiedziało w ciągu ${Math.round(timeout / 1000)} s. Spróbuj ponownie.`, 504, "timeout") };
    return { ok: false, retry: true, error: new AiError(`Serwer aplikacji nie może połączyć się z usługą AI (${p.name}: ${cause}). Sprawdź połączenie serwera z internetem.`, 502, "network") };
  }
  const raw = await response.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 200) }; }
  if (!response.ok) {
    const detail = errText(data);
    console.error(`[AI] ${p.name} (${model}) HTTP ${response.status} po ${Date.now() - started} ms: ${detail || raw.slice(0, 200)}`);
    const s = response.status;
    if (s === 401 || s === 403) return { ok: false, retry: false, error: new AiError(`Klucz ${p.keyVar} ustawiony w Coolify jest nieprawidłowy lub wygasł. Wygeneruj nowy klucz API w Abacus.AI i wklej go w zmiennych środowiskowych aplikacji.`, 503, "invalid_key") };
    if (s === 402 || /credit|quota|balance|insufficient/i.test(detail)) return { ok: false, retry: false, error: new AiError(`Brak środków lub limit na koncie ${p.name}. Doładuj konto albo sprawdź plan, potem spróbuj ponownie.`, 503, "quota") };
    if (s === 429) return { ok: false, retry: true, error: new AiError(`Usługa AI (${p.name}) chwilowo ogranicza liczbę zapytań. Odczekaj minutę i spróbuj ponownie.`, 503, "rate_limited") };
    if (s === 400 || s === 404 || s === 422) return { ok: false, retry: false, badRequest: true, error: new AiError(`Usługa AI odrzuciła zapytanie (${detail || "HTTP " + s}). Sprawdź zmienną ${p.keyVar === "ABACUS_API_KEY" ? "ABACUS_MODEL" : "OPENAI_MODEL"} w Coolify (najlepiej ją usunąć).`, 502, "bad_request") };
    return { ok: false, retry: true, error: new AiError(`Usługa AI (${p.name}) ma chwilową awarię (HTTP ${s}). Spróbuj ponownie za kilka minut.`, 502, "provider_down") };
  }
  const message = data.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content
    : Array.isArray(message?.content) ? message.content.map(part => part?.text || "").join("") : "";
  if (!content.trim()) {
    console.error(`[AI] ${p.name} (${model}) pusta odpowiedź: ${raw.slice(0, 200)}`);
    return { ok: false, retry: true, error: new AiError("AI zwróciło pustą odpowiedź. Spróbuj ponownie.", 502, "empty") };
  }
  return { ok: true, content };
}

/** Sends a chat completion and returns the assistant text. Throws AiError with a Polish message. */
export async function chat(body, { timeout = AI_TIMEOUT, retries = 1 } = {}) {
  const list = providers();
  if (!list.length) throw new AiError("AI nie jest skonfigurowane: w Coolify brakuje zmiennej ABACUS_API_KEY (klucz API z Abacus.AI). Wyszukiwarka, skaner i ręczne wpisywanie działają bez AI.", 503, "missing_key");
  let lastError = null;
  for (const p of list) {
    let model = p.model, payload = body;
    for (let attempt = 0; attempt <= retries + 1; attempt++) {
      const result = await callOnce(p, model, payload, timeout);
      if (result.ok) return result.content;
      lastError = result.error;
      if (result.badRequest) {
        // A wrong ABACUS_MODEL or an unsupported response_format: retry once with safe defaults.
        if (model !== p.defaultModel) { console.warn(`[AI] ponawiam z domyślnym modelem ${p.defaultModel}`); model = p.defaultModel; continue; }
        if (payload.response_format) { console.warn("[AI] ponawiam bez response_format"); const { response_format: _rf, ...rest } = payload; payload = rest; continue; }
        break;
      }
      if (!result.retry || attempt >= retries) break;
      await sleep(1200);
    }
  }
  throw lastError;
}

/** Like chat() but parses a JSON object out of the answer (tolerates ```json fences and extra prose). */
export async function chatJson(body, opts) {
  const text = await chat({ response_format: { type: "json_object" }, ...body }, opts);
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  console.error("[AI] nie udało się odczytać JSON z odpowiedzi:", cleaned.slice(0, 200));
  throw new AiError("AI zwróciło nieprawidłowe dane. Spróbuj ponownie.", 502, "bad_json");
}

/** Diagnostics for /api/ai/status?test=1 – never exposes the key. */
export async function aiSelfTest() {
  const base = { enabled: aiConfigured(), provider: aiProviderName(), model: aiModelName() };
  if (!base.enabled) return { ...base, ok: false, reason: "missing_key", message: "Brak zmiennej ABACUS_API_KEY w Coolify." };
  const started = Date.now();
  try {
    await chat({ messages: [{ role: "user", content: "Odpowiedz jednym słowem: OK" }], max_tokens: 5 }, { timeout: 20000, retries: 0 });
    return { ...base, ok: true, ms: Date.now() - started, message: "AI działa." };
  } catch (error) {
    return { ...base, ok: false, ms: Date.now() - started, reason: error.reason || "error", message: error.message };
  }
}
