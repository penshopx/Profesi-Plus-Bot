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
