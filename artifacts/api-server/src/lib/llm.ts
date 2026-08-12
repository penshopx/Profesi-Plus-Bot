import OpenAI from "openai";

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
}

interface ProviderConfig {
  label: string;
  baseURL?: string;
  apiKeyEnv: string;
  models: { id: string; label: string }[];
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
  },
  deepseek: {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
    ],
  },
  qwen: {
    label: "Qwen",
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    models: [
      { id: "qwen-max", label: "Qwen Max" },
      { id: "qwen-plus", label: "Qwen Plus" },
      { id: "qwen-turbo", label: "Qwen Turbo" },
    ],
  },
  gemini: {
    label: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKeyEnv: "GEMINI_API_KEY",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
};

export const DEFAULT_MODEL = "gpt-4o";

const MODEL_TO_PROVIDER: Record<string, string> = {};
for (const [key, cfg] of Object.entries(PROVIDERS)) {
  for (const m of cfg.models) MODEL_TO_PROVIDER[m.id] = key;
}

export function isKnownModel(model: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODEL_TO_PROVIDER, model);
}

// ─── Fallback chains ──────────────────────────────────────────────────────────
// Each entry lists alternatives (in priority order) when the primary model is unavailable.

const FALLBACK_CHAINS: Record<string, string[]> = {
  "gpt-4o":            ["gemini-2.5-flash", "deepseek-chat", "gpt-4o-mini"],
  "gpt-4o-mini":       ["gemini-2.0-flash", "deepseek-chat"],
  "gemini-2.5-pro":    ["gpt-4o",           "gemini-2.5-flash"],
  "gemini-2.5-flash":  ["gpt-4o-mini",      "deepseek-chat"],
  "gemini-2.0-flash":  ["gemini-2.5-flash", "gpt-4o-mini"],
  "deepseek-chat":     ["gemini-2.5-flash", "gpt-4o-mini"],
  "deepseek-reasoner": ["gemini-2.5-pro",   "gpt-4o"],
  "qwen-max":          ["gemini-2.5-flash", "gpt-4o-mini"],
  "qwen-plus":         ["gemini-2.0-flash", "gpt-4o-mini"],
  "qwen-turbo":        ["gemini-2.0-flash", "gpt-4o-mini"],
};

/**
 * Returns the ordered list of model IDs to try for a given primary model,
 * filtered to only include models whose provider has an API key configured.
 */
export function getFallbackChain(primaryModel: string): string[] {
  const primary = isKnownModel(primaryModel) ? primaryModel : DEFAULT_MODEL;
  const candidates = [primary, ...(FALLBACK_CHAINS[primary] ?? FALLBACK_CHAINS[DEFAULT_MODEL] ?? [])];
  return candidates.filter((m) => {
    const pk = MODEL_TO_PROVIDER[m];
    if (!pk) return false;
    return !!process.env[PROVIDERS[pk]?.apiKeyEnv ?? ""];
  });
}

/**
 * Returns true for errors that are worth retrying on a different provider:
 *  - Network / connection failures
 *  - Rate limits (429)
 *  - Server-side errors (5xx)
 */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes("econnrefused") || msg.includes("fetch failed") || msg.includes("network error")) return true;
  // OpenAI SDK wraps HTTP errors with a `status` property
  const status = (err as { status?: number }).status;
  if (status !== undefined && (status === 429 || status >= 500)) return true;
  // OpenAI error code strings
  const code = (err as { code?: string }).code;
  if (code === "rate_limit_exceeded" || code === "server_error" || code === "overloaded_error") return true;
  return false;
}

/**
 * Calls `fn` with the first model in the fallback chain that succeeds.
 * Only retries on retryable errors; throws immediately on non-retryable ones.
 * Returns `{ result, modelUsed }` so callers can log which model actually ran.
 */
export async function callWithFallback<T>(
  primaryModel: string,
  fn: (llm: ReturnType<typeof getClientForModel>) => Promise<T>,
  log?: (msg: string) => void,
): Promise<{ result: T; modelUsed: string }> {
  const chain = getFallbackChain(primaryModel);
  if (chain.length === 0) {
    throw new Error("No LLM provider is configured. Set at least one API key in Secrets.");
  }
  let lastErr: unknown;
  for (const model of chain) {
    let llm: ReturnType<typeof getClientForModel>;
    try {
      llm = getClientForModel(model);
    } catch {
      continue; // provider not configured — skip
    }
    try {
      const result = await fn(llm);
      if (model !== primaryModel) {
        log?.(`Provider fallback: ${primaryModel} → ${model}`);
      }
      return { result, modelUsed: model };
    } catch (err) {
      if (isRetryableError(err)) {
        log?.(`Retryable error on ${model}: ${(err as Error).message} — trying next`);
        lastErr = err;
        continue;
      }
      throw err; // non-retryable (bad request, context too long, etc.)
    }
  }
  throw lastErr ?? new Error("All providers failed");
}

export function listModels(): (ModelInfo & { available: boolean })[] {
  const out: (ModelInfo & { available: boolean })[] = [];
  for (const [key, cfg] of Object.entries(PROVIDERS)) {
    const available = !!process.env[cfg.apiKeyEnv];
    for (const m of cfg.models) {
      out.push({
        id: m.id,
        label: m.label,
        provider: key,
        providerLabel: cfg.label,
        available,
      });
    }
  }
  return out;
}

const clientCache = new Map<string, OpenAI>();

export function getClientForModel(model: string): { client: OpenAI; model: string } {
  const providerKey = MODEL_TO_PROVIDER[model] ?? MODEL_TO_PROVIDER[DEFAULT_MODEL];
  const resolvedModel = isKnownModel(model) ? model : DEFAULT_MODEL;
  const cfg = PROVIDERS[providerKey];
  const apiKey = process.env[cfg.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `${cfg.label} belum dikonfigurasi. Set ${cfg.apiKeyEnv} di Secrets untuk memakai model ini.`,
    );
  }
  let client = clientCache.get(providerKey);
  if (!client) {
    client = new OpenAI({ apiKey, baseURL: cfg.baseURL });
    clientCache.set(providerKey, client);
  }
  return { client, model: resolvedModel };
}
