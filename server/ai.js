// LLM client: Abacus.AI RouteLLM (OpenAI-compatible) with optional OpenAI fallback.
const AI_TIMEOUT = 30000;

function provider() {
  if (process.env.ABACUS_API_KEY) {
    return {
      name: "Abacus.AI",
      url: (process.env.ABACUS_BASE_URL || "https://routellm.abacus.ai/v1").replace(/\/$/, "") + "/chat/completions",
      key: process.env.ABACUS_API_KEY,
      model: process.env.ABACUS_MODEL || "gpt-4.1-mini"
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
  }
  return null;
}

export const aiConfigured = () => Boolean(provider());
export const aiProviderName = () => provider()?.name || null;
export const isTimeout = error => error?.name === "TimeoutError" || error?.name === "AbortError";

export class AiError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

/** Sends a chat completion and returns the assistant text. Throws AiError with a Polish message. */
export async function chat(body, { timeout = AI_TIMEOUT } = {}) {
  const p = provider();
  if (!p) throw new AiError("Funkcje AI wymagają ustawienia ABACUS_API_KEY w konfiguracji serwera (Coolify).", 503);
  let response;
  try {
    response = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.key },
      body: JSON.stringify({ model: p.model, ...body }),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (error) {
    if (isTimeout(error)) throw new AiError("AI nie odpowiedziało w ciągu 30 sekund. Spróbuj ponownie.", 504);
    throw new AiError("Nie udało się połączyć z usługą AI (" + p.name + ").", 502);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`[AI] ${p.name} HTTP ${response.status}:`, JSON.stringify(data).slice(0, 300));
    const status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw new AiError(status === 503 ? "Klucz ABACUS_API_KEY jest nieprawidłowy lub wygasł." : "Usługa AI zwróciła błąd. Spróbuj za chwilę.", status);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("AI zwróciło pustą odpowiedź. Spróbuj ponownie.");
  return content;
}

/** Like chat() but parses a JSON object out of the answer (tolerates ```json fences). */
export async function chatJson(body, opts) {
  const text = await chat({ response_format: { type: "json_object" }, ...body }, opts);
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  throw new AiError("AI zwróciło nieprawidłowe dane. Spróbuj ponownie.");
}
